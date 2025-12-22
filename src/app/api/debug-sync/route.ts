
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const { data: assets } = await supabase.from('assets').select('*');
  const { data: posts } = await supabase.from('posts').select('id, ticker_symbol, prediction_status, prediction_type');
  
  return NextResponse.json({
    assets,
    posts,
    waitingPosts: posts?.filter(p => p.prediction_status === 'WAITING')
  });
}
