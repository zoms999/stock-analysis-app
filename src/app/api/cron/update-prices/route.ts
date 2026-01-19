
import { NextResponse } from 'next/server';
import { updateMarketPrices } from '@/lib/price-scheduler';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

import { createClient as createServerClient } from '@/lib/supabase/server';

// This route is now publicly accessible for price synchronization
export async function GET(request: Request) {
  console.log('[Cron] Update Prices - Request received');

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
