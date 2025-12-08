
import { CandleData } from "./upbit";

export async function fetchFinnhubCandles(symbol: string = "AAPL", resolution: string = "D"): Promise<CandleData[]> {
  try {
    // Use proxy route to avoid CORS issues and hide API key
    const url = `/api/finnhub/candles?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Finnhub API Error (${response.status}):`, errorData);
        throw new Error(`Finnhub API Error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.s === "no_data") {
        console.warn(`Finnhub returned no data for ${symbol}`);
        return [];
    }
    
    if (data.s !== "ok") {
        console.error("Finnhub error status:", data.s);
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

    return uniqueCandles;

  } catch (error) {
    console.error("Failed to fetch finnhub candles:", error);
    return [];
  }
}

// Helper to search symbols (Optional for future)
export async function searchFinnhubSymbol(query: string) {
    // ... implementation for search
}
