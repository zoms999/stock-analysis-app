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
  const postId = 'e2a10f68-5ecb-463d-82af-4d4223663a8d';
  
  console.log('=== Checking Post e2a10f68 ===\n');
  
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
    .or(`ticker_symbol.eq.${post.ticker_symbol},ticker_symbol.eq.${post.ticker_symbol}-USD`)
    .order('recorded_at', { ascending: false })
    .limit(5);
  
  if (priceError) {
    console.error('Error fetching prices:', priceError);
  } else {
    console.log('Latest Market Prices:');
    if (prices && prices.length > 0) {
      prices.forEach((p, i) => {
        console.log(`  ${i + 1}. Symbol: ${p.ticker_symbol}, Price: ${p.price}, Recorded: ${p.recorded_at}`);
      });
    } else {
      console.log('  No prices found for ticker:', post.ticker_symbol);
    }
    console.log('');
  }
  
  // 4. Calculate what accuracy SHOULD be
  if (prices && prices.length > 0) {
    const latestPrice = prices[0].price;
    console.log('Manual Accuracy Calculation (Direction-Agnostic):');
    console.log('  Entry Price:', post.entry_price);
    console.log('  Target Price:', post.target_price);
    console.log('  Latest Price:', latestPrice);
    
    const predictedMove = post.target_price - post.entry_price;
    const actualMove = latestPrice - post.entry_price;
    let accuracy = (actualMove / predictedMove) * 100;
    
    console.log('  Predicted Move:', predictedMove);
    console.log('  Actual Move:', actualMove);
    console.log('  Raw Accuracy:', accuracy.toFixed(2) + '%');
    
    if (accuracy < 0) {
      accuracy = 0;
      console.log('  Final Accuracy (capped):', accuracy.toFixed(2) + '% (moved opposite direction)');
    } else if (accuracy > 100) {
      accuracy = 100;
      console.log('  Final Accuracy (capped):', accuracy.toFixed(2) + '% (overachieved)');
    } else {
      console.log('  Final Accuracy:', accuracy.toFixed(2) + '%');
    }
    console.log('');
  }
  
  // 5. Run SQL function
  console.log('Running SQL function to calculate accuracy...');
  const { error: sqlError } = await supabase.rpc('calculate_and_update_accuracies');
  
  if (sqlError) {
    console.error('Error running SQL function:', sqlError);
  } else {
    console.log('✅ SQL function executed successfully');
    
    // Fetch the post again to see updated accuracy
    const { data: updatedPost } = await supabase
      .from('posts')
      .select('accuracy_score, prediction_status')
      .eq('id', postId)
      .single();
    
    console.log('');
    console.log('Updated Post:');
    console.log('  Accuracy Score:', updatedPost?.accuracy_score);
    console.log('  Prediction Status:', updatedPost?.prediction_status);
  }
}

checkPostAccuracy();
