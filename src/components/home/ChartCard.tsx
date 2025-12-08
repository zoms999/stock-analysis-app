"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Simple dynamic import for a lightweight chart version (or Reuse TechChart with interactive=false)
const TechChart = dynamic(() => import("@/components/chart/TechChart").then(mod => mod.TechChart), {
  ssr: false,
  loading: () => <div className="h-[180px] w-full bg-muted/10 animate-pulse" />
});

interface ChartCardProps {
  id: number;
  symbol: string;
  source: "upbit" | "finnhub";
  title: string;
  user: {
    name: string;
    level: string;
    ranking: number;
    avatar?: string;
  };
  stats: {
    profit: string; // e.g., "900만 92%"
    winRate: string; // e.g., "최근 80%"
    count: string; // e.g., "전체 70% 102개"
  };
}

export function ChartCard({ id, symbol, source, title, user, stats }: ChartCardProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Chart Section */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all group relative">
        <div className="p-4 pb-2 flex justify-between items-center">
            <h3 className="font-bold text-sm text-foreground/80">{symbol} Price</h3>
        </div>
        
        {/* Chart Area - Fixed Height */}
        <div className="h-[180px] w-full pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
             {/* Pass a special "mini" prop or just use as is for now */}
            <TechChart source={source} symbol={symbol} /> 
        </div>

        {/* Floating Action Button */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
             <Button size="sm" className="bg-[#4A90E2] hover:bg-[#357ABD] text-white shadow-lg h-7 text-xs px-4">
                Save Point
             </Button>
        </div>
      </div>

      {/* User Info Section */}
      <Link href={`/posts/${id}`} className="flex items-start gap-3 group/info cursor-pointer">
        <div className="flex flex-col items-center gap-1">
             <Avatar className="h-10 w-10 border border-border">
                <AvatarImage src={user.avatar} />
                <AvatarFallback>{user.name[0]}</AvatarFallback>
             </Avatar>
             <span className="text-[10px] text-muted-foreground font-medium">
                {user.level}
             </span>
             <span className="text-[10px] text-muted-foreground font-medium">
                랭킹{user.ranking}
             </span>
        </div>
        <div className="flex-1 space-y-1">
            <h4 className="font-bold text-sm group-hover/info:text-primary transition-colors">
                {title}
                <span className="ml-2 text-[#4A90E2]">{stats.profit}</span>
            </h4>
            <div className="text-xs text-muted-foreground">
                {stats.winRate} • {stats.count}
            </div>
        </div>
      </Link>
    </div>
  );
}
