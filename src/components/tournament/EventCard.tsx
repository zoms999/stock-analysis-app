
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

interface EventCardProps {
  title: string;
  prizePool: string;
  participants: number;
  timeLeft: string;
  status: "live" | "upcoming" | "ended";
  imageUrl?: string;
  className?: string;
}

export function EventCard({
  title,
  prizePool,
  participants,
  timeLeft,
  status,
  className,
}: EventCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10",
        className
      )}
    >
      {/* Background Gradient Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header: Status & Icon */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className={cn(
                "rounded-full p-2",
                status === "live" ? "bg-red-500/10 text-red-500" : 
                status === "upcoming" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
                <Trophy className="h-5 w-5" />
            </div>
            <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider",
                status === "live" ? "bg-red-500 text-white animate-pulse" : 
                status === "upcoming" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
                {status === "live" ? "진행 중" : status === "upcoming" ? "접수 중" : "종료"}
            </span>
          </div>
          {status === "live" && (
             <div className="flex items-center text-xs text-red-400 font-mono">
                <Clock className="mr-1 h-3 w-3" />
                {timeLeft}
             </div>
          )}
        </div>

        {/* Content */}
        <div className="mb-6 flex-1">
          <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
            {title}
          </h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground">총 상금</span>
            <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500">
              {prizePool}
            </span>
          </div>
          <div className="mt-2 flex items-center text-sm text-muted-foreground">
            <Users className="mr-1 h-4 w-4" />
            <span>{participants.toLocaleString()}명 참가 중</span>
          </div>
        </div>

        {/* Action */}
        <Button className="w-full relative overflow-hidden" variant={status === 'ended' ? 'secondary' : 'premium'}>
            <span className="relative z-10 flex items-center justify-center">
                {status === "live" ? "참가하기" : status === "upcoming" ? "사전 등록" : "결과 보기"}
                <ArrowRight className="ml-2 h-4 w-4" />
            </span>
        </Button>
      </div>
    </div>
  );
}
