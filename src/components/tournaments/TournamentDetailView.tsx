import { Tournament, TournamentEntry, PredictionSlot } from '@/types/tournament';
import PredictionPanel from './PredictionPanel';
import RealtimeLeaderboard from './RealtimeLeaderboard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface TournamentDetailViewProps {
  tournament: Tournament;
  userEntry: TournamentEntry | null;
  // Actions
  onUnlockSlots: () => Promise<void>;
  onSubmit: (slots: PredictionSlot[]) => Promise<void>;
}

export default function TournamentDetailView({ tournament, userEntry, onUnlockSlots, onSubmit }: TournamentDetailViewProps) {
  const isEnded = tournament.status === 'SETTLED' || new Date(tournament.target_date) < new Date();

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        
        {/* Header - Mobile only */}
        <div className="lg:hidden col-span-1 border-b border-gray-800 pb-4">
           <h1 className="text-2xl font-bold mb-2">{tournament.title}</h1>
           <p className="text-gray-400 text-sm">{tournament.description}</p>
        </div>

        {/* Left Column: Chart & Info */}
        <div className="lg:col-span-8 flex flex-col gap-6">
           {/* Chart Area */}
           <div className="flex-1 min-h-[500px] bg-gray-900 rounded-2xl border border-gray-800 p-4 flex flex-col justify-center items-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black opacity-50" />
              <div className="z-10 text-center">
                 <h3 className="text-2xl font-bold text-gray-700 mb-2">실시간 차트 영역</h3>
                 <p className="text-gray-500">차트 컴포넌트가 이곳에 표시될 예정입니다.</p>
                 <p className="text-xs text-gray-600 mt-2">목표 시간: {new Date(tournament.target_date).toLocaleString()}</p>
              </div>
           </div>

           {/* Results Button if Ended */}
           {isEnded && (
             <div className="bg-yellow-900/20 border border-yellow-700/50 p-6 rounded-xl text-center">
                <h3 className="text-xl font-bold text-yellow-500 mb-2">대회가 종료되었습니다!</h3>
                <p className="text-gray-400 mb-4">결과를 확인하고 상금을 수령하세요 (자동 지급됨).</p>
                <Link href={`/tournaments/${tournament.id}/results`}>
                    <Button size="lg" className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold">
                        🏆 결과 확인하기
                    </Button>
                </Link>
             </div>
           )}

           {/* Info / Rule Book */}
           <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800/50">
              <h4 className="font-bold text-gray-300 mb-2">대회 규칙</h4>
              <ul className="list-disc list-inside text-sm text-gray-500 space-y-1">
                <li>목표 시간의 종가를 예측하세요.</li>
                <li>실제 가격과 가장 가까운 예측을 한 참가자가 승리합니다.</li>
                <li>친구에게 공유하고 최대 3개의 예측 슬롯을 잠금 해제하세요.</li>
              </ul>
           </div>
        </div>

        {/* Right Column: Interaction & Leaderboard */}
        <div className="lg:col-span-4 flex flex-col gap-6">
           <div className="hidden lg:block">
              <h1 className="text-3xl font-black mb-2 leading-tight">{tournament.title}</h1>
              <div className="text-2xl font-bold text-yellow-500 mb-4">{tournament.prize_pool}</div>
           </div>

           {!isEnded && (
             <PredictionPanel 
               tournament={tournament}
               userEntry={userEntry}
               onUnlockSlots={onUnlockSlots}
               onSubmit={onSubmit}
             />
           )}

           {/* Real-time Leaderboard */}
           <RealtimeLeaderboard tournamentId={tournament.id} />
        </div>

      </div>
    </div>
  );
}
