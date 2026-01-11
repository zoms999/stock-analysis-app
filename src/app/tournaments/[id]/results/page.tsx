import { createClient } from '@/lib/supabase/server';
import { Crown, Trophy, Medal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { format } from 'date-fns';

export default async function TournamentResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  // 1. Fetch Tournament Info
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single();

  if (!tournament) return <div>Tournament not found</div>;

  // 2. Fetch Entries
  const { data: entries } = await supabase
    .from('tournament_entries')
    .select('*, profiles:user_id(nickname, avatar_url)')
    .eq('tournament_id', id);

  // 3. Find Winners from Transactions
  const { data: winnersTx } = await supabase
    .from('point_transactions')
    .select('*')
    .ilike('reason', `Tournament ${tournament.title}%`); // Fuzzy match reason
    
  // Map winners from Tx
  const winnerMap = new Map();
  winnersTx?.forEach((tx) => {
      // Parse rank from reason "Rank #1"
      const match = tx.reason.match(/Rank #(\d)/);
      if (match) {
          winnerMap.set(tx.user_id, { rank: parseInt(match[1]), amount: tx.amount });
      }
  });

  const participantList = entries?.map((entry: any) => {
      const winInfo = winnerMap.get(entry.user_id);
      return {
          ...entry,
          nickname: entry.profiles?.nickname || 'Unknown',
          avatarUrl: entry.profiles?.avatar_url,
          rank: winInfo?.rank || 999,
          prize: winInfo?.amount || 0,
          prediction: entry.prediction_value // Simplified
      };
  }) || [];

  // Sort by rank
  participantList.sort((a, b) => a.rank - b.rank);

  // Date Formatting
  const startDate = tournament.start_date ? new Date(tournament.start_date) : null;
  const endDate = tournament.end_date ? new Date(tournament.end_date) : new Date(tournament.target_date);
  const dateStr = startDate 
        ? `${format(startDate, 'yyyy.MM.dd')} ~ ${format(endDate, 'MM.dd')}`
        : format(endDate, 'yyyy.MM.dd');

  const prizeUnit = tournament.prize_type === 'VOUCHER' ? '상품권' : 'P';

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <Badge className="mb-2 bg-gray-800">{dateStr} 종료</Badge>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600">
            {tournament.title} 결과
          </h1>
          <p className="text-gray-400">총 상금 {tournament.prize_pool} {prizeUnit !== 'P' ? '' : prizeUnit}</p>
        </div>

        {/* Winners Podium */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10">
           {participantList.filter(p => p.rank <= 3).map((winner) => (
             <Card 
               key={winner.user_id} 
               className={`border-0 bg-gradient-to-b ${
                 winner.rank === 1 ? 'from-yellow-500/20 to-yellow-900/10 border-yellow-500/50' :
                 winner.rank === 2 ? 'from-gray-300/20 to-gray-800/10 border-gray-400/50' :
                 'from-amber-700/20 to-amber-900/10 border-amber-700/50'
               } border`}
             >
                <CardHeader className="text-center pb-2">
                   {winner.rank === 1 && <Crown className="mx-auto h-8 w-8 text-yellow-500 mb-2" />}
                   {winner.rank === 2 && <Trophy className="mx-auto h-8 w-8 text-gray-400 mb-2" />}
                   {winner.rank === 3 && <Medal className="mx-auto h-8 w-8 text-amber-700 mb-2" />}
                   <Avatar className="mx-auto h-16 w-16 border-2 border-white/10">
                     <AvatarImage src={winner.avatarUrl} />
                     <AvatarFallback>{winner.nickname[0]}</AvatarFallback>
                   </Avatar>
                   <CardTitle className="mt-2 text-white">{winner.nickname}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <div className="text-2xl font-bold text-white mb-1">
                        {winner.prize.toLocaleString()} {prizeUnit}
                    </div>
                </CardContent>
             </Card>
           ))}
        </div>

        {/* Full List */}
        <Card className="bg-gray-900 border-gray-800 text-white">
            <CardHeader>
                <CardTitle className="text-white">전체 순위</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {participantList.map((p) => (
                        <div key={p.user_id} className="flex items-center justify-between p-3 rounded bg-gray-800/50">
                            <div className="flex items-center gap-4">
                                <span className={`font-mono font-bold w-6 text-center ${p.rank <= 3 ? 'text-yellow-500' : 'text-gray-500'}`}>
                                    {p.rank > 100 ? '-' : p.rank}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={p.avatarUrl} />
                                        <AvatarFallback>{p.nickname[0]}</AvatarFallback>
                                    </Avatar>
                                    <span>{p.nickname}</span>
                                </div>
                            </div>
                            <div className="text-gray-400">
                                {p.prize > 0 && `+${p.prize.toLocaleString()} ${prizeUnit}`}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>

        <div className="text-center">
            <Link href="/tournaments">
                <Button variant="outline">목록으로 돌아가기</Button>
            </Link>
        </div>
      </div>
    </div>
  );
}
