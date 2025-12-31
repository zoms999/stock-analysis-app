export interface CandleData {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

type YahooCacheEntry = {
  expiresAt: number;
  data: CandleData[];
};

// ✅ 클라이언트(브라우저)에서 동일 심볼/interval 중복 호출을 합치고(TTL 캐시) 429를 완화
const YAHOO_TTL_MS = 60_000;
const yahooCache = new Map<string, YahooCacheEntry>();
const yahooInFlight = new Map<string, Promise<CandleData[]>>();

export async function fetchYahooCandles(symbol: string = "AAPL", interval: string = "1d"): Promise<CandleData[]> {
  try {
    const key = `${symbol}|${interval}`;
    const now = Date.now();
    const cached = yahooCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const inFlight = yahooInFlight.get(key);
    if (inFlight) {
      return await inFlight;
    }

    // Use proxy route
    const url = `/api/yahoo/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}`;

    const promise = (async () => {
      const response = await fetch(url, {
        // 브라우저 캐시 힌트(서버에서도 Cache-Control을 설정함)
        cache: "force-cache",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Yahoo API Error (${response.status}):`, errorData);

        // Throw error with user-friendly message if available
        const errorMessage = errorData.error || `Yahoo API Error: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        console.error("Yahoo API returned invalid format:", data);
        throw new Error("잘못된 데이터 형식입니다.");
      }

      // 캐시 저장
      yahooCache.set(key, { expiresAt: Date.now() + YAHOO_TTL_MS, data });
      return data as CandleData[];
    })();

    yahooInFlight.set(key, promise);
    return await promise.finally(() => yahooInFlight.delete(key));

  } catch (error) {
    console.error("Failed to fetch yahoo candles:", error);
    // Re-throw to let the component handle it
    throw error;
  }
}
