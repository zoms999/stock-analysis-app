
import { NextResponse } from 'next/server';
import { updateMarketPrices } from '@/lib/price-scheduler';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

import { createClient as createServerClient } from '@/lib/supabase/server';

// This route is intended to be called by a Cron job (e.g. Vercel Cron) OR by an Admin
export async function GET(request: Request) {
  // 1. Cron Job Authentication
  const authHeader = request.headers.get('authorization');
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  let isAdmin = false;

  // 2. Admin User Authentication (if not Cron)
  if (!isCron) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Check user level
      const { data: userData } = await supabase
        .from('users')
        .select('user_level')
        .eq('id', user.id)
        .single();
      
      if (userData && userData.user_level >= 99) {
        isAdmin = true;
      }
    }
  }

  if (!isCron && !isAdmin) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const result = await updateMarketPrices();
    
    if (result && result.success) {
      // 6. Trigger Accuracy Calculation (DB Side)
      const { error: rpcError } = await supabase.rpc('calculate_and_update_accuracies');
      
      if (rpcError) {
        console.error('Failed to update accuracies:', rpcError);
        // We still return success for price update, but note the error
        return NextResponse.json({ 
          message: 'Prices updated, but accuracy calculation failed', 
          priceData: result, 
          error: rpcError 
        });
      }

      // 7. Trigger Daily Accuracy Calculation (New System)
      const { error: dailyRpcError } = await supabase.rpc('calculate_daily_accuracies_v4');
      if (dailyRpcError) {
        console.error('Failed to update daily accuracies:', dailyRpcError);
        // Continue, as this is a separate system
      }

      return NextResponse.json({ 
        message: 'Prices and Accuracies updated successfully', 
        data: result 
      });
    } else {
      return NextResponse.json({ message: 'Failed to update prices', error: result?.error }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ message: 'Internal Server Error', error }, { status: 500 });
  }
}
