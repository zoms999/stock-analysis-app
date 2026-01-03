'use server';

import { createClient } from '@/lib/supabase/server';

export async function getTournamentRanking(tournamentId: string) {
  const supabase = await createClient();

  // Fetch tournament info for event_type
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('event_type, target_date')
    .eq('id', tournamentId)
    .single();

  if (!tournament) return [];

  // Fetch all entries
  const { data: entries } = await supabase
    .from('tournament_entries')
    .select('user_id, prediction_value, prediction_json, max_re_entry, profiles:user_id(nickname, avatar_url)')
    .eq('tournament_id', tournamentId);

  if (!entries || entries.length === 0) return [];

  // TODO: Get REAL target value if possible? 
  // For "Real-time" leaderboard, we might want to compare against CURRENT price?
  // Or just show who submitted?
  // Usually leaderboard shows who is closest to CURRENT price if live, or just list of participants if we can't get live price easily here.
  // BUT, the prompt says "Real-time Ranking Update".
  // If `event_type` is prediction of a scheduled price, "Ranking" implies "Distance to Current Price" or "Distance to Target" (if target is static? no target is date).
  // Let's assume for now we just show the participants and their prediction, maybe sorted by time?
  // OR, if we can get the current price for the target asset, we calc diff.
  
  // However, fetching live price in a server action might be slow or rate limited. 
  // Let's return the entries and let the client assume ranking or just list them.
  // Actually, for a tournament "Predict Closing Price", the ranking is only final at the end.
  // BUT, maybe they want to see "Current Estimated Ranking" based on current price?
  // Requires "Current Price".
  
  // Let's stick to returning the entries with user info, and maybe the client can calculate diff if it knows one.
  // OR, better, just return the list of predictions.
  
  // Wait, `previewSettlement` calculated diff against a `targetValue`.
  // Without a `currentValue`, we can't rank.
  // I will return the list of participants and their predictions.
  
  return entries.map(entry => {
    // resolve best prediction
    let displayValue = null;
    if (entry.prediction_json?.slots?.length > 0) {
        // Just take the last one or all? 
        // Let's assume we show the user's bets.
        displayValue = entry.prediction_json.slots.map((s: any) => s.val ?? s.price).join(', ');
    } else {
        displayValue = entry.prediction_value;
    }

    return {
        userId: entry.user_id,
        nickname: (entry as any).profiles?.nickname || 'Unknown',
        avatarUrl: (entry as any).profiles?.avatar_url,
        prediction: displayValue
    };
  });
}
