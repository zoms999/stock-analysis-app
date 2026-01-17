
import { NextResponse } from 'next/server';
import { updateMarketPrices } from '@/lib/price-scheduler';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

import { createClient as createServerClient } from '@/lib/supabase/server';

// This route is intended to be called by a Cron job (e.g. Vercel Cron) OR by an Admin
export async function GET(request: Request) {
  console.log('[Cron] Update Prices - Request received');
  
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET is not set in environment variables!');
  }

  // 1. Cron Job Authentication
  const authHeader = request.headers.get('authorization');
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  let isAdmin = false;

  // 2. Admin User Authentication (if not Cron)
  if (!isCron) {
    const hasCookies = request.headers.get('cookie');
    if (hasCookies) {
      try {
        const supabaseServer = await createServerClient();
        const { data: { user } } = await supabaseServer.auth.getUser();

        if (user) {
          const { data: userData } = await supabaseServer
            .from('users')
            .select('user_level')
            .eq('id', user.id)
            .single();
          
          if (userData && userData.user_level >= 99) {
            isAdmin = true;
          }
        }
      } catch (e: any) {
        console.warn('[Cron] Admin auth check failed (might be expected in non-browser context):', e.message);
      }
    }
  }

  if (!isCron && !isAdmin) {
    console.warn('[Cron] Unauthorized access attempt. No valid cron secret or admin session.');
    return new Response('Unauthorized', { status: 401 });
  }

  console.log(`[Cron] Authentication successful (isCron: ${isCron}, isAdmin: ${isAdmin})`);

  try {
    const result = await updateMarketPrices();
    
    if (result && result.success) {
      console.log(`[Cron] Price update successful: ${result.count} records`);
      
      // 6. Trigger Accuracy Calculation (DB Side)
      const { error: rpcError } = await supabase.rpc('calculate_and_update_accuracies');
      
      if (rpcError) {
        console.error('[Cron] Accuracy RPC failed:', rpcError);
        return NextResponse.json({ 
          message: 'Prices updated, but accuracy calculation failed', 
          priceData: result, 
          error: rpcError 
        });
      }

      // 7. Trigger Daily Accuracy Calculation (New System)
      const { error: dailyRpcError } = await supabase.rpc('calculate_daily_accuracies_v5');
      if (dailyRpcError) {
        console.error('[Cron] Daily Accuracy RPC failed:', dailyRpcError);
      }

      return NextResponse.json({ 
        message: 'Prices and Accuracies updated successfully', 
        data: result 
      });
    } else {
      console.error('[Cron] Price update failed in scheduler:', result?.error);
      return NextResponse.json({ message: 'Failed to update prices', error: result?.error }, { status: 500 });
    }
  } catch (error) {
    console.error('[Cron] Internal error:', error);
    return NextResponse.json({ message: 'Internal Server Error', error }, { status: 500 });
  }
}
