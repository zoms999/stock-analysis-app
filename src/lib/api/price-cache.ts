/**
 * 서버 사이드 가격 캐싱 시스템
 * 
 * Yahoo Finance Rate Limit 방어를 위한 필수 컴포넌트
 * - 사용자 1만 명이 접속해도 Yahoo로 가는 요청은 10초에 1번만
 * - 메모리 기반 캐싱 (서버 재시작 시 초기화)
 */

import YahooFinance from 'yahoo-finance2';

// ✅ Yahoo Finance 인스턴스 생성 (v2.12+ 필수)
const yahooFinance = new YahooFinance();

interface CachedPrice {
    price: number;
    previousClose?: number;
    change?: number;
    changePercent?: number;
    timestamp: number;
}

interface CachedCandles {
    candles: any[];
    timestamp: number;
}

// 가격 캐시 (현재가)
const priceCache = new Map<string, CachedPrice>();

// 캔들 캐시 (차트 데이터)
const candleCache = new Map<string, CachedCandles>();

// 캐시 유효 시간
const PRICE_CACHE_DURATION = 10000; // 10초 (실시간 가격)
const CANDLE_CACHE_DURATION = 60000; // 60초 (차트 데이터)

/**
 * Yahoo Finance 심볼 정규화
 */
export function normalizeSymbolForYahoo(symbol: string): string {
    const s = symbol.trim().toUpperCase();

    // 1. 업비트 코인 (KRW-BTC) → 지원 안 함
    if (s.includes('KRW-')) {
        throw new Error('Upbit symbols (KRW-*) not supported by Yahoo, use Upbit API');
    }

    // 2. 한국 주식 (6자리 숫자) → .KS 추가
    if (/^\d{6}$/.test(s)) {
        return `${s}.KS`; // 코스피
        // TODO: 코스닥 구분 필요 시 .KQ 로직 추가
    }

    // 3. KRX 프리픽스 제거
    if (s.startsWith('KRX:') || s.startsWith('XKRX:')) {
        const code = s.replace(/^(KRX|XKRX):/, '');
        if (/^\d{6}$/.test(code)) {
            return `${code}.KS`;
        }
    }

    // 4. 코인 심볼 정규화
    // ETH-USD, BTC-USD 등은 그대로 사용
    // 하지만 일부 코인은 다른 형식일 수 있음
    if (s.includes('-USD')) {
        // 이미 올바른 형식
        return s;
    }

    // 5. 코인 심볼에 -USD 추가 (ETH → ETH-USD)
    const cryptoSymbols = ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'ADA', 'AVAX', 'MATIC', 'DOT', 'LINK', 'ATOM'];
    if (cryptoSymbols.includes(s)) {
        return `${s}-USD`;
    }

    // 6. 미국 주식 등은 그대로
    return s;
}

/**
 * 캐시된 현재가 조회 (Rate Limit 방어)
 * 
 * @param symbol 원본 심볼 (예: "AAPL", "005930", "BTC-USD")
 * @returns 가격 정보 또는 null
 */
export async function getCachedPrice(symbol: string): Promise<CachedPrice | null> {
    const now = Date.now();
    const cacheKey = symbol.toUpperCase();

    // 1. 캐시 확인
    const cached = priceCache.get(cacheKey);
    if (cached && (now - cached.timestamp < PRICE_CACHE_DURATION)) {
        return cached;
    }

    try {
        // 2. Yahoo 심볼로 변환
        const yahooSymbol = normalizeSymbolForYahoo(symbol);

        // 3. Yahoo Finance 호출
        const quote = await yahooFinance.quote(yahooSymbol);

        if (!quote || !quote.regularMarketPrice) {
            console.warn(`[PriceCache] No price data for ${symbol} (${yahooSymbol})`);
            return null;
        }

        // 4. 캐시 업데이트
        const priceData: CachedPrice = {
            price: quote.regularMarketPrice,
            previousClose: quote.regularMarketPreviousClose,
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent,
            timestamp: now,
        };

        priceCache.set(cacheKey, priceData);

        return priceData;

    } catch (error) {
        console.error(`[PriceCache] Error fetching price for ${symbol}:`, error);
        return null;
    }
}

/**
 * 캐시된 캔들 데이터 조회 (차트용)
 * 
 * @param symbol 원본 심볼
 * @param interval 간격 (1d, 1wk, 1mo 등)
 * @returns 캔들 배열 또는 null
 */
export async function getCachedCandles(
    symbol: string,
    interval: '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1wk' | '1mo' = '1d'
): Promise<any[] | null> {
    const now = Date.now();
    const cacheKey = `${symbol.toUpperCase()}:${interval}`;

    // 1. 캐시 확인
    const cached = candleCache.get(cacheKey);
    if (cached && (now - cached.timestamp < CANDLE_CACHE_DURATION)) {
        console.log(`[PriceCache] ✅ Cache hit for ${cacheKey}`);
        return cached.candles;
    }

    try {
        // 2. Yahoo 심볼로 변환
        const yahooSymbol = normalizeSymbolForYahoo(symbol);
        console.log(`[PriceCache] 📊 Fetching candles: ${symbol} → ${yahooSymbol} (${interval})`);

        // 3. 기간 설정 (최근 200일 또는 적절한 기간)
        const period1 = new Date();
        period1.setDate(period1.getDate() - 200); // 200일 전

        // 4. Yahoo Finance 호출
        const result = await yahooFinance.chart(yahooSymbol, {
            period1: period1.toISOString().split('T')[0],
            interval: interval,
        });

        if (!result || !result.quotes || result.quotes.length === 0) {
            console.error(`[PriceCache] ❌ No candle data for ${symbol} (${yahooSymbol})`);
            console.error(`[PriceCache] Result:`, JSON.stringify(result, null, 2));
            return null;
        }

        console.log(`[PriceCache] ✅ Fetched ${result.quotes.length} candles for ${yahooSymbol}`);

        // 5. Lightweight Charts 형식으로 변환
        const candles = result.quotes.map((q: any) => {
            // 날짜 형식 변환
            let time: string | number;
            if (interval === '1d' || interval === '1wk' || interval === '1mo') {
                // 일봉/주봉/월봉: YYYY-MM-DD 문자열
                time = q.date.toISOString().split('T')[0];
            } else {
                // 분봉/시간봉: Unix timestamp (초)
                time = Math.floor(q.date.getTime() / 1000);
            }

            return {
                time,
                open: q.open,
                high: q.high,
                low: q.low,
                close: q.close,
                volume: q.volume,
            };
        });

        // 6. 캐시 업데이트
        candleCache.set(cacheKey, {
            candles,
            timestamp: now,
        });

        return candles;

    } catch (error) {
        console.error(`[PriceCache] Error fetching candles for ${symbol}:`, error);
        return null;
    }
}

/**
 * 배치로 여러 심볼의 가격 조회 (효율적)
 * 
 * @param symbols 심볼 배열
 * @returns Map<symbol, price>
 */
export async function getBatchPrices(symbols: string[]): Promise<Map<string, CachedPrice>> {
    const results = new Map<string, CachedPrice>();

    // 병렬로 조회 (각각 캐시 확인)
    const promises = symbols.map(async (symbol) => {
        const price = await getCachedPrice(symbol);
        if (price) {
            results.set(symbol.toUpperCase(), price);
        }
    });

    await Promise.all(promises);

    return results;
}

/**
 * 캐시 수동 초기화 (테스트/디버그용)
 */
export function clearCache() {
    priceCache.clear();
    candleCache.clear();
    console.log('[PriceCache] Cache cleared');
}

/**
 * 캐시 통계 조회 (모니터링용)
 */
export function getCacheStats() {
    return {
        priceCache: {
            size: priceCache.size,
            keys: Array.from(priceCache.keys()),
        },
        candleCache: {
            size: candleCache.size,
            keys: Array.from(candleCache.keys()),
        },
    };
}
