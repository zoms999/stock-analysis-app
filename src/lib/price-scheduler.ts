
import { createClient } from '@supabase/supabase-js';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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

    // 4. Fetch Prices from Yahoo Finance
    log(`Fetching prices for:`, uniqueApiIds);
    let quotes: any[] = [];
    try {
        const results = await yahooFinance.quote(uniqueApiIds);
        quotes = Array.isArray(results) ? results : [results];
        log(`Received ${quotes.length} quotes from Yahoo.`);
    } catch (e) {
        errorLog("Yahoo Finance Quote Failed", e);
    }

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
    
    for (const quote of quotes) {
      if (!quote) continue;
      
      const price = quote.regularMarketPrice;
      const symbol = quote.symbol; // Yahoo symbol (api_id)
      log(`Processing quote: ${symbol}, Price: ${price}`);

      let internalSymbol = null;
      
      for (const [key, apiId] of targetTickers.entries()) {
          if (apiId === symbol || apiId.toUpperCase() === symbol.toUpperCase()) {
              internalSymbol = key;
              break;
          }
      }
      
      if (!internalSymbol && targetTickers.has(symbol)) {
          internalSymbol = symbol;
      }
      
      if (!internalSymbol) {
         log(`Warning: Could not map Yahoo symbol '${symbol}' back to internal asset. Skipping.`);
         continue; 
      }

      if (internalSymbol && price !== undefined) {
        insertData.push({
          ticker_symbol: internalSymbol,
          price: price,
          recorded_at: new Date().toISOString()
        });
      }
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
