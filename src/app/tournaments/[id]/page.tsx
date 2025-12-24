import { createClient } from '@/lib/supabase/server';
import TournamentDetailView from '@/components/tournaments/TournamentDetailView';
import { unlockSlots, submitPrediction } from '../actions';
import { Tournament, TournamentEntry } from '@/types/tournament';
import { notFound } from 'next/navigation';

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch Tournament
  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single();

  // Prioritize real data
  let tournamentData = tournament as Tournament;
  
  // Minimal fallback for development/testing if ID is clearly a mock
  if (!tournamentData && id.startsWith('mock-')) {
     tournamentData = {
        id: id,
        title: id === 'mock-1' ? 'Weekly Samsung Price Prediction' : 'KOSPI Decimal Lotto',
        description: 'Mock Description',
        event_type: id === 'mock-1' ? 'PREDICTION' : 'DECIMAL',
        target_date: new Date().toISOString(),
        status: 'OPEN',
        prize_pool: '1,000,000 P',
        created_at: new Date().toISOString()
     };
  }

  // If still no data, show not found
  if (!tournamentData) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center text-white">
            <div className="text-center">
                <h1 className="text-2xl font-bold mb-2">Tournament Not Found</h1>
                <p className="text-gray-400">The tournament you are looking for does not exist.</p>
                 <a href="/tournaments" className="mt-4 inline-block text-blue-500 hover:text-blue-400">Return to Lobby</a>
            </div>
        </div>
      );
  }

  // Fetch User Entry
  let userEntry: TournamentEntry | null = null;
  if (user) {
    const { data: entry } = await supabase
      .from('tournament_entries')
      .select('*')
      .eq('tournament_id', id)
      .eq('user_id', user.id)
      .single();
    userEntry = entry as TournamentEntry;
  }

  // Bind actions
  async function unlockAction() {
    'use server';
    await unlockSlots(id);
  }

  async function submitAction(slots: any[]) {
    'use server';
    await submitPrediction(id, slots);
  }

  return (
    <TournamentDetailView 
      tournament={tournamentData}
      userEntry={userEntry}
      onUnlockSlots={unlockAction}
      onSubmit={submitAction}
    />
  );
}
