const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAllBadData() {
  console.log('=== Fixing ALL Bad BTC Data (Global) ===');

  // 1. Check how many predictions have the bad previous_close
  const { data: badPredictions, error: checkError } = await supabase
    .from('daily_predictions')
    .select('id, post_id, prediction_date, previous_close')
    .eq('previous_close', 39.94);

  if (checkError) {
    console.error('Error checking bad predictions:', checkError);
    return;
  }

  console.log(`Found ${badPredictions.length} predictions with corrupted previous_close (39.94).`);
  if (badPredictions.length > 0) {
      console.log('Sample:', badPredictions[0]);
  }

  // 2. Reset them
  if (badPredictions.length > 0) {
      const { error: updateError } = await supabase
        .from('daily_predictions')
        .update({ 
          previous_close: null, 
          calculated_at: null,
          daily_accuracy: null
        })
        .eq('previous_close', 39.94);

      if (updateError) {
        console.error('Error resetting predictions:', updateError);
        return;
      }
      console.log('✅ Successfully reset all corrupted predictions.');
  }

  // 3. Trigger Recalculation (v4)
  console.log('Triggering global recalculation...');
  const { error: calcError } = await supabase.rpc('calculate_daily_accuracies_v4');
  
  if (calcError) {
    console.error('Error recalculating:', calcError);
  } else {
    console.log('✅ Global recalculation completed.');
  }
}

fixAllBadData();
