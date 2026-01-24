const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runFix() {
  console.log('=== FIXING DAILY PREDICTIONS ===\n');
  
  // 1. Update SQL Function
  console.log('1. Updating SQL Function (calculate_daily_accuracies_v5)...');
  const sqlPath = path.join(__dirname, '../sql/calculate_daily_accuracies_v5.sql');
  const functionSQL = fs.readFileSync(sqlPath, 'utf8');
  
  const { error: updateError } = await supabase.rpc('exec_sql', { sql: functionSQL });
  
  if (updateError) {
      console.error('Error updating function:', updateError);
      // Fallback: try direct query if RPC fails (assuming pg connection possible or different RPC?)
      // Actually, let's try assuming the existing deploy script works.
      // If exec_sql fails, we might need to rely on the user running it manually.
      console.log('Attempting to use _sql table fallback...');
      const { error: directError } = await supabase.from('_sql').insert({ query: functionSQL });
      if (directError) {
          console.error('Failed to update function via _sql table as well.');
          return;
      }
  }
  console.log('✅ SQL Function updated.\n');

  // 2. Trigger Calculation
  console.log('2. Triggering recalculation to fix data...');
  // We call the function we just updated
  const { data, error: calcError } = await supabase.rpc('calculate_daily_accuracies_v5');
  
  if (calcError) {
      console.error('❌ Calculation Failed:', calcError);
  } else {
      console.log('✅ Calculation Completed.');
      console.log('Result:', data);
  }
}

runFix();
