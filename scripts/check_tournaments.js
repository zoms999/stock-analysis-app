const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTournaments() {
  console.log('=== Checking Tournaments ===\n');

  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('*');

  if (error) {
    console.error('Error fetching tournaments:', error);
    return;
  }

  if (tournaments && tournaments.length > 0) {
    console.log(`Found ${tournaments.length} tournament(s):`);
    tournaments.forEach(t => {
      console.log(`- [${t.status}] ${t.title} (ID: ${t.id})`);
      console.log(`  Type: ${t.event_type}, Symbol: ${t.stock_symbol}`);
      console.log(`  Dates: ${t.start_date} ~ ${t.end_date}`);
      console.log('---');
    });
  } else {
    console.log('No tournaments found.');
  }
}

checkTournaments();
