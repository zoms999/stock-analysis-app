const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyPredictions() {
  console.log('=== Verifying Daily Accuracy v5 ===\n');

  // 1. Trigger Calculation
  console.log('1. Triggering calculation (v5)...');
  const { data: calcResult, error: calcError } = await supabase.rpc('calculate_daily_accuracies_v5');
  
  if (calcError) {
    console.error('❌ Calculation Trigger Failed:', calcError.message);
    console.log('👉 TIP: You likely need to run the SQL in "calculate_daily_accuracies_v5.sql" manually in Supabase Dashboard.');
  } else {
    console.log('✅ Calculation Triggered:', calcResult);
  }

  // 2. Check for Negative Accuracy
  console.log('\n2. Checking for Negative/Raw Accuracy...');
  const { data: predictions, error: fetchError } = await supabase
    .from('daily_predictions')
    .select('id, prediction_date, predicted_price, previous_close, actual_close, daily_accuracy, posts(ticker_symbol)')
    .not('daily_accuracy', 'is', null) // Only calculated ones
    .order('prediction_date', { ascending: false })
    .limit(10);

  if (fetchError) {
    console.error('❌ Failed to fetch predictions:', fetchError);
    return;
  }

  if (predictions.length === 0) {
    console.log('⚠️ No calculated predictions found.');
  } else {
    console.log('Found latest predictions:');
    predictions.forEach(p => {
        const acc = p.daily_accuracy;
        const prev = p.previous_close;
        const actual = p.actual_close;
        const pred = p.predicted_price;
        
        // Validation Calculation
        let calculated = 0;
        let diffPred = (pred - prev);
        let diffActual = (actual - prev);
        
        if (diffPred !== 0) {
            calculated = (diffActual / diffPred) * 100;
        }
        
        const isMatch = Math.abs(calculated - acc) < 0.01; // Float tolerance
        
        console.log(`- [${p.prediction_date}] Ticker: ${p.posts?.ticker_symbol}`);
        console.log(`  Prev: ${prev}, Actual: ${actual}, Pred: ${pred}`);
        console.log(`  Calc: (${actual} - ${prev}) / (${pred} - ${prev}) * 100 = ${calculated.toFixed(2)}%`);
        console.log(`  DB Value: ${acc}%`);
        console.log(`  Match? ${isMatch ? '✅' : '❌'}`);
        
        if (acc < 0) console.log('  👉 NEGATIVE VALUE FOUND (Good!)');
        if (acc > 100) console.log('  👉 > 100% VALUE FOUND (Good!)');
        
        console.log('---');
    });
  }
}

verifyPredictions();
