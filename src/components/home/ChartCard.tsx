"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PredictionStatus } from "@/lib/api/posts";
import { checkCanViewPost } from "@/lib/api/posts";
import { toast } from "sonner";

// Use SavedChartViewer for displaying saved charts with configuration
const SavedChartViewer = dynamic(() => import("@/components/analyze/SavedChartViewer").then(mod => mod.SavedChartViewer), {
  ssr: false,
  loading: () => <div className="h-[180px] w-full bg-muted/10 animate-pulse" />
});

interface ChartCardProps {
  id: string;
  symbol: string;
  source?: "upbit" | "yahoo" | "finnhub";
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
  predictionStatus?: PredictionStatus;
  chartConfig?: any; // Chart configuration from post
}

export function ChartCard({ id, symbol, title, user, stats, predictionStatus, chartConfig }: ChartCardProps) {
  const router = useRouter();
  
  const statusColors = {
    SUCCESS: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/50",
    FAIL: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/50",
    WAITING: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/50",
    TIMEOUT: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/50",
  };

  const statusLabels = {
    SUCCESS: "성공",
    FAIL: "실패",
    WAITING: "진행중",
    TIMEOUT: "만료",
  };

  // Extract chart configuration
  const interval = chartConfig?.interval || "D";
  const predictionPoints = chartConfig?.prediction_points || [];
  const chartStyle = chartConfig?.chartStyle || "line";

  // Handle card click with view limit check
  const handleCardClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Check if user can view this post
    const { canView, reason } = await checkCanViewPost(id);
    
    if (!canView) {
      // Show toast notification
      toast.error(reason || "게시물을 볼 수 없습니다.", {
        description: "구독 플랜을 업그레이드하거나 포인트로 추가 열람권을 구매하세요.",
        duration: 4000,
      });
      return;
    }
    
    // Navigate to post detail page
    router.push(`/posts/${id}`);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Chart Section */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all group relative">
        <div className="p-4 pb-2 flex justify-between items-center">
            <h3 className="font-bold text-sm text-foreground/80">{symbol} Price</h3>
            {predictionStatus && (
              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${statusColors[predictionStatus]}`}>
                {statusLabels[predictionStatus]}
              </span>
            )}
        </div>
        
        {/* Chart Area - Fixed Height */}
        <div className="h-[180px] w-full pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
            <SavedChartViewer
              symbol={symbol}
              interval={interval}
              predictionPoints={predictionPoints}
              chartStyle={chartStyle}
              showStyleToggle={false}
            />
        </div>

        {/* Floating Action Button */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
             <Button size="sm" className="bg-[#4A90E2] hover:bg-[#357ABD] text-white shadow-lg h-7 text-xs px-4">
                Save Point
             </Button>
        </div>
      </div>

      {/* User Info Section */}
      <div onClick={handleCardClick} className="flex items-start gap-3 group/info cursor-pointer">
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
      </div>
    </div>
  );
}

