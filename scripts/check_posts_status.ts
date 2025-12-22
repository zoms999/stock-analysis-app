
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, title, ticker_symbol, prediction_status, created_at');

  if (error) {
    console.error('Error fetching posts:', error);
    return;
  }

  console.log(`Found ${posts?.length || 0} posts.`);
  if (posts && posts.length > 0) {
    console.table(posts);
  } else {
    console.log("No posts found.");
  }
  
  const { data: assets } = await supabase.from('assets').select('*');
  console.log(`Found ${assets?.length || 0} assets.`);
  if (assets && assets.length > 0) console.table(assets);
}

check();
