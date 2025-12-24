import { createClient } from '@/lib/supabase/server';
import TournamentItem from '@/components/tournaments/TournamentItem';
import { Tournament } from '@/types/tournament';

export const dynamic = 'force-dynamic';

export default async function TournamentsPage() {
  const supabase = await createClient();
  
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 border-b border-gray-800 pb-8">
          <div>
            <span className="text-blue-500 font-bold tracking-widest text-sm mb-2 block">COMPETITION</span>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
              진행 중인 토너먼트
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl">
              실전 투자 대회에 참여하고, 예측을 제출하여 상금을 획득하세요.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments?.map((tournament) => (
            <TournamentItem key={tournament.id} tournament={tournament} />
          ))}

          {(!tournaments || tournaments.length === 0) && !error && (
             <div className="col-span-full py-20 text-center bg-[#111315] rounded-2xl border border-dashed border-gray-800">
               <div className="text-gray-500 text-xl font-medium">진행 중인 토너먼트가 없습니다.</div>
               <p className="text-gray-600 mt-2">나중에 다시 확인해주세요.</p>
             </div>
          )}
        </div>
        
        {error && (
           <div className="p-4 bg-red-900/10 border border-red-900/30 rounded-lg text-red-400 mt-4">
             Failed to load tournaments. Error: {error.message}
           </div>
        )}
      </div>
    </div>
  );
}
