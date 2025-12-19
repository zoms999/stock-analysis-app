
import { createClient } from '@supabase/supabase-js';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// Initialize Supabase Client
// Note: In a real production environment, you should use the SERVICE_ROLE_KEY for background jobs
// to bypass RLS. For now, we assume using the ANON key or that environment variables are set.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function updateMarketPrices() {
  console.log('Starting market price update...');

  try {
    // 1. Get Active Assets (System Defaults)
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('symbol, api_id')
      .eq('is_active', true);

    if (assetsError) {
      console.error('Error fetching assets:', assetsError);
      throw assetsError;
    }

    // 2. Get Active Prediction Tickers (User Dynamic)
    const { data: activePosts, error: postsError } = await supabase
      .from('posts')
      .select('ticker_symbol')
      .eq('prediction_status', 'WAITING');

    if (postsError) {
      console.error('Error fetching active posts:', postsError);
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
    // If the ticker is already in assets, the Map handles deduplication (we use the predefined api_id).
    // If NOT in assets, we assume the user input ticker is the valid API ID (or we use it as is).
    // Ideally, we should lookup the asset table again, but here we simply check if it's already in the map.
    
    // To handle the case where post ticker matches an asset symbol:
    // We already populated the map with assets. So we just need to handle new ones.
    activePosts?.forEach(post => {
      const symbol = post.ticker_symbol;
      if (!targetTickers.has(symbol)) {
        // New ticker not in assets table. We assume symbol == api_id
        targetTickers.set(symbol, symbol);
      }
    });

    const uniqueApiIds = Array.from(new Set(targetTickers.values()));
    console.log(`Targeting ${uniqueApiIds.length} unique tickers:`, uniqueApiIds);

    if (uniqueApiIds.length === 0) {
      console.log('No tickers to update.');
      return;
    }

    // 4. Fetch Prices from Yahoo Finance
    const results = await yahooFinance.quote(uniqueApiIds);
    // yahooFinance.quote returns an array if multiple symbols, or single object if one.
    // Ensure it's an array.
    const quotes = Array.isArray(results) ? results : [results];

    // 5. Insert into DB
    const insertData = [];

    // We need to map back from Api ID to our internal Symbol if possible.
    // However, our market_prices table has a foreign key to `assets(symbol)`.
    // Wait! If the user added a ticker 'DOGE-USD' that is NOT in `assets` table,
    // we cannot insert it into `market_prices` because of the Foreign Key Constraint!
    
    // Critical Fix: We must first ensure all tracked tickers exist in `assets` table.
    // If a dynamic ticker from a post is not in `assets`, we should insert it first.
    
    // Let's identify missing assets.
    // validSymbols are keys of our map that came from 'assets' query initially.
    const knownSymbols = new Set(assets?.map(a => a.symbol));
    const newAssetsToCreate: { symbol: string, api_id: string, asset_type: string, is_active: boolean }[] = [];

    // Re-iterate activePosts to find missing ones
    const activePostSymbols = new Set(activePosts?.map(p => p.ticker_symbol));
    
    for (const symbol of activePostSymbols) {
        if (!knownSymbols.has(symbol)) {
            newAssetsToCreate.push({
                symbol: symbol,
                api_id: symbol, // Assume same
                asset_type: 'UNKNOWN', // Default type
                is_active: false // It's dynamic, not system fixed, so maybe false? 
                // Using 'false' is fine because our query selects 'WAITING' posts anyway. 
                // If we set true, it becomes permanent. Let's keep it false (dynamic only).
            });
            knownSymbols.add(symbol); // Prevent duplicates in this loop
        }
    }

    if (newAssetsToCreate.length > 0) {
        console.log(`Creating ${newAssetsToCreate.length} new temporary assets...`);
        const { error: createError } = await supabase
            .from('assets')
            .upsert(newAssetsToCreate, { onConflict: 'symbol' }); // safe upsert
        
        if (createError) {
             console.error('Error creating new assets:', createError);
             // Proceeding might fail for foreign keys, but let's try.
        }
    }

    // Now prepare insert data
    for (const quote of quotes) {
      if (!quote) continue;
      
      const price = quote.regularMarketPrice;
      const symbol = quote.symbol; // Yahoo symbol (api_id)

      // We need to find the internal 'symbol' that corresponds to this 'api_id'.
      let internalSymbol = null;
      
      // 1. Try to find by matching API ID (Value in Map)
      // This is the most correct way: We requested 'api_id', we got 'symbol' back. They should match.
      for (const [key, apiId] of targetTickers.entries()) {
          if (apiId === symbol || apiId.toUpperCase() === symbol.toUpperCase()) {
              internalSymbol = key;
              break;
          }
      }
      
      // 2. Fallback: Check if the returned symbol acts as a key directly (Self-referencing asset)
      if (!internalSymbol && targetTickers.has(symbol)) {
          internalSymbol = symbol;
      }

      // 3. Fallback: Check if we have a key that *contains* this symbol? (Dangerous, skip)
      
      if (!internalSymbol) {
         console.warn(`Warning: Could not map Yahoo symbol '${symbol}' back to internal asset. Skipping.`);
         continue; 
      }

      if (internalSymbol && price !== undefined) {
        insertData.push({
          ticker_symbol: internalSymbol,
          price: price,
          recorded_at: new Date().toISOString() // Or use quote.regularMarketTime
        });
      }
    }

    if (insertData.length > 0) {
      const { error: insertError } = await supabase
        .from('market_prices')
        .insert(insertData);

      if (insertError) {
        console.error('Error inserting prices:', insertError);
        throw insertError;
      }
      console.log(`Successfully updated ${insertData.length} prices.`);
    }

    return { success: true, updated: insertData.length };
  } catch (error) {
    console.error('Update market prices failed:', error);
    return { success: false, error };
  }
}
