import yahooFinance from "yahoo-finance2";
import { createClient } from "@supabase/supabase-js";
import { fetchKisPrice } from "./api/kis";

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
    
    // 6자리 숫자만 있으면 .KS로 변환 (KIS에서 실패하면 Yahoo 시도용, 혹은 로직 분기용)
    // 하지만 이 함수는 Yahoo 전용이므로 Yahoo 포맷으로 맞춤
    if (/^\d{6}$/.test(s)) return `${s}.KS`;
    
    // Crypto: BTC/USD -> BTC-USD
    if (s.includes("/")) return s.replace("/", "-");
    
    // Crypto fallbacks
    const isCrypto = ["BTC", "ETH", "XRP", "DOGE", "SOL", "ADA", "DOT"].includes(s.toUpperCase());
    if (isCrypto) return `${s.toUpperCase()}-USD`;

    // Default
    return s;
}

/**
 * Fetch current price using Yahoo Finance
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
        // errorLog(`Failed to fetch Yahoo price for ${symbol}: ${e.message}`);
        return null;
    }
}

/**
 * Main Scheduler Function
 */
export async function updateMarketPrices() {
  log("Starting market price update...");

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
  log(`Targeting ${uniqueSymbols.length} unique tickers.`);

  // 3. Classify Symbols (KIS vs Yahoo)
  const kisSymbols: string[] = [];
  const yahooSymbols: string[] = [];

  for (const sym of uniqueSymbols) {
    const s = sym.trim();
    // KIS 조건: "KRX:123456" 형태 또는 "123456" 6자리 숫자
    if (/^(KRX|XKRX)\s*:\s*\d{6}$/i.test(s) || /^\d{6}$/.test(s)) {
      kisSymbols.push(s);
    } else {
      yahooSymbols.push(s);
    }
  }

  log(`Source calc: KIS=${kisSymbols.length}, Yahoo=${yahooSymbols.length}`);

  const priceMap = new Map<string, number>();

  // 4a. Fetch Yahoo Prices (Chunked)
  const YAHOO_CHUNK_SIZE = 5;
  if (yahooSymbols.length > 0) {
    for (let i = 0; i < yahooSymbols.length; i += YAHOO_CHUNK_SIZE) {
        const chunk = yahooSymbols.slice(i, i + YAHOO_CHUNK_SIZE);
        await Promise.all(chunk.map(async (sym) => {
            const price = await fetchYahooPrice(sym);
            if (price !== null) {
                priceMap.set(sym, price);
            }
        }));
    }
  }

  // 4b. Fetch KIS Prices (Sequential or small concurrency due to strict API limits usually)
  // KIS API often has lower rate limits (e.g. 20 req/sec is fine, but let's be safe with chunking)
  const KIS_CHUNK_SIZE = 2; 
  if (kisSymbols.length > 0) {
    for (let i = 0; i < kisSymbols.length; i += KIS_CHUNK_SIZE) {
        const chunk = kisSymbols.slice(i, i + KIS_CHUNK_SIZE);
        await Promise.all(chunk.map(async (sym) => {
             // KIS API Integration
             const price = await fetchKisPrice(sym);
             if (price !== null) {
                 priceMap.set(sym, price);
             }
        }));
        // Optional delay to respect rate limits if needed
        if (i + KIS_CHUNK_SIZE < kisSymbols.length) {
            await new Promise(r => setTimeout(r, 200)); 
        }
    }
  }

  log(`Collected ${priceMap.size} prices total.`);

  if (priceMap.size === 0) {
      return { success: true, count: 0, message: "No prices fetched from any source" };
  }

  // 5. Update market_prices table
  const records = [];
  const now = new Date().toISOString();

  for (const [symbol, price] of priceMap.entries()) {
    records.push({
      ticker_symbol: symbol,
      price: price,
      recorded_at: now,
    });
  }

  if (records.length > 0) {
    const { error: insertError } = await supabase.from("market_prices").insert(records);
    if (insertError) {
      errorLog("Failed to insert market_prices", insertError);
      return { success: false, error: insertError };
    }
  }

  log(`Inserted ${records.length} price records successfully.`);
  return { success: true, count: records.length };
}
