export interface CandleData {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Fetch candle data from market_prices database
 */
export async function fetchMarketPricesCandles(
  symbol: string,
  interval: string = '1d',
  limit: number = 100
): Promise<CandleData[]> {
  try {
    const url = `/api/market-prices/candles?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
    const res = await fetch(url);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch market prices: ${res.statusText}`);
    }

    const data = await res.json();
    return data.candles || [];
  } catch (error) {
    console.error('[Market Prices] Fetch error:', error);
    return [];
  }
}


export type TwelvePriceEvent = {
  event: "price";
  symbol: string;
  price: string;
  timestamp: number;
  volume?: string;
};

type CacheEntry = {
  expiresAt: number;
  data: CandleData[];
};

// ✅ 클라이언트(브라우저)에서 동일 심볼/interval 중복 호출을 합치고(TTL 캐시) 요청량을 완화
const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CandleData[]>>();

/**
 * 캔들 데이터를 내부 REST 프록시(`/api/yahoo`)로부터 가져옵니다.
 * (기존 함수명 호환성을 위해 유지: fetchTwelveDataCandles)
 */
export async function fetchTwelveDataCandles(symbol: string, interval: string): Promise<CandleData[]> {
  const s0 = symbol?.trim();
  const itv = interval?.trim();

  const key = `${s0}|${itv}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.data;

  const pending = inFlight.get(key);
  if (pending) return await pending;

  const promise = (async () => {
    // Yahoo Proxy Route 호출
    const url = `/api/yahoo?symbol=${encodeURIComponent(s0)}&interval=${encodeURIComponent(itv)}`;
    const res = await fetch(url);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.details || `Chart Data Error: ${res.statusText}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("잘못된 데이터 형식입니다.");

    const candles = data as CandleData[];
    cache.set(key, { expiresAt: Date.now() + TTL_MS, data: candles });
    return candles;
  })();

  inFlight.set(key, promise);
  return await promise.finally(() => inFlight.delete(key));
}

/**
 * Twelve Data 실시간 가격 스트림(SSE) 구독.
 * - 서버가 Twelve Data WebSocket에 붙고, 클라이언트에는 SSE(EventSource)로 중계합니다.
 * - API 키는 브라우저로 노출되지 않습니다.
 */
export function subscribeTwelveDataPrices(
  symbols: string[],
  onPrice: (msg: TwelvePriceEvent) => void,
  onError?: (err: unknown) => void
) {
  const normalized = Array.from(
    new Set(
      symbols
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
    )
  );

  if (normalized.length === 0) return { close: () => {} };

  const url = `/api/twelvedata/stream?symbols=${encodeURIComponent(normalized.join(","))}`;
  const es = new EventSource(url);

  const handlePrice = (ev: MessageEvent) => {
    try {
      const data = JSON.parse(String(ev.data)) as TwelvePriceEvent;
      if (data?.event === "price" && typeof data.symbol === "string") {
        onPrice(data);
      }
    } catch (e) {
      onError?.(e);
    }
  };

  const handleError = (e: Event) => {
    onError?.(e);
  };

  es.addEventListener("price", handlePrice as any);
  es.addEventListener("error", handleError as any);

  return {
    close: () => {
      es.removeEventListener("price", handlePrice as any);
      es.removeEventListener("error", handleError as any);
      es.close();
    },
  };
}

// ─────────────────────────────────────────────────────────────
// 통합 실시간 스트림 (TwelveData + KIS 겸용)
// ─────────────────────────────────────────────────────────────

/**
 * 통합 실시간 가격 이벤트
 * - TwelveData와 KIS 모두 동일한 형식으로 전달
 */
export type UnifiedPriceEvent = {
  event: "price";
  symbol: string;
  price: number;
  change?: number;
  change_percent?: number;
  volume?: number;
  timestamp?: string | number;
  provider: "twelvedata" | "kis";
};

/**
 * 통합 실시간 가격 스트림(SSE) 구독.
 *
 * 종목코드에 따라 자동으로 적절한 데이터 소스로 라우팅합니다:
 * - 국내주식 (6자리 숫자, KRX:XXXXXX): KIS Developers WebSocket
 * - 해외주식/암호화폐/외환: TwelveData WebSocket
 *
 * @param symbols 종목 심볼 배열 (예: ["005930", "AAPL", "BTC-USD"])
 * @param onPrice 가격 이벤트 콜백
 * @param onError 에러 콜백
 * @param onStatus 상태 이벤트 콜백 (연결/구독/재연결 등)
 */
export function subscribeUnifiedPrices(
  symbols: string[],
  onPrice: (msg: UnifiedPriceEvent) => void,
  onError?: (err: unknown) => void,
  onStatus?: (status: Record<string, unknown>) => void
) {
  const normalized = Array.from(
    new Set(
      symbols
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
    )
  );

  if (normalized.length === 0) return { close: () => {} };

  // 통합 스트림 API 사용
  const url = `/api/stream?symbols=${encodeURIComponent(normalized.join(","))}`;
  const es = new EventSource(url);

  const handlePrice = (ev: MessageEvent) => {
    try {
      const data = JSON.parse(String(ev.data));
      // price 필드를 숫자로 정규화
      const price = typeof data.price === "string" ? parseFloat(data.price) : data.price;
      const event: UnifiedPriceEvent = {
        event: "price",
        symbol: data.symbol,
        price,
        change: data.change,
        change_percent: data.change_percent,
        volume: data.volume,
        timestamp: data.timestamp,
        provider: data.provider ?? "twelvedata",
      };
      onPrice(event);
    } catch (e) {
      onError?.(e);
    }
  };

  const handleStatus = (ev: MessageEvent) => {
    try {
      const data = JSON.parse(String(ev.data));
      onStatus?.(data);
    } catch {
      // ignore
    }
  };

  const handleError = (e: Event) => {
    onError?.(e);
  };

  es.addEventListener("price", handlePrice as EventListener);
  es.addEventListener("status", handleStatus as EventListener);
  es.addEventListener("error", handleError as EventListener);

  return {
    close: () => {
      es.removeEventListener("price", handlePrice as EventListener);
      es.removeEventListener("status", handleStatus as EventListener);
      es.removeEventListener("error", handleError as EventListener);
      es.close();
    },
  };
}

/**
 * KIS 전용 실시간 가격 스트림(SSE) 구독.
 * - 국내주식만 구독할 때 사용
 *
 * @param symbols 6자리 종목코드 배열 (예: ["005930", "000660"])
 */
export function subscribeKisPrices(
  symbols: string[],
  onPrice: (msg: UnifiedPriceEvent) => void,
  onError?: (err: unknown) => void,
  onStatus?: (status: Record<string, unknown>) => void
) {
  const normalized = Array.from(
    new Set(
      symbols
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
    )
  );

  if (normalized.length === 0) return { close: () => {} };

  const url = `/api/kis/stream?symbols=${encodeURIComponent(normalized.join(","))}`;
  const es = new EventSource(url);

  const handlePrice = (ev: MessageEvent) => {
    try {
      const data = JSON.parse(String(ev.data));
      const price = typeof data.price === "string" ? parseFloat(data.price) : data.price;
      const event: UnifiedPriceEvent = {
        event: "price",
        symbol: data.symbol,
        price,
        change: data.change,
        change_percent: data.change_percent,
        volume: data.volume,
        timestamp: data.timestamp,
        provider: "kis",
      };
      onPrice(event);
    } catch (e) {
      onError?.(e);
    }
  };

  const handleStatus = (ev: MessageEvent) => {
    try {
      const data = JSON.parse(String(ev.data));
      onStatus?.(data);
    } catch {
      // ignore
    }
  };

  const handleError = (e: Event) => {
    onError?.(e);
  };

  es.addEventListener("price", handlePrice as EventListener);
  es.addEventListener("status", handleStatus as EventListener);
  es.addEventListener("error", handleError as EventListener);

  return {
    close: () => {
      es.removeEventListener("price", handlePrice as EventListener);
      es.removeEventListener("status", handleStatus as EventListener);
      es.removeEventListener("error", handleError as EventListener);
      es.close();
    },
  };
}
