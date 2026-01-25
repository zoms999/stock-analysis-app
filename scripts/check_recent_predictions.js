const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentPredictions() {
  console.log('=== Checking Recent Predictions (Last 5 Days) ===\n');
  
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - 5);
  
  const { data: predictions, error } = await supabase
    .from('daily_predictions')
    .select('id, prediction_date, previous_close, posts(ticker_symbol)')
    .gte('prediction_date', startDate.toISOString().split('T')[0])
    .order('prediction_date', { ascending: false })
    .limit(20);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Found ${predictions.length} predictions.`);
  predictions.forEach(p => {
    console.log(`- [${p.prediction_date}] ${p.posts?.ticker_symbol}: PreviousClose=${p.previous_close}`);
  });
}

checkRecentPredictions();
