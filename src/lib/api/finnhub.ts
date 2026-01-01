
import { CandleData } from "./upbit";
import { fetchYahooCandles } from "./yahoo";

type FinnhubCacheEntry = {
  expiresAt: number;
  data: CandleData[];
};

// ✅ 클라이언트에서 중복 요청 합치기 + TTL 캐시 (메인에서 카드/히어로 차트 다중 호출 최적화)
const FINNHUB_TTL_MS = 60_000;
const finnhubCache = new Map<string, FinnhubCacheEntry>();
const finnhubInFlight = new Map<string, Promise<CandleData[]>>();

export async function fetchFinnhubCandles(symbol: string = "AAPL", resolution: string = "D"): Promise<CandleData[]> {
  try {
    const key = `${symbol}|${resolution}`;
    const now = Date.now();
    const cached = finnhubCache.get(key);
    if (cached && cached.expiresAt > now) return cached.data;
    const inflight = finnhubInFlight.get(key);
    if (inflight) return await inflight;

    // Use proxy route to avoid CORS issues and hide API key
    const url = `/api/finnhub/candles?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}`;
    
    const promise = (async () => {
      const response = await fetch(url, { cache: "force-cache" });
    
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // 401/403은 키/플랜 문제 가능성이 높아 "에러 스팸" 대신 조용히 처리
        if (response.status === 401 || response.status === 403) {
          console.warn(`Finnhub Forbidden (${response.status}) for ${symbol}. Falling back or returning empty.`);
          return [];
        }
        console.error(`Finnhub API Error (${response.status}):`, errorData);
        throw new Error(`Finnhub API Error: ${response.statusText}`);
      }

      const data = await response.json();

      // Finnhub가 에러를 JSON으로 주는 케이스 방어
      if (data?.error) {
        console.warn("Finnhub returned error payload:", data.error);
        return [];
      }

      if (data.s === "no_data") {
        console.warn(`Finnhub returned no data for ${symbol}`);
        return [];
      }
    
      if (data.s !== "ok") {
        console.warn("Finnhub error status:", data.s);
        return [];
      }

      // Transform to Lightweight Charts format
      // Finnhub returns arrays for each property { c: [], h: [], ... }
      const length = data.t?.length || 0;
      const candles: CandleData[] = [];

      for (let i = 0; i < length; i++) {
        candles.push({
            time: data.t[i], // Finnhub returns unix timestamp (seconds)
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: data.c[i],
        });
      }

      // Deduplicate and sort just in case
      const uniqueCandles = candles.filter((v, i, a) => a.findIndex(t => t.time === v.time) === i);
      uniqueCandles.sort((a, b) => (a.time as number) - (b.time as number));

      finnhubCache.set(key, { expiresAt: Date.now() + FINNHUB_TTL_MS, data: uniqueCandles });
      return uniqueCandles;
    })();

    finnhubInFlight.set(key, promise);
    return await promise.finally(() => finnhubInFlight.delete(key));

  } catch (error) {
    // ✅ 메인만 Finnhub로 전환한 상황에서, Finnhub가 막힐 때 화면이 깨지지 않게 Yahoo로 폴백(캐시/디듀프는 yahoo.ts에 있음)
    try {
      // resolution -> yahoo interval 매핑(대략)
      let yahooInterval = "1d";
      if (resolution === "M") yahooInterval = "1mo";
      if (resolution === "W") yahooInterval = "1wk";
      if (resolution === "D") yahooInterval = "1d";
      if (resolution === "60") yahooInterval = "1h";
      if (resolution === "1") yahooInterval = "1m";
      return await fetchYahooCandles(symbol, yahooInterval);
    } catch {
      return [];
    }
  }
}

// Helper to search symbols (Optional for future)
export async function searchFinnhubSymbol(query: string) {
    // ... implementation for search
}
