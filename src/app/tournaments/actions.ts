'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { PredictionSlot } from '@/types/tournament';

export async function unlockSlots(tournamentId: string) {
  try {
    console.log('[unlockSlots] Starting for:', tournamentId);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.error('[unlockSlots] No user found');
      return { error: 'Unauthorized' };
    }

    console.log('[unlockSlots] User found:', user.id);

    // Mock handling for dev testing
    if (tournamentId.startsWith('mock-')) {
       console.log('[unlockSlots] Mock tournament detected, skipping DB ops to avoid FK error');
       // In a real app we might mock the entry in a separate store or cookie, 
       // but for now we'll just return success so client doesn't explode, 
       // although UI won't update because revalidatePath won't have new data to fetch.
       // Only way to test this with mocks is if we fully mocked the DB layer or inserted the mock tournament.
       return { success: true, mock: true };
    }

    // Check existing entry
    const { data: entry, error: fetchError } = await supabase
      .from('tournament_entries')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows found"
        console.error('[unlockSlots] Error fetching entry:', fetchError);
        return { error: fetchError.message };
    }

    if (entry) {
      console.log('[unlockSlots] Updating existing entry:', entry.id);
      
      // Fetch tournament to get duration
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('event_type, start_date, end_date, target_date')
        .eq('id', tournamentId)
        .single();
      
      let maxSlots = 5; 
      if (tournament?.event_type === 'DECIMAL') {
          maxSlots = 3;
      } else if (tournament?.start_date && tournament?.end_date) {
        const start = new Date(tournament.start_date);
        const end = new Date(tournament.end_date);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        maxSlots = Math.max(1, diffDays);
      }
      
      if (entry.max_re_entry < maxSlots) {
        const { error: updateError } = await supabase
          .from('tournament_entries')
          .update({ max_re_entry: maxSlots })
          .eq('id', entry.id);
        
        if (updateError) {
             console.error('[unlockSlots] Update error:', updateError);
             return { error: updateError.message };
        }
      }
    } else {
      console.log('[unlockSlots] Creating new entry');
      
      
      // Fetch tournament to get duration
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('event_type, start_date, end_date, target_date')
        .eq('id', tournamentId)
        .single();
      
      let maxSlots = 5; // Default fallback
      if (tournament?.event_type === 'DECIMAL') {
          maxSlots = 3;
      } else if (tournament?.start_date && tournament?.end_date) {
        const start = new Date(tournament.start_date);
        const end = new Date(tournament.end_date);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        maxSlots = Math.max(1, diffDays);
      }
      
      // Create new entry with all slots unlocked
      const { error: insertError } = await supabase.from('tournament_entries').insert({
        tournament_id: tournamentId,
        user_id: user.id,
        re_entry_count: 0,
        max_re_entry: maxSlots,
        prediction_json: { slots: [] }
      });

      if (insertError) {
          console.error('[unlockSlots] Insert error:', insertError);
          return { error: insertError.message };
      }
    }

    console.log('[unlockSlots] Revalidating path');
    revalidatePath(`/tournaments/${tournamentId}`);
    return { success: true };
  } catch (err) {
      console.error('[unlockSlots] Unexpected error:', err);
      return { error: 'Internal Server Error' };
  }
}

export async function submitPrediction(tournamentId: string, slots: PredictionSlot[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  // Upsert entry with new slots
  // We need to keep max_re_entry if it exists, or default to 1
  
  // First check existing to preserve max_re_entry if we use simple upsert
  const { data: existing } = await supabase
    .from('tournament_entries')
    .select('max_re_entry')
    .eq('tournament_id', tournamentId)
    .eq('user_id', user.id)
    .single();

  const maxReEntry = existing?.max_re_entry || 1;

  // If user tries to submit more slots than allowed
  if (slots.length > maxReEntry) {
    throw new Error('Exceeded allowed slots');
  }

  // ✅ Check if prediction period is valid
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('start_date, end_date, target_date')
    .eq('id', tournamentId)
    .single();

  if (tournament) {
      const now = new Date();
      // If start_date is null, assume immediately open (or use created_at logic if preferred, but usually open)
      const start = tournament.start_date ? new Date(tournament.start_date) : new Date(0); 
      // If end_date is null, use target_date (legacy behavior)
      const end = tournament.end_date ? new Date(tournament.end_date) : new Date(tournament.target_date);
      
      if (now < start) {
          throw new Error('Prediction period has not started yet.');
      }
      if (now > end) {
          throw new Error('Prediction period has ended.');
      }
  }

  // Type 1 legacy support (first slot val)
  const firstVal = slots[0]?.val ?? null;

  const { error } = await supabase
    .from('tournament_entries')
    .upsert({
      tournament_id: tournamentId,
      user_id: user.id,
      prediction_value: firstVal, // Legacy column
      prediction_json: { slots },
      max_re_entry: maxReEntry
    }, { onConflict: 'tournament_id, user_id' });

  if (error) throw error;

  revalidatePath(`/tournaments/${tournamentId}`);
}
