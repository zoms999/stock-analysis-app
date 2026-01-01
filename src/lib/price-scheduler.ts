
import { createClient } from '@supabase/supabase-js';

type TwelvePriceSingleResponse =
  | { price: string }
  | { status: "error"; code?: number | string; message?: string };

type TwelvePriceMultiResponse = Record<
  string,
  { price: string } | { status?: "error"; code?: number | string; message?: string }
>;

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeSymbolForTwelveData(raw: string) {
  const s = String(raw ?? "").trim();
  if (!s) return s;

  // KRX:005930 / XKRX:005930 -> 005930:KRX
  const mKr = s.match(/^(KRX|XKRX)\s*:\s*(\d{6})$/i);
  if (mKr) return `${mKr[2]}:KRX`;

  // Yahoo 스타일 "BTC-USD" -> Twelve Data에서 자주 쓰는 "BTC/USD"
  const m = s.match(/^([A-Za-z0-9]{2,10})-([A-Za-z]{3,5})$/);
  if (m) {
    const base = m[1];
    const quote = m[2].toUpperCase();
    const isFiatLike = ["USD", "USDT", "KRW", "EUR", "JPY", "GBP"].includes(quote);
    if (isFiatLike) return `${base}/${quote}`;
  }

  return s;
}

async function fetchTwelveDataPrices(symbols: string[], apiKey: string) {
  // Twelve Data `price` endpoint는 콤마로 multi-symbol 지원:
  // - 단일: { "price": "..." }
  // - 복수: { "AAPL": { "price": "..." }, "MSFT": { "price": "..." } }
  const url = new URL("https://api.twelvedata.com/price");
  url.searchParams.set("symbol", symbols.join(","));
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    return { ok: false as const, error: `Twelve Data price request failed: ${res.status} ${res.statusText}`, raw: text };
  }

  // 단일 심볼 응답
  if (symbols.length === 1) {
    const single = json as TwelvePriceSingleResponse;
    if ((single as any)?.status === "error") {
      return { ok: false as const, error: (single as any)?.message || "Twelve Data error", raw: text };
    }
    const priceStr = (single as any)?.price;
    const price = Number(priceStr);
    if (!Number.isFinite(price)) {
      return { ok: false as const, error: "Invalid price response", raw: text };
    }
    return { ok: true as const, prices: new Map([[symbols[0], price]]), raw: text };
  }

  // 멀티 심볼 응답
  const multi = json as TwelvePriceMultiResponse;
  const prices = new Map<string, number>();
  for (const sym of symbols) {
    const entry: any = (multi as any)?.[sym];
    if (!entry) continue;
    if (entry?.status === "error" || entry?.message) continue;
    const price = Number(entry?.price);
    if (Number.isFinite(price)) prices.set(sym, price);
  }

  return { ok: true as const, prices, raw: text };
}

export async function updateMarketPrices() {
  const logs: string[] = [];
  const log = (msg: string, ...args: any[]) => {
      console.log(msg, ...args);
      logs.push(`${msg} ${args.map(a => JSON.stringify(a)).join(' ')}`);
  };
  const errorLog = (msg: string, ...args: any[]) => {
      console.error(msg, ...args);
      logs.push(`[ERROR] ${msg} ${args.map(a => JSON.stringify(a)).join(' ')}`);
  }

  log('Starting market price update...');

  try {
    const apiKey = process.env.TWELVEDATA_API_KEY ?? process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;
    if (!apiKey) {
      log("TWELVEDATA_API_KEY is not configured. Skipping price update.");
      return { success: true, updated: 0, logs };
    }

    // 1. Get Active Assets (System Defaults)
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('symbol, api_id')
      .eq('is_active', true);

    if (assetsError) {
      errorLog('Error fetching assets:', assetsError);
      throw assetsError;
    }

    // 2. Get Active Prediction Tickers (User Dynamic)
    const { data: activePosts, error: postsError } = await supabase
      .from('posts')
      .select('ticker_symbol')
      .eq('prediction_status', 'WAITING');

    if (postsError) {
      errorLog('Error fetching active posts:', postsError);
      throw postsError;
    }

    // 3. Merge and Deduplicate
    // Map: Internal Symbol -> External API ID
    const targetTickers = new Map<string, string>();

    // Add System Assets
    assets?.forEach(asset => {
      targetTickers.set(asset.symbol, asset.api_id);
    });

    // Add User Post Tickers
    activePosts?.forEach(post => {
      const symbol = post.ticker_symbol;
      if (!targetTickers.has(symbol)) {
        targetTickers.set(symbol, symbol);
      }
    });

    const uniqueApiIds = Array.from(new Set(targetTickers.values()));
    log(`Targeting ${uniqueApiIds.length} unique tickers:`, uniqueApiIds);

    if (uniqueApiIds.length === 0) {
      log('No tickers to update.');
      return { success: true, updated: 0, logs };
    }

    // 4. Fetch Prices from Twelve Data (REST: /price)
    // Map: internal -> normalized external (twelve) symbol
    const targets: Array<{ internal: string; external: string }> = [];
    for (const [internal, apiId] of targetTickers.entries()) {
      const external = normalizeSymbolForTwelveData(apiId);
      if (external) targets.push({ internal, external });
    }

    const uniqueExternal = Array.from(new Set(targets.map((t) => t.external)));
    log(`Fetching Twelve Data prices for ${uniqueExternal.length} symbols (normalized):`, uniqueExternal);

    const priceMap = new Map<string, number>();
    const BATCH_SIZE = 50;
    for (let i = 0; i < uniqueExternal.length; i += BATCH_SIZE) {
      const batch = uniqueExternal.slice(i, i + BATCH_SIZE);
      const out = await fetchTwelveDataPrices(batch, apiKey);
      if (!out.ok) {
        errorLog("Twelve Data price batch failed", out.error, { batch });
        continue;
      }
      out.prices.forEach((p, s) => priceMap.set(s, p));
    }

    log(`Received ${priceMap.size} prices from Twelve Data.`);

    // 5. Identify missing assets and create them
    const knownSymbols = new Set(assets?.map(a => a.symbol));
    const newAssetsToCreate: { symbol: string, api_id: string, asset_type: string, is_active: boolean }[] = [];

    const activePostSymbols = new Set(activePosts?.map(p => p.ticker_symbol));
    
    for (const symbol of activePostSymbols) {
        if (!knownSymbols.has(symbol)) {
            newAssetsToCreate.push({
                symbol: symbol,
                api_id: symbol, // Assume same
                asset_type: 'UNKNOWN', // Default type
                is_active: false 
            });
            knownSymbols.add(symbol); 
        }
    }

    if (newAssetsToCreate.length > 0) {
        log(`Creating ${newAssetsToCreate.length} new temporary assets...`);
        const { error: createError } = await supabase
            .from('assets')
            .upsert(newAssetsToCreate, { onConflict: 'symbol' }); // safe upsert
        
        if (createError) {
             errorLog('Error creating new assets:', createError);
        }
    }

    // 6. Insert into DB
    const insertData = [];
    
    for (const t of targets) {
      const price = priceMap.get(t.external);
      if (price === undefined) {
        log(`Skipping (no price): ${t.internal} -> ${t.external}`);
        continue;
      }
      log(`Processing price: ${t.internal} (${t.external}), Price: ${price}`);
      insertData.push({
        ticker_symbol: t.internal,
        price,
        recorded_at: new Date().toISOString(),
      });
    }

    log(`Prepared ${insertData.length} records for insertion.`);

    if (insertData.length > 0) {
      const { error: insertError } = await supabase
        .from('market_prices')
        .insert(insertData);

      if (insertError) {
        errorLog('Error inserting prices:', insertError);
        throw insertError;
      }
      log(`Successfully updated ${insertData.length} prices.`);
    }

    return { success: true, updated: insertData.length, logs };
  } catch (error) {
    errorLog('Update market prices failed:', error);
    return { success: false, error, logs };
  }
}
