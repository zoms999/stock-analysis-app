const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const POST_ID = 'e2a10f68-5ecb-463d-82af-4d4223663a8d';

async function debugPrice() {
  console.log('=== Debugging Price Issue ===');

  // 1. Check Post Ticker
  const { data: post } = await supabase
    .from('posts')
    .select('id, ticker_symbol, created_at')
    .eq('id', POST_ID)
    .single();

  console.log('Post Info:', post);

  // 2. Check Daily Predictions
  const { data: predictions } = await supabase
    .from('daily_predictions')
    .select('*')
    .eq('post_id', POST_ID);

  console.log('Predictions:', predictions);

  // 3. Search for 39.94 in market_prices
  // Finding where this value came from
  const { data: weirdPrices } = await supabase
    .from('market_prices')
    .select('*')
    .or(`price.eq.39.94,price.gt.39.9,price.lt.40.0`) // Search range just in case
    .limit(5);

  console.log('Records with price ~39.94:', weirdPrices);
  
  // 4. Check 1/10 BTC Price
  const { data: btcPrices } = await supabase
    .from('market_prices')
    .select('*')
    .or('ticker_symbol.eq.BTC,ticker_symbol.eq.BTC-USD')
    .order('recorded_at', { ascending: false })
    .limit(5);
    
    console.log('Recent BTC Prices:', btcPrices);
}

debugPrice();
