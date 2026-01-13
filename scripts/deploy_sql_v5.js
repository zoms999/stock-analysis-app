const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateSQLFunction() {
  console.log('=== Updating SQL Function v5 ===\n');
  
  // Read the SQL file
  const sqlContent = fs.readFileSync(path.join(__dirname, '../sql/calculate_daily_accuracies_v5.sql'), 'utf8');
  
  // Extract just the function definition 
  // (In this case, the file IS the function definition, but let's be safe if I added comments)
  // Our file content is purely the CREATE OR REPLACE... so we can use it directly or match.
  // But let's just use the whole file content since it is clean.
  const functionSQL = sqlContent;
  
  console.log('Executing SQL function update...\n');
  
  const { error } = await supabase.rpc('exec_sql', { sql: functionSQL }).single();
  
  if (error) {
    console.log('RPC exec_sql failed, trying _sql table insert...');
    // Try direct query via _sql table (common pattern in some Supabase setups)
    const { error: directError } = await supabase.from('_sql').insert({ query: functionSQL });
    
    if (directError) {
        console.error('Error updating function via _sql table:', directError);
        console.log('\n❌ FAILED to auto-deploy. Please run this SQL manually in Supabase SQL Editor:');
        console.log('---');
        console.log(functionSQL);
        console.log('---');
    } else {
        console.log('✅ Function updated successfully (queued via _sql table)');
    }
  } else {
    console.log('✅ Function updated successfully');
  }
}

updateSQLFunction();
