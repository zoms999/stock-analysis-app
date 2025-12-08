
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // We might need to implement Avatar or just use divs for now
import { Medal, TrendingUp } from "lucide-react";

interface Ranker {
  id: string;
  rank: number;
  name: string;
  profitRate: number;
  winRate: number;
  avatar?: string;
}

interface LeaderboardProps {
  data: Ranker[];
  className?: string;
}

export function Leaderboard({ data, className }: LeaderboardProps) {
  return (
    <div className={cn("bg-card rounded-xl border border-border overflow-hidden", className)}>
      <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
        <h3 className="font-bold flex items-center">
            <Medal className="mr-2 h-5 w-5 text-yellow-500" />
            실시간 랭킹
        </h3>
        <span className="text-xs text-muted-foreground">10분마다 갱신</span>
      </div>
      
      <div className="divide-y divide-border">
        {data.map((ranker) => (
          <div
            key={ranker.id}
            className={cn(
              "flex items-center p-4 hover:bg-muted/50 transition-colors",
              ranker.rank <= 3 ? "bg-primary/5" : ""
            )}
          >
            {/* Rank */}
            <div className="w-12 flex-shrink-0 flex justify-center">
              {ranker.rank === 1 ? (
                <span className="text-2xl">🥇</span>
              ) : ranker.rank === 2 ? (
                <span className="text-2xl">🥈</span>
              ) : ranker.rank === 3 ? (
                <span className="text-2xl">🥉</span>
              ) : (
                <span className="text-lg font-bold text-muted-foreground">
                  {ranker.rank}
                </span>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0 ml-2">
                <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center mr-3 border border-border">
                        <span className="text-xs font-bold">{ranker.name.slice(0, 2)}</span>
                    </div>
                    <div className="truncate">
                        <p className={cn(
                            "text-sm font-medium truncate",
                            ranker.rank === 1 ? "text-yellow-500 font-bold" : "text-foreground"
                        )}>
                            {ranker.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            승률 {ranker.winRate}%
                        </p>
                    </div>
                </div>
            </div>

            {/* Profit Rate */}
            <div className="text-right">
              <div className="flex items-center justify-end text-green-500 font-bold">
                <TrendingUp className="h-3 w-3 mr-1" />
                {ranker.profitRate > 0 ? "+" : ""}{ranker.profitRate}%
              </div>
              <p className="text-xs text-muted-foreground">수익률</p>
            </div>
          </div>
        ))}
        
        {data.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
                집계된 랭킹 데이터가 없습니다.
            </div>
        )}
      </div>
    </div>
  );
}
