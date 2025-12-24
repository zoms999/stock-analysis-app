'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { PredictionSlot } from '@/types/tournament';

export async function unlockSlots(tournamentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Demo mode or return error
    return { error: 'Unauthorized' };
  }

  // Check existing entry
  const { data: entry } = await supabase
    .from('tournament_entries')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('user_id', user.id)
    .single();

  if (entry) {
    if (entry.max_re_entry < 3) {
      await supabase
        .from('tournament_entries')
        .update({ max_re_entry: 3 })
        .eq('id', entry.id);
    }
  } else {
    // Create new entry with 3 slots unlocked
    await supabase.from('tournament_entries').insert({
      tournament_id: tournamentId,
      user_id: user.id,
      re_entry_count: 0,
      max_re_entry: 3,
      prediction_json: { slots: [] }
    });
  }

  revalidatePath(`/tournaments/${tournamentId}`);
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
