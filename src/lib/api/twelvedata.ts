export interface CandleData {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

type CacheEntry = {
  expiresAt: number;
  data: CandleData[];
};

// ✅ 클라이언트(브라우저)에서 동일 심볼/interval 중복 호출을 합치고(TTL 캐시) 요청량을 완화
const TWELVEDATA_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CandleData[]>>();

/**
 * Twelve Data 캔들 데이터를 내부 프록시 라우트(`/api/twelvedata/candles`)로부터 가져옵니다.
 * interval 예시: 1m, 5m, 15m, 30m, 1h, 1d, 1wk, 1mo
 */
export async function fetchTwelveDataCandles(symbol: string = "AAPL", interval: string = "1d"): Promise<CandleData[]> {
  const s = symbol?.trim();
  const itv = interval?.trim();
  const key = `${s}|${itv}`;

  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.data;

  const pending = inFlight.get(key);
  if (pending) return await pending;

  const promise = (async () => {
    const url = `/api/twelvedata/candles?symbol=${encodeURIComponent(s)}&interval=${encodeURIComponent(itv)}`;
    const res = await fetch(url, { cache: "force-cache" });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const msg = (errorData as any)?.error || `Twelve Data API Error: ${res.statusText}`;
      throw new Error(msg);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error("잘못된 데이터 형식입니다.");
    }

    const candles = data as CandleData[];
    cache.set(key, { expiresAt: Date.now() + TWELVEDATA_TTL_MS, data: candles });
    return candles;
  })();

  inFlight.set(key, promise);
  return await promise.finally(() => inFlight.delete(key));
}


