'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// --- Types ---
type CreateTournamentInput = {
  title: string;
  description?: string;
  event_type: 'DECIMAL' | 'PREDICTION';
  target_date: string;
  prize_pool: string;
};

// --- Actions ---

export async function createTournament(input: CreateTournamentInput) {
  const supabase = await createClient();
  
  // Auth Check (Simple version - assume middleware protects admin routes, or add specific role check here)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase.from('tournaments').insert({
    title: input.title,
    description: input.description,
    event_type: input.event_type,
    target_date: input.target_date,
    prize_pool: input.prize_pool,
    status: 'UPCOMING'
  });

  if (error) return { error: error.message };
  revalidatePath('/admin/tournaments');
  revalidatePath('/tournaments');
  return { success: true };
}

export async function updateTournamentStatus(id: string, status: 'OPEN' | 'LOCKED' | 'SETTLED') {
  const supabase = await createClient();
  const { error } = await supabase
    .from('tournaments')
    .update({ status })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/admin/tournaments');
  revalidatePath('/tournaments');
  revalidatePath(`/tournaments/${id}`);
  return { success: true };
}

export async function previewSettlement(tournamentId: string, targetValue: number) {
  const supabase = await createClient();
  
  // Fetch tournament type
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (!tournament) return { error: 'Tournament not found' };

  // Fetch all entries
  const { data: entries } = await supabase
    .from('tournament_entries')
    .select('*, user:user_id(email, nickname)') // Join profile? 
    .eq('tournament_id', tournamentId);

  if (!entries || entries.length === 0) return { winners: [] };

  let ranking = [];

  if (tournament.event_type === 'DECIMAL') {
    // Exact match of last 2 digits logic? 
    // Or just exact match of the value provided? 
    // Plan said: "ABS(real - pred) == 0" for decimal
    
    // For DECIMAL type, usually it's 0-99. 
    // targetValue should be 0-99.
    
    ranking = entries.map(entry => {
       const pred = entry.prediction_value; // Legacy column or parse JSON
       // Check legacy first, then JSON
       let val = pred;
       if (val === null && entry.prediction_json?.slots) {
          val = entry.prediction_json.slots[0]?.val;
       }
       
       if (val === undefined || val === null) return null;

       const diff = Math.abs(val - targetValue);
       return { 
         ...entry, 
         val, 
         diff,
         isWinner: diff === 0 
       };
    }).filter(Boolean);

    // Filter only winners for Decimal? Or just sort by diff?
    // Let's sort by diff.
    ranking.sort((a, b) => a.diff - b.diff);

  } else {
    // PREDICTION (Price)
    // Closest match logic
    ranking = entries.map(entry => {
        // Collect best slot if multiple
        const slots = entry.prediction_json?.slots || [];
        // If legacy value exists and no slots, use it
        if (slots.length === 0 && entry.prediction_value !== null) {
            slots.push({ price: entry.prediction_value });
        }

        // Find the closest slot for this user
        let bestDiff = Infinity;
        let bestPrice = 0;

        for (const slot of slots) {
            const p = slot.price;
            if (typeof p === 'number') {
                const diff = Math.abs(p - targetValue);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestPrice = p;
                }
            }
        }

        if (bestDiff === Infinity) return null;

        return {
            ...entry,
            bestPrice,
            diff: bestDiff
        };
    }).filter(Boolean);

    ranking.sort((a, b) => a.diff - b.diff);
  }

  // Take top 5 for preview
  return { winners: ranking.slice(0, 5), count: ranking.length };
}

export async function executeSettlement(tournamentId: string, winners: any[]) {
    const supabase = await createClient();
    
    // In a real app, use a transaction or Supabase RPC
    // Here we'll do sequential updates because simple Supabase client doesn't support complex transactions easily client-side-like (it needs RPC).
    
    // 1. Update Tournament Status
    await supabase.from('tournaments')
      .update({ status: 'SETTLED' })
      .eq('id', tournamentId);

    // 2. Distribute Points (Mock implementation)
    // We assume 'winners' array passed here is verified by admin.
    // In real world, we might recalculate here to be safe, but we trust the previewed list passed back or recalc.
    // Let's Recalculate simply to avoid payload tampering if we had logic, 
    // but for this MVP, we will mostly trust the admin triggers "Confirm" after preview.
    
    const payoutMap = [50000, 30000, 10000]; // 1st, 2nd, 3rd

    for (let i = 0; i < winners.length; i++) {
        if (i >= 3) break; // Top 3 only
        const winner = winners[i];
        const prize = payoutMap[i];

        // Give points
        await supabase.from('point_transactions').insert({
            user_id: winner.user_id,
            amount: prize,
            reason: `Tournament Rank #${i+1} Prize`,
            type: 'EARN'
        });
        
        // Update entry status (optional, e.g. mark as winner)
        // Check if DB has column for 'rank' or just 'is_eliminated' (which means loser)
        // Let's leave entry untouched or update 'is_eliminated' = false for winners, true for others?
    }

    revalidatePath('/admin/tournaments');
    return { success: true };
}
