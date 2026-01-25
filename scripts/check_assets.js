const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAssets() {
  console.log('=== Checking Assets Table ===\n');
  
  const { count, error } = await supabase
    .from('assets')
    .select('*', { count: 'exact', head: true });
    
  if (error) {
    console.error('Error checking assets:', error);
  } else {
    console.log(`Assets count: ${count}`);
  }
}

checkAssets();
