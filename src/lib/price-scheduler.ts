import yahooFinance from "yahoo-finance2";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function log(...args: any[]) {
  console.log(`[PriceScheduler]`, ...args);
}

function errorLog(...args: any[]) {
  console.error(`[PriceScheduler]`, ...args);
}

// Yahoo Symbol Normalizer
function normalizeSymbolForYahoo(symbol: string) {
    let s = symbol.trim();
    // KRX: 005930:KRX -> 005930.KS
    const mKr = s.match(/^(KRX|XKRX)\s*:\s*(\d{6})$/i);
    if (mKr) return `${mKr[2]}.KS`;
    
    // 6자리 숫자만 있으면 .KS 가정
    if (/^\d{6}$/.test(s)) return `${s}.KS`;
    
    // Crypto: BTC/USD -> BTC-USD
    if (s.includes("/")) return s.replace("/", "-");
    
    // Crypto fallbacks for common coins if no pair specifier
    const isCrypto = ["BTC", "ETH", "XRP", "DOGE", "SOL", "ADA", "DOT"].includes(s.toUpperCase());
    if (isCrypto) return `${s.toUpperCase()}-USD`;

    // Default
    return s;
}

/**
 * Fetch current price for a single symbol using Yahoo Finance
 */
async function fetchYahooPrice(symbol: string): Promise<number | null> {
    try {
        const yahooSymbol = normalizeSymbolForYahoo(symbol);
        
        // Safely get client
        const yf = typeof yahooFinance === 'function' ? new (yahooFinance as any)() : yahooFinance;

        const quote = await yf.quote(yahooSymbol);
        
        // Prefer regularMarketPrice, fallback to close/price
        const price = quote.regularMarketPrice ?? quote.ask ?? quote.bid ?? null;
        return price;
    } catch (e: any) {
        errorLog(`Failed to fetch Yahoo price for ${symbol}: ${e.message}`);
        return null;
    }
}

export async function updateMarketPrices() {
  log("Starting market price update (Yahoo Finance)...");

  // 1. Get targets (WAITING posts)
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, ticker_symbol, entry_price, prediction_type")
    .eq("prediction_status", "WAITING");

  if (error) {
    errorLog("Failed to fetch posts", error);
    return { success: false, error };
  }

  const targets = posts || [];
  if (targets.length === 0) {
    log("No WAITING posts to update.");
    return { success: true, count: 0 };
  }

  // 2. Extract unique symbols
  const uniqueSymbols = Array.from(new Set(targets.map((t) => t.ticker_symbol)));
  log(`Targeting ${uniqueSymbols.length} unique tickers:`, uniqueSymbols);

  const priceMap = new Map<string, number>();

  // 3. Fetch Prices (Chunked for safety)
  const CHUNK_SIZE = 5;
  for (let i = 0; i < uniqueSymbols.length; i += CHUNK_SIZE) {
      const chunk = uniqueSymbols.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(async (sym) => {
          const price = await fetchYahooPrice(sym);
          if (price !== null) {
              priceMap.set(sym, price);
          }
      }));
  }

  log(`Received ${priceMap.size} prices from Yahoo Finance.`);

  if (priceMap.size === 0) {
      // Just return success with 0 count if everything failed or no prices found
      // This prevents the whole cron from failing
      return { success: true, count: 0, message: "No prices fetched from Yahoo" };
  }

  // 4. Update market_prices table
  const records = [];
  const now = new Date().toISOString();

  for (const [symbol, price] of priceMap.entries()) {
    records.push({
      ticker_symbol: symbol,
      price: price,
      source: "yahoo",
      recorded_at: now,
    });
  }

  log(`Prepared ${records.length} records for insertion.`);

  if (records.length > 0) {
    const { error: insertError } = await supabase.from("market_prices").insert(records);
    if (insertError) {
      errorLog("Failed to insert market_prices", insertError);
      return { success: false, error: insertError };
    }
  }

  log("Market prices updated successfully.");
  return { success: true, count: records.length };
}
