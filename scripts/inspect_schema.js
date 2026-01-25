const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service role to inspect schema if possible

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  console.log('=== Inspecting market_prices Schema ===\n');

  // Supabase/Postgres specific: Query information_schema
  const { data: columns, error } = await supabase.rpc('get_schema_info', { table_name: 'market_prices' });
  
  // Since we might not have a helper RPC, let's try raw SQL via a different method if possible,
  // or just infer from behavior. 
  // But wait, we can't run raw SQL easily via JS client unless we have a function.
  
  // Let's try to infer by checking if we receive any error messages about triggers when inserting.
  
  // Alternative: Check for Foreign Keys from other tables pointing primarily to market_prices?
  
  // Actually, we can check pg_triggers if we have access
  try {
      // Try to select from information_schema (might fail due to permissions)
     // This is usually not allowed via PostgREST.
     
     console.log("Cannot directly inspect schema via client without RPC.");
     console.log("Attempting to insert a dummy record to see if it works...");
     
     const dummy = { ticker_symbol: 'TEST-DEBUG', price: 123.45, recorded_at: new Date().toISOString() };
     const { data, error } = await supabase.from('market_prices').insert(dummy).select();
     
     if (error) {
         console.error("Insert failed:", error);
     } else {
         console.log("Insert successful:", data);
         // Cleanup
         await supabase.from('market_prices').delete().eq('ticker_symbol', 'TEST-DEBUG');
         console.log("Dummy record deleted.");
     }

  } catch (e) {
      console.error(e);
  }
}

inspectSchema();
