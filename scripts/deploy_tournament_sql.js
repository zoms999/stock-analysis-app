const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deployTournamentSQL() {
  console.log('=== Deploying Tournament SQL ===\n');
  const sqlContent = fs.readFileSync(path.join(__dirname, '../sql/update_tournament_schema.sql'), 'utf8');
  
  console.log('Executing SQL via _sql table fallback...');
  const { error } = await supabase.from('_sql').insert({ query: sqlContent });
  
  if (error) {
    console.error('❌ FAILED to deploy SQL:', error);
    console.log('\nPlease run the SQL manually from: sql/update_tournament_schema.sql');
  } else {
    console.log('✅ SQL deployment queued successfully via _sql table.');
  }

  // Also create a sample tournament if none exists
  console.log('\nChecking for sample KOSPI tournament...');
  // We can't select easily if permissions are tight, but we can try to insert one via SQL if we want, 
  // but better to keep schema and data separate.
  // We'll let the user create it or insert via another script.
}

deployTournamentSQL();
