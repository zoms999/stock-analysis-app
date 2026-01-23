/**
 * 실시간 가격 폴링 시스템 (WebSocket 대체)
 * 
 * Phase 2: Yahoo Finance 기반 폴링
 * - 10초 간격으로 가격 업데이트
 * - 서버 캐싱 활용 (Rate Limit 방어)
 * - 배치 조회로 효율성 극대화
 */

export interface PriceUpdate {
    symbol: string;
    price: number;
    previousClose?: number;
    change?: number;
    changePercent?: number;
    timestamp: number;
}

export interface PollingOptions {
    interval?: number; // 폴링 간격 (ms), 기본 10초
    onError?: (error: Error) => void;
    maxRetries?: number; // 연속 실패 시 최대 재시도 횟수
}

/**
 * 가격 폴링 클래스
 */
export class PricePoller {
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private subscribers: Map<string, Set<(data: PriceUpdate) => void>> = new Map();
    private lastPrices: Map<string, PriceUpdate> = new Map();
    private failureCounts: Map<string, number> = new Map();
    private isPolling: Map<string, boolean> = new Map();

    /**
     * 심볼 구독 (자동으로 폴링 시작)
     * 
     * @param symbols 구독할 심볼 배열
     * @param onPrice 가격 업데이트 콜백
     * @param options 폴링 옵션
     * @returns cleanup 함수
     */
    subscribe(
        symbols: string[],
        onPrice: (data: PriceUpdate) => void,
        options: PollingOptions = {}
    ): { close: () => void } {
        const {
            interval = 10000, // 10초
            onError = (err) => console.error('[PricePoller] Error:', err),
            maxRetries = 3,
        } = options;

        // 각 심볼에 대해 구독자 등록
        symbols.forEach((symbol) => {
            const key = symbol.toUpperCase();

            if (!this.subscribers.has(key)) {
                this.subscribers.set(key, new Set());
            }
            this.subscribers.get(key)!.add(onPrice);

            // 이미 폴링 중이면 스킵
            if (this.isPolling.get(key)) {
                // 마지막 가격이 있으면 즉시 전달
                const lastPrice = this.lastPrices.get(key);
                if (lastPrice) {
                    onPrice(lastPrice);
                }
                return;
            }

            // 폴링 시작
            this.startPolling(key, interval, onError, maxRetries);
        });

        // cleanup 함수 반환
        return {
            close: () => {
                symbols.forEach((symbol) => {
                    const key = symbol.toUpperCase();
                    const subs = this.subscribers.get(key);
                    if (subs) {
                        subs.delete(onPrice);

                        // 구독자가 없으면 폴링 중지
                        if (subs.size === 0) {
                            this.stopPolling(key);
                        }
                    }
                });
            },
        };
    }

    /**
     * 배치 구독 (여러 심볼을 한 번에 조회)
     * 
     * @param symbols 구독할 심볼 배열
     * @param onPrice 가격 업데이트 콜백
     * @param options 폴링 옵션
     * @returns cleanup 함수
     */
    subscribeBatch(
        symbols: string[],
        onPrice: (data: PriceUpdate) => void,
        options: PollingOptions = {}
    ): { close: () => void } {
        const {
            interval = 10000,
            onError = (err) => console.error('[PricePoller] Batch Error:', err),
        } = options;

        const batchKey = `batch:${symbols.sort().join(',')}`;

        // 배치 폴링 시작
        if (!this.isPolling.get(batchKey)) {
            this.startBatchPolling(symbols, batchKey, interval, onError);
        }

        // 각 심볼에 대해 구독자 등록
        symbols.forEach((symbol) => {
            const key = symbol.toUpperCase();
            if (!this.subscribers.has(key)) {
                this.subscribers.set(key, new Set());
            }
            this.subscribers.get(key)!.add(onPrice);
        });

        return {
            close: () => {
                symbols.forEach((symbol) => {
                    const key = symbol.toUpperCase();
                    const subs = this.subscribers.get(key);
                    if (subs) {
                        subs.delete(onPrice);
                    }
                });

                // 배치 폴링 중지
                this.stopPolling(batchKey);
            },
        };
    }

    /**
     * 단일 심볼 폴링 시작
     */
    private startPolling(
        symbol: string,
        interval: number,
        onError: (error: Error) => void,
        maxRetries: number
    ) {
        this.isPolling.set(symbol, true);
        this.failureCounts.set(symbol, 0);

        // 즉시 1회 실행
        this.fetchAndNotify(symbol, onError, maxRetries);

        // 주기적 실행
        const timer = setInterval(() => {
            this.fetchAndNotify(symbol, onError, maxRetries);
        }, interval);

        this.timers.set(symbol, timer);
    }

    /**
     * 배치 폴링 시작
     */
    private startBatchPolling(
        symbols: string[],
        batchKey: string,
        interval: number,
        onError: (error: Error) => void
    ) {
        this.isPolling.set(batchKey, true);

        // 즉시 1회 실행
        this.fetchBatchAndNotify(symbols, onError);

        // 주기적 실행
        const timer = setInterval(() => {
            this.fetchBatchAndNotify(symbols, onError);
        }, interval);

        this.timers.set(batchKey, timer);
    }

    /**
     * 폴링 중지
     */
    private stopPolling(key: string) {
        const timer = this.timers.get(key);
        if (timer) {
            clearInterval(timer);
            this.timers.delete(key);
        }
        this.isPolling.delete(key);
        this.subscribers.delete(key);
        this.failureCounts.delete(key);
    }

    /**
     * 단일 심볼 가격 조회 및 알림
     */
    private async fetchAndNotify(
        symbol: string,
        onError: (error: Error) => void,
        maxRetries: number
    ) {
        try {
            const response = await fetch(`/api/price?symbol=${encodeURIComponent(symbol)}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch price for ${symbol}: ${response.statusText}`);
            }

            const data = await response.json();

            const priceUpdate: PriceUpdate = {
                symbol: data.symbol || symbol.toUpperCase(),
                price: data.price,
                previousClose: data.previousClose,
                change: data.change,
                changePercent: data.changePercent,
                timestamp: data.timestamp || Date.now(),
            };

            // 캐시 업데이트
            this.lastPrices.set(symbol, priceUpdate);
            this.failureCounts.set(symbol, 0);

            // 구독자들에게 알림
            const subscribers = this.subscribers.get(symbol);
            if (subscribers) {
                subscribers.forEach((callback) => {
                    try {
                        callback(priceUpdate);
                    } catch (err) {
                        console.error(`[PricePoller] Callback error for ${symbol}:`, err);
                    }
                });
            }
        } catch (error) {
            const failures = (this.failureCounts.get(symbol) || 0) + 1;
            this.failureCounts.set(symbol, failures);

            if (failures >= maxRetries) {
                onError(error as Error);
                // 최대 재시도 횟수 초과 시 폴링 중지
                this.stopPolling(symbol);
            }
        }
    }

    /**
     * 배치 가격 조회 및 알림
     */
    private async fetchBatchAndNotify(
        symbols: string[],
        onError: (error: Error) => void
    ) {
        try {
            const symbolsParam = symbols.join(',');
            const response = await fetch(`/api/price?symbols=${encodeURIComponent(symbolsParam)}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch batch prices: ${response.statusText}`);
            }

            const data = await response.json();

            // 각 심볼에 대해 처리
            Object.entries(data).forEach(([symbol, priceData]: [string, any]) => {
                const priceUpdate: PriceUpdate = {
                    symbol,
                    price: priceData.price,
                    previousClose: priceData.previousClose,
                    change: priceData.change,
                    changePercent: priceData.changePercent,
                    timestamp: priceData.timestamp || Date.now(),
                };

                // 캐시 업데이트
                this.lastPrices.set(symbol, priceUpdate);

                // 구독자들에게 알림
                const subscribers = this.subscribers.get(symbol);
                if (subscribers) {
                    subscribers.forEach((callback) => {
                        try {
                            callback(priceUpdate);
                        } catch (err) {
                            console.error(`[PricePoller] Callback error for ${symbol}:`, err);
                        }
                    });
                }
            });
        } catch (error) {
            onError(error as Error);
        }
    }

    /**
     * 현재 폴링 중인 심볼 목록 조회
     */
    getActiveSymbols(): string[] {
        return Array.from(this.subscribers.keys());
    }

    /**
     * 마지막 가격 조회 (캐시)
     */
    getLastPrice(symbol: string): PriceUpdate | undefined {
        return this.lastPrices.get(symbol.toUpperCase());
    }

    /**
     * 모든 폴링 중지 (cleanup)
     */
    stopAll() {
        this.timers.forEach((timer) => clearInterval(timer));
        this.timers.clear();
        this.subscribers.clear();
        this.isPolling.clear();
        this.failureCounts.clear();
        this.lastPrices.clear();
    }
}

// 싱글톤 인스턴스 (전역 공유)
let globalPoller: PricePoller | null = null;

/**
 * 전역 폴러 인스턴스 가져오기
 */
export function getGlobalPoller(): PricePoller {
    if (!globalPoller) {
        globalPoller = new PricePoller();
    }
    return globalPoller;
}

/**
 * 간편 구독 함수 (전역 폴러 사용)
 */
export function subscribePrices(
    symbols: string[],
    onPrice: (data: PriceUpdate) => void,
    options?: PollingOptions
): { close: () => void } {
    const poller = getGlobalPoller();

    // 배치 조회가 효율적 (심볼이 3개 이상일 때)
    if (symbols.length >= 3) {
        return poller.subscribeBatch(symbols, onPrice, options);
    }

    return poller.subscribe(symbols, onPrice, options);
}
