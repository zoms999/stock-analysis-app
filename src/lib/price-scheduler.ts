import YahooFinance from "yahoo-finance2";
import { createClient } from "@supabase/supabase-js";
import { fetchKisPrice } from "./api/kis";

// ✅ Yahoo Finance 인스턴스 생성 (v2.12+ 필수)
const yahooFinance = new YahooFinance();

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
 * Fetch current price using Binance (Public API)
 * Fallback for Crypto to avoid Yahoo issues on serverless
 */
async function fetchBinancePrice(symbol: string): Promise<number | null> {
  try {
    // Simple mapping: BTC -> BTCUSDT
    let pair = symbol.toUpperCase();
    // Remove non-alphanumeric if any, though usually just ticker
    if (pair === "BTC=F") pair = "BTC"; // Yahoo future -> Spot

    // Map common coins to USDT
    const map: { [key: string]: string } = {
      "BTC": "BTCUSDT",
      "ETH": "ETHUSDT",
      "XRP": "XRPUSDT",
      "DOGE": "DOGEUSDT",
      "SOL": "SOLUSDT",
      "ADA": "ADAUSDT",
      "DOT": "DOTUSDT",
      "BNB": "BNBUSDT"
    };

    const binanceSymbol = map[pair] || `${pair}USDT`;

    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
    if (!res.ok) return null;

    const data = await res.json();
    return parseFloat(data.price);
  } catch (e) {
    // console.error(`Binance fetch failed for ${symbol}`, e);
    return null;
  }
}

/**
 * Fetch current price using Yahoo Finance
 */
/**
 * Fetch current price using Yahoo Finance
 */
async function fetchYahooPrice(symbol: string): Promise<number | null> {
  try {
    const yahooSymbol = normalizeSymbolForYahoo(symbol);

    // Instantiate YahooFinance
    const yf = new yahooFinance({ suppressNotices: ['ripHistorical'] });

    const quote = await yf.quote(yahooSymbol);

    // Prefer regularMarketPrice, fallback to close/price
    const price = quote.regularMarketPrice ?? quote.ask ?? quote.bid ?? null;
    return price;
  } catch (e: any) {
    errorLog(`Failed to fetch Yahoo price for ${symbol}: ${e.message}`);
    return null;
  }
}

/**
 * Main Scheduler Function
 */
export async function updateMarketPrices() {
  log("Starting market price update...");

  // 1. Get targets (ALL active assets)
  // Modified to sync ALL assets that are being tracked, not just those with WAITING posts.
  const { data: assets, error } = await supabase
    .from("assets")
    .select("symbol");

  if (error) {
    errorLog("Failed to fetch assets", error);
    return { success: false, error };
  }

  const targets = assets || [];
  if (targets.length === 0) {
    log("No assets to update.");
    return { success: true, count: 0 };
  }

  // 2. Extract unique symbols
  const uniqueSymbols = Array.from(new Set(targets.map((t) => t.symbol)));
  log(`Targeting ${uniqueSymbols.length} unique tickers.`);

  // 3. Classify Symbols (KIS vs Crypto vs Yahoo)
  const kisSymbols: string[] = [];
  const cryptoSymbols: string[] = [];
  const yahooSymbols: string[] = [];

  const CRYPTO_LIST = ["BTC", "ETH", "XRP", "DOGE", "SOL", "ADA", "DOT", "BNB", "BTC=F"];

  for (const sym of uniqueSymbols) {
    const s = sym.trim();
    // KIS 조건 (KRX prefix or suffix or pure digits)
    // Matches: "KRX:005930", "005930:KRX", "005930"
    if (/^(KRX|XKRX)\s*:\s*\d{6}$/i.test(s) || /^\d{6}\s*:\s*(KRX|XKRX)$/i.test(s) || /^\d{6}$/.test(s)) {
      kisSymbols.push(s);
    }
    // Crypto 조건
    else if (CRYPTO_LIST.includes(s.toUpperCase()) || s.includes("USDT")) {
      cryptoSymbols.push(s);
    }
    else {
      yahooSymbols.push(s);
    }
  }

  log(`Time: ${new Date().toISOString()} | Found ${uniqueSymbols.length} unique tickers in assets table.`);
  log(`Source calc -> KIS: ${kisSymbols.length}, Crypto: ${cryptoSymbols.length}, Yahoo: ${yahooSymbols.length}`);

  const priceMap = new Map<string, number>();

  // 4a. Fetch Yahoo Prices
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

  // 4b. Fetch Crypto Prices (Binance)
  if (cryptoSymbols.length > 0) {
    await Promise.all(cryptoSymbols.map(async (sym) => {
      const price = await fetchBinancePrice(sym);
      if (price !== null) {
        priceMap.set(sym, price);
      } else {
        // Fallback to Yahoo if Binance fails
        const yPrice = await fetchYahooPrice(sym);
        if (yPrice !== null) priceMap.set(sym, yPrice);
      }
    }));
  }

  // 4b. Fetch KIS Prices (More parallelized now that we use a faster API)
  const KIS_CHUNK_SIZE = 5;
  if (kisSymbols.length > 0) {
    for (let i = 0; i < kisSymbols.length; i += KIS_CHUNK_SIZE) {
      const chunk = kisSymbols.slice(i, i + KIS_CHUNK_SIZE);
      await Promise.all(chunk.map(async (sym) => {
        const price = await fetchKisPrice(sym);
        if (price !== null) {
          priceMap.set(sym, price);
        }
      }));
      // Reduced delay since fast API is less taxing
      if (i + KIS_CHUNK_SIZE < kisSymbols.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
  }

  log(`Collected ${priceMap.size} prices total.`);

  if (priceMap.size === 0) {
    log("Result: No prices fetched. Nothing to update.");
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

  log(`Attempting to insert ${records.length} records...`);

  if (records.length > 0) {
    const { error: insertError } = await supabase.from("market_prices").insert(records);
    if (insertError) {
      errorLog("Failed to insert market_prices. Check FK constraints or connection.", insertError);
      // Log the first item to see what might be wrong
      if (records.length > 0) errorLog("Sample record:", records[0]);
      return { success: false, error: insertError };
    }
  }

  log(`Inserted ${records.length} price records successfully.`);
  return { success: true, count: records.length };
}
