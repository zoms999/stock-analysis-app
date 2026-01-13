const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPrices() {
  console.log('=== Checking Market Prices ===\n');
  
  // Check for BTC
  const { data: btcPrices } = await supabase
    .from('market_prices')
    .select('*')
    .eq('ticker_symbol', 'BTC')
    .order('recorded_at', { ascending: false })
    .limit(3);
  
  console.log('Prices for BTC:');
  if (btcPrices && btcPrices.length > 0) {
    btcPrices.forEach(p => console.log(`  ${p.price} at ${p.recorded_at}`));
  } else {
    console.log('  No prices found');
  }
  console.log('');
  
  // Check for BTC-USD
  const { data: btcUsdPrices } = await supabase
    .from('market_prices')
    .select('*')
    .eq('ticker_symbol', 'BTC-USD')
    .order('recorded_at', { ascending: false })
    .limit(3);
  
  console.log('Prices for BTC-USD:');
  if (btcUsdPrices && btcUsdPrices.length > 0) {
    btcUsdPrices.forEach(p => console.log(`  ${p.price} at ${p.recorded_at}`));
  } else {
    console.log('  No prices found');
  }
  console.log('');
  
  // Check all unique symbols
  const { data: allSymbols } = await supabase
    .from('market_prices')
    .select('ticker_symbol')
    .order('ticker_symbol');
  
  if (allSymbols) {
    const unique = [...new Set(allSymbols.map(s => s.ticker_symbol))];
    console.log('All unique ticker symbols in market_prices:');
    unique.forEach(s => console.log(`  - ${s}`));
  }
}

checkPrices();
