'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getTournamentRanking } from '@/app/tournaments/ranking-actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RankingItem {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  prediction: string | number | null;
}

interface RealtimeLeaderboardProps {
  tournamentId: string;
}

export default function RealtimeLeaderboard({ tournamentId }: RealtimeLeaderboardProps) {
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const supabase = createClient();

  const fetchRankings = async () => {
    const data = await getTournamentRanking(tournamentId);
    setRankings(data);
  };

  useEffect(() => {
    fetchRankings();

    const channel = supabase
      .channel(`tournament_entries:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_entries',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          // When any change happens, re-fetch the ranking
          fetchRankings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  return (
    <Card className="bg-gray-900 border-gray-800 text-white w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span>👑 참가자 현황</span>
          <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
            {rankings.length}명 참여중
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        <div className="space-y-3">
          {rankings.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              아직 참가자가 없습니다.
              <br />
              첫 번째로 참가해보세요!
            </div>
          ) : (
            rankings.map((item, index) => (
              <div
                key={item.userId}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 text-center font-mono text-gray-500 font-bold">
                    #{index + 1}
                  </div>
                  <Avatar className="h-8 w-8 border border-gray-700">
                    <AvatarImage src={item.avatarUrl} />
                    <AvatarFallback>{item.nickname[0]}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm text-gray-200">
                    {item.nickname}
                  </span>
                </div>
                <div className="font-mono text-sm text-blue-400">
                  {item.prediction ? `${item.prediction}` : '-'}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
