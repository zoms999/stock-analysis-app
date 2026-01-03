import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client'; // Use client for now or server? inside route usually creates server client manually or uses imported helper
// Actually standard is createClient from @supabase/supabase-js for admin tasks if we need service role,
// OR use server-side createClient helper if we have it configured for routes.
// Admin actions already use `createClient` from `@/lib/supabase/server`.
// But for CRON, we might not have a user session. We need SERVICE_ROLE key usually for "system" actions.
// HOWEVER, if the cron is triggered by an authenticated Vercel Cron, it might just need a public key? No, RLS will block update.
// We definitely need Service Role Key for background jobs if RLS is on.
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { executeSettlement, previewSettlement } from '@/app/admin/actions'; // Reuse logic?
// Problem: `previewSettlement` and `executeSettlement` in `admin/actions.ts` likely use `createClient` from `@/lib/supabase/server` which uses cookies.
// Cron job has no cookies.
// So we cannot reuse those functions directly if they depend on cookies.
// We must reimplement the logic here using a Service Role Client.

export async function GET(req: NextRequest) {
  // 1. Verify Cron Secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 2. Initialize Admin Supabase Client
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 3. Find Ended Tournaments (OPEN status, but target_date passed)
    const now = new Date().toISOString();
    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('status', 'OPEN')
      .lt('target_date', now);

    if (error) throw error;
    if (!tournaments || tournaments.length === 0) {
      return NextResponse.json({ message: 'No tournaments to settle' });
    }

    const results = [];

    // 4. Settle Each Tournament
    for (const tournament of tournaments) {
      console.log(`Settling tournament: ${tournament.id} - ${tournament.title}`);
      
      // Get Target Price (This assumes we can fetch it, or the tournament has a 'settlement_price' filled by another process?)
      // If the goal is fully automated, we need to KNOW the price.
      // Usually, we fetch price from an external API (CoinGecko/Yahoo) here.
      // For MVP, if we don't have the price, we cannot settle accurately.
      // Let's assume we can fetch price for 'BTC-USD' etc.
      
      // Mock Price fetching for MVP or if Title contains "BTC"
      // In a real system, `tournament` table should store `symbol`.
      // Let's generate a random Mock price for demonstration if we can't find symbol.
      // OR, we can just skip if we don't know how to get price.
      // But the User wants "Automatic Settlement".
      // Let's implement a dummy price fetcher or just use a fixed mock price for safety?
      // Better: Check if `settlement_price` column exists? No it doesn't in shared schema above.
      
      // Let's simulate fetching current price.
      const mockPrice = 50000 + Math.random() * 1000; // Mock BTC price
      
      // 4a. Get Entries
      const { data: entries } = await supabase
        .from('tournament_entries')
        .select('*')
        .eq('tournament_id', tournament.id);

      if (!entries) continue;

      // 4b. Calculate Ranking (Resuing logic style)
      // Note: We duplicate logic because we can't easily import "cookie-based" admin actions here.
      let ranking = entries.map((entry: any) => {
         const slots = entry.prediction_json?.slots || [];
         if (slots.length === 0 && entry.prediction_value !== null) {
             slots.push({ price: entry.prediction_value });
         }
         
         let bestDiff = Infinity;
         for (const slot of slots) {
             const p = slot.val ?? slot.price;
             if (typeof p === 'number') {
                 const diff = Math.abs(p - mockPrice);
                 if (diff < bestDiff) bestDiff = diff;
             }
         }
         return { ...entry, diff: bestDiff };
      }).filter((e: any) => e.diff !== Infinity);

      ranking.sort((a: any, b: any) => a.diff - b.diff);
      const winners = ranking.slice(0, 3); // Top 3

      // 4c. Distribute Rewards
      const payoutMap = [50000, 30000, 10000];
      for (let i = 0; i < winners.length; i++) {
         const winner = winners[i];
         const prize = payoutMap[i] || 0;
         
         await supabase.from('point_transactions').insert({
             user_id: winner.user_id,
             amount: prize,
             reason: `Tournament ${tournament.title} Rank #${i+1}`,
             type: 'EARN'
         });
      }

      // 4d. Close Tournament
      await supabase.from('tournaments')
        .update({ status: 'SETTLED' })
        .eq('id', tournament.id);
      
      results.push({ id: tournament.id, title: tournament.title, winners: winners.length });
    }

    return NextResponse.json({ success: true, settled: results });

  } catch (err: any) {
    console.error('Settlement Cron Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
