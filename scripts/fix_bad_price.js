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

async function fixBadData() {
  console.log('=== Fixing Bad BTC Data ===');

  // 1. Delete bad market prices for BTC (price < 100)
  // Assuming BTC won't be $40 anytime soon
  const { data: deleted, error: deleteError } = await supabase
    .from('market_prices')
    .delete()
    .eq('ticker_symbol', 'BTC')
    .lt('price', 100)
    .select();

  if (deleteError) {
    console.error('Error deleting bad prices:', deleteError);
  } else {
    console.log(`Deleted ${deleted.length} bad BTC price records.`);
    console.log('Deleted records:', deleted);
  }

  // 2. Reset daily predictions for the post
  const { error: updateError } = await supabase
    .from('daily_predictions')
    .update({ 
      previous_close: null, 
      calculated_at: null,
      daily_accuracy: null
    })
    .eq('post_id', POST_ID);

  if (updateError) {
    console.error('Error resetting predictions:', updateError);
    return;
  }
  
  console.log('Reset predictions for post. Ready for recalculation.');

  // 3. Trigger Recalculation (v4)
  const { error: calcError } = await supabase.rpc('calculate_daily_accuracies_v4');
  
  if (calcError) {
    console.error('Error recalculating:', calcError);
  } else {
    console.log('✅ Recalculation triggered successfully.');
  }
}

fixBadData();
