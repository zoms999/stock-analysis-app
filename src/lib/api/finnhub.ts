
import { CandleData } from "./upbit";

export async function fetchFinnhubCandles(symbol: string = "AAPL", resolution: string = "D"): Promise<CandleData[]> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!apiKey) {
      console.error("Finnhub API Key is missing");
      return [];
    }

    // Finnhub Candle Endpoint
    // resolution: '1', '5', '15', '30', '60', 'D', 'W', 'M'
    // For free plan, intraday data might be delayed or unavailable for some symbols, but 'D' is usually safe.
    // We need 'from' and 'to' timestamps. Let's fetch last 200 days/periods.
    
    const now = Math.floor(Date.now() / 1000);
    const from = now - (200 * 24 * 60 * 60); // Approx 200 days ago for Daily

    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${now}&token=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Finnhub API Error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.s === "no_data") {
        console.warn("Finnhub returned no data");
        return [];
    }
    
    if (data.s !== "ok") {
        console.error("Finnhub error status:", data.s);
        return [];
    }

    // Transform to Lightweight Charts format
    // Finnhub returns arrays for each property { c: [], h: [], ... }
    const length = data.t.length;
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
