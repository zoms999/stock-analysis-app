import { fetchYahooCandles, CandleData as YahooCandleData } from "./yahoo";
import { fetchUpbitCandles, CandleData as UpbitCandleData } from "./upbit";
import { fetchFinnhubCandles } from "./finnhub";
import { fetchTwelveDataCandles, CandleData as TwelveDataCandleData } from "./twelvedata";

export type PriceSource = "twelvedata" | "yahoo" | "upbit" | "finnhub";

interface PriceCache {
  [key: string]: {
    price: number;
    timestamp: number;
  };
}

const priceCache: PriceCache = {};
const CACHE_DURATION = 60000; // 1 minute cache

/**
 * Get current price for a symbol
 */
export async function getCurrentPrice(
  symbol: string,
  source: PriceSource = "twelvedata"
): Promise<number | null> {
  const cacheKey = `${source}:${symbol}`;
  const now = Date.now();

  // Check cache
  if (priceCache[cacheKey] && now - priceCache[cacheKey].timestamp < CACHE_DURATION) {
    return priceCache[cacheKey].price;
  }

  try {
    let price: number | null = null;

    if (source === "twelvedata") {
      const candles = await fetchTwelveDataCandles(symbol, "1d");
      if (candles && candles.length > 0) {
        price = candles[candles.length - 1].close;
      }
    } else if (source === "yahoo") {
      const candles = await fetchYahooCandles(symbol, "1d");
      if (candles && candles.length > 0) {
        price = candles[candles.length - 1].close;
      }
    } else if (source === "upbit") {
      const candles = await fetchUpbitCandles(symbol, 1);
      if (candles && candles.length > 0) {
        price = candles[candles.length - 1].close;
      }
    } else if (source === "finnhub") {
      const candles = await fetchFinnhubCandles(symbol, "D");
      if (candles && candles.length > 0) {
        price = candles[candles.length - 1].close;
      }
    }

    // Cache the result
    if (price !== null) {
      priceCache[cacheKey] = {
        price,
        timestamp: now,
      };
    }

    return price;
  } catch (error) {
    console.error(`Error fetching price for ${symbol} from ${source}:`, error);
    return null;
  }
}

/**
 * Get multiple prices efficiently
 */
export async function getBatchPrices(
  symbols: Array<{ symbol: string; source: PriceSource }>
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  // Fetch all prices in parallel
  const promises = symbols.map(async ({ symbol, source }) => {
    const price = await getCurrentPrice(symbol, source);
    if (price !== null) {
      results.set(`${source}:${symbol}`, price);
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Clear price cache (useful for testing or manual refresh)
 */
export function clearPriceCache() {
  Object.keys(priceCache).forEach((key) => delete priceCache[key]);
}
