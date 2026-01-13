const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyFunction() {
  console.log('=== Checking for calculate_daily_accuracies function ===');
  
  // Try to call the function directly
  const { data, error } = await supabase.rpc('calculate_daily_accuracies');
  
  if (error) {
    console.log('❌ Error calling function:', error.message);
    if (error.code === 'PGRST202' || error.message.includes('Could not find the function')) {
      console.log('   -> The function does NOT exist in the database or is not accessible.');
      console.log('   -> Please run the SQL script in "FINAL_SETUP.md" in your Supabase SQL Editor.');
    } else {
      console.log('   -> An unexpected error occurred:', error);
    }
  } else {
    console.log('✅ Function exists and returned:', data);
  }
}

verifyFunction();
