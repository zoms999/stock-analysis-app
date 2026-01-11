
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking for WAITING posts...");
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, ticker_symbol, prediction_status')
    .eq('prediction_status', 'WAITING');

  if (error) {
    console.error('Error fetching posts:', error);
    return;
  }

  console.log(`Found ${posts ? posts.length : 0} WAITING posts.`);
  if (posts && posts.length > 0) {
    console.log(JSON.stringify(posts, null, 2));
  }
}

check();
