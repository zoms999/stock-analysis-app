const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableStructure() {
  console.log('=== Checking market_prices Table Structure ===\n');
  
  // Get a sample record to see the structure
  const { data, error } = await supabase
    .from('market_prices')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('Sample record:');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('\nColumns:');
    Object.keys(data[0]).forEach(key => {
      console.log(`  - ${key}: ${typeof data[0][key]}`);
    });
  } else {
    console.log('No records found in market_prices table');
  }
}

checkTableStructure();
