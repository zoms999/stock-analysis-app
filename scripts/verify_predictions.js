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

async function verifyPredictionPosts() {
  console.log('=== Checking Posts with Prediction Data ===\n');

  // 1. Check for posts with prediction_type set
  const { data: allPosts, error: allError } = await supabase
    .from('posts')
    .select('id, title, ticker_symbol, prediction_type, prediction_status, target_price, stop_loss_price, target_date, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (allError) {
    console.error('Error fetching posts:', allError);
    return;
  }

  console.log(`Total recent posts: ${allPosts.length}\n`);

  const postsWithPrediction = allPosts.filter(p => p.prediction_type);
  const waitingPosts = allPosts.filter(p => p.prediction_status === 'WAITING');

  console.log(`Posts with prediction_type: ${postsWithPrediction.length}`);
  console.log(`Posts with WAITING status: ${waitingPosts.length}\n`);

  if (waitingPosts.length > 0) {
    console.log('✅ WAITING posts found (Price Scheduler should pick these up):');
    waitingPosts.forEach(p => {
      console.log(`  - ID: ${p.id}`);
      console.log(`    Symbol: ${p.ticker_symbol}`);
      console.log(`    Type: ${p.prediction_type}`);
      console.log(`    Target: ${p.target_price}, Stop: ${p.stop_loss_price}`);
      console.log(`    Date: ${p.target_date}`);
      console.log(`    Created: ${new Date(p.created_at).toLocaleString('ko-KR')}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No WAITING posts found.');
    console.log('   This means the Price Scheduler will log "No WAITING posts to update"');
    console.log('   To fix: Create a new post with prediction settings filled in.\n');
  }

  if (postsWithPrediction.length > 0 && postsWithPrediction.length > waitingPosts.length) {
    console.log('Posts with prediction but NOT WAITING:');
    const nonWaiting = postsWithPrediction.filter(p => p.prediction_status !== 'WAITING');
    nonWaiting.forEach(p => {
      console.log(`  - ${p.title} (Status: ${p.prediction_status || 'NULL'})`);
    });
    console.log('');
  }

  // 2. Check the most recent post
  if (allPosts.length > 0) {
    const latest = allPosts[0];
    console.log('Most recent post:');
    console.log(`  Title: ${latest.title}`);
    console.log(`  Has prediction: ${latest.prediction_type ? 'YES' : 'NO'}`);
    console.log(`  Status: ${latest.prediction_status || 'NULL'}`);
  }
}

verifyPredictionPosts();
