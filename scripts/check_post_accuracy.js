const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPostAccuracy() {
  const postId = 'b9136f9a-cd5a-4b7e-85fd-749b107cce0d';
  
  console.log('=== Checking Post Accuracy Issue ===\n');
  
  // 1. Get the post details
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();
  
  if (postError) {
    console.error('Error fetching post:', postError);
    return;
  }
  
  console.log('Post Details:');
  console.log('  ID:', post.id);
  console.log('  Title:', post.title);
  console.log('  Ticker:', post.ticker_symbol);
  console.log('  Prediction Type:', post.prediction_type);
  console.log('  Prediction Status:', post.prediction_status);
  console.log('  Entry Price:', post.entry_price);
  console.log('  Target Price:', post.target_price);
  console.log('  Stop Loss Price:', post.stop_loss_price);
  console.log('  Target Date:', post.target_date);
  console.log('  Accuracy Score:', post.accuracy_score);
  console.log('  Created At:', post.created_at);
  console.log('');
  
  // 2. Check if target date has passed
  const now = new Date();
  const targetDate = new Date(post.target_date);
  const isPastTargetDate = now > targetDate;
  
  console.log('Date Check:');
  console.log('  Current Time:', now.toISOString());
  console.log('  Target Date:', targetDate.toISOString());
  console.log('  Is Past Target Date:', isPastTargetDate);
  console.log('');
  
  // 3. Get latest price from market_prices
  const { data: prices, error: priceError } = await supabase
    .from('market_prices')
    .select('*')
    .eq('ticker_symbol', post.ticker_symbol)
    .order('recorded_at', { ascending: false })
    .limit(5);
  
  if (priceError) {
    console.error('Error fetching prices:', priceError);
  } else {
    console.log('Latest Market Prices:');
    if (prices && prices.length > 0) {
      prices.forEach((p, i) => {
        console.log(`  ${i + 1}. Price: ${p.price}, Recorded: ${p.recorded_at}`);
      });
    } else {
      console.log('  No prices found for ticker:', post.ticker_symbol);
    }
    console.log('');
  }
  
  // 4. Try to get price with asset mapping
  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .select('*')
    .eq('api_id', post.ticker_symbol)
    .limit(1);
  
  if (!assetError && asset && asset.length > 0) {
    console.log('Asset Mapping Found:');
    console.log('  API ID:', asset[0].api_id);
    console.log('  Symbol:', asset[0].symbol);
    console.log('');
    
    const { data: altPrices, error: altPriceError } = await supabase
      .from('market_prices')
      .select('*')
      .eq('ticker_symbol', asset[0].symbol)
      .order('recorded_at', { ascending: false })
      .limit(5);
    
    if (!altPriceError && altPrices && altPrices.length > 0) {
      console.log('Prices with Asset Symbol Mapping:');
      altPrices.forEach((p, i) => {
        console.log(`  ${i + 1}. Price: ${p.price}, Recorded: ${p.recorded_at}`);
      });
      console.log('');
    }
  }
  
  // 5. Calculate what accuracy SHOULD be
  if (prices && prices.length > 0) {
    const latestPrice = prices[0].price;
    console.log('Manual Accuracy Calculation:');
    console.log('  Entry Price:', post.entry_price);
    console.log('  Target Price:', post.target_price);
    console.log('  Latest Price:', latestPrice);
    
    if (post.prediction_type === 'LONG') {
      const predictedMove = post.target_price - post.entry_price;
      const actualMove = latestPrice - post.entry_price;
      const accuracy = actualMove < 0 ? 0 : (actualMove / predictedMove) * 100;
      console.log('  Predicted Move:', predictedMove);
      console.log('  Actual Move:', actualMove);
      console.log('  Calculated Accuracy:', accuracy.toFixed(2) + '%');
    } else if (post.prediction_type === 'SHORT') {
      const predictedMove = post.entry_price - post.target_price;
      const actualMove = post.entry_price - latestPrice;
      const accuracy = actualMove < 0 ? 0 : (actualMove / predictedMove) * 100;
      console.log('  Predicted Move:', predictedMove);
      console.log('  Actual Move:', actualMove);
      console.log('  Calculated Accuracy:', accuracy.toFixed(2) + '%');
    }
    console.log('');
  }
  
  // 6. Check if the SQL function would pick this up
  console.log('SQL Function Check:');
  console.log('  Would be picked by calculate_and_update_accuracies():');
  console.log('    - prediction_status = WAITING?', post.prediction_status === 'WAITING');
  console.log('    - entry_price IS NOT NULL?', post.entry_price !== null);
  console.log('    - entry_price > 0?', post.entry_price > 0);
  console.log('    - target_price IS NOT NULL?', post.target_price !== null);
  console.log('    - target_price > 0?', post.target_price > 0);
  console.log('    - prediction_type IS NOT NULL?', post.prediction_type !== null);
  console.log('');
  
  const shouldBeProcessed = 
    post.prediction_status === 'WAITING' &&
    post.entry_price !== null &&
    post.entry_price > 0 &&
    post.target_price !== null &&
    post.target_price > 0 &&
    post.prediction_type !== null;
  
  if (shouldBeProcessed) {
    console.log('✅ This post SHOULD be processed by the SQL function');
  } else {
    console.log('❌ This post will NOT be processed by the SQL function');
    console.log('   Reason: One or more conditions not met');
  }
}

checkPostAccuracy();
