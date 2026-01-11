
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraints() {
  console.log('Checking foreign keys on "posts" table...');
  
  // We can't directly query information_schema via supabase-js client usually (unless RPC).
  // But we can try to fetch a post and see if the join works.
  
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      id,
      user_id,
      profiles:user_id (
        id,
        nickname
      )
    `)
    .limit(3);

  if (error) {
    console.error('Error fetching posts with join:', error);
    return;
  }

  console.log('Fetched sample posts with profiles join:');
  posts.forEach(p => {
    console.log(`Post ID: ${p.id}, User ID: ${p.user_id}`);
    console.log(`Profile:`, p.profiles);
    console.log('---');
  });

  if (posts.every(p => p.profiles === null)) {
    console.log('\n[WARNING] All fetched posts have NULL profiles.');
    console.log('Possible causes:');
    console.log('1. User ID in posts table does not exist in profiles table.');
    console.log('2. Foreign Key relationship is missing or not detected by PostgREST.');
    console.log('3. RLS policies on "profiles" table prevent reading.');
  } else {
    console.log('\n[SUCCESS] Constraint seems to work for at least some posts.');
  }
}

checkConstraints();
