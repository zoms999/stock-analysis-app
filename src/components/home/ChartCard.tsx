"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PredictionStatus } from "@/lib/api/posts";
import { checkCanViewPost } from "@/lib/api/posts";
import { toast } from "sonner";
import { useState } from "react";
import { LimitPopup } from "@/components/subscription/LimitPopup";
import { CountryFlag } from "@/components/ui/CountryFlag";

// Use SavedChartViewer for displaying saved charts with configuration
const SavedChartViewer = dynamic(() => import("@/components/analyze/SavedChartViewer").then(mod => mod.SavedChartViewer), {
  ssr: false,
  loading: () => <div className="h-[180px] w-full bg-muted/10 animate-pulse" />
});

interface ChartCardProps {
  id: string;
  symbol: string;
  koreanName?: string | null;
  source?: "upbit" | "yahoo" | "finnhub";
  title: string;
  excerpt?: string;
  pointPhase?: "진행중" | "완료";
  chartImageUrl?: string;
  user: {
    name: string;
    level: string;
    ranking: number;
    avatar?: string;
    countryCode?: string;
    stats?: {
      recent_accuracy: number;
      all_time_accuracy: number;
      total_count: number;
    };
  };
  stats: {
    profit: string; // e.g., "900만 92%"
    winRate: string; // e.g., "최근 80%"
    count: string; // e.g., "전체 70% 102개"
  };
  predictionStatus?: PredictionStatus;
  chartConfig?: any; // Chart configuration from post
}

export function ChartCard({ id, symbol, koreanName, title, excerpt, pointPhase, user, stats, predictionStatus, chartConfig }: ChartCardProps) {
  const router = useRouter();
  const [showLimitPopup, setShowLimitPopup] = useState(false);
  
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

  const pointPhaseClass =
    pointPhase === "진행중"
      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/50"
      : pointPhase === "완료"
        ? "bg-gray-500/10 text-gray-600 dark:text-gray-300 border-gray-500/50"
        : "";

  // Extract chart configuration
  const interval = chartConfig?.interval || "D";
  const predictionPoints = chartConfig?.prediction_points || [];

  const chartStyle = chartConfig?.chartStyle || "line";
  const country = chartConfig?.country;

  // Handle card click with view limit check
  const handleCardClick = async (e: React.MouseEvent) => {
    // ✅ "우클릭 → 새 탭에서 열기"를 지원하려면 실제 링크가 필요합니다.
    //    따라서 Link를 쓰고, "일반 좌클릭"만 열람 제한 체크 후 client navigation으로 처리합니다.
    //    (Ctrl/Meta/Shift 클릭, 중클릭, 우클릭은 브라우저 기본 동작을 유지)
    if (
      (e as any).button !== 0 || // left click only
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }

    e.preventDefault();
    
    // Check if user can view this post
    const { canView, reason } = await checkCanViewPost(id);
    
    if (!canView) {
      if (reason === "일일 열람 한도를 초과했습니다.") {
        setShowLimitPopup(true);
      } else {
        // Show toast notification for other reasons
        toast.error(reason || "게시물을 볼 수 없습니다.", {
          description: "구독 정보를 확인해주세요.",
          duration: 4000,
        });
      }
      return;
    }
    
    // Navigate to post detail page
    router.push(`/posts/${id}`);
  };

  return (
    <div className="flex flex-col gap-4 p-4 border border-border rounded-2xl">
      {/* ✅ 카드 전체를 링크로 감싸서(차트/제목/유저정보) 어디를 클릭해도 상세로 이동 */}
      <Link href={`/posts/${id}`} onClick={handleCardClick} className="block">
        <div className="flex flex-col gap-4">
          {/* Chart Section */}
          <div className="rounded-xl border-0 bg-transparent overflow-hidden shadow-none transition-all group relative cursor-pointer">
            <div className="p-4 pb-2 flex justify-between items-center">
              <div className="flex flex-col gap-0.5">
                {country && country !== '기타' && (
                    <span className="text-[10px] text-muted-foreground font-medium px-1.5 py-0.5 bg-secondary/50 rounded w-fit">
                        {country}
                    </span>
                )}
                <h3 className="font-bold text-sm text-foreground/80 flex items-center gap-1.5">
                    {symbol} 
                    {koreanName && <span className="font-normal text-muted-foreground">({koreanName})</span>}
                    <span className="text-xs font-normal text-muted-foreground">Price</span>
                </h3>
              </div>

            <div className="flex items-center gap-2">
              {pointPhase && (
                <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${pointPhaseClass}`}>
                  {pointPhase}
                </span>
              )}
              {predictionStatus && (
                <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${statusColors[predictionStatus]}`}>
                  {statusLabels[predictionStatus]}
                </span>
              )}
            </div>
            </div>
          
            {/* Chart Area - Fixed Height */}
            <div className="h-[180px] w-full pointer-events-none opacity-90 group-hover:opacity-100 transition-opacity rounded-xl overflow-hidden bg-background/30">
              <SavedChartViewer
                symbol={symbol}
                interval={interval}
                predictionPoints={predictionPoints}
                chartStyle={chartStyle}
                showStyleToggle={false}
                mode="card"
              />
            </div>

            {/* Floating Action Button */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                className="bg-[#4A90E2] hover:bg-[#357ABD] text-white shadow-lg h-7 text-xs px-4"
              >
                Save Point
              </Button>
            </div>
          </div>

          {/* User Info + Excerpt */}
          <div className="flex items-start gap-3 group/info cursor-pointer">
            <div className="flex flex-col items-center gap-1 relative">
              <Avatar className="h-10 w-10 border-0">
                <AvatarImage src={user.avatar} />
                <AvatarFallback>{user.name[0]}</AvatarFallback>
              </Avatar>
              {user.countryCode && (
                <div className="absolute -bottom-1 -right-1 bg-background rounded-sm shadow-sm">
                  <CountryFlag countryCode={user.countryCode} size={14} />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="font-bold text-sm group-hover/info:text-primary transition-colors">
                {title}
                <span className="ml-2 text-[#4A90E2]">{stats.profit}</span>
              </h4>
              {user.stats && (
                <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                  최근 {Math.round(user.stats.recent_accuracy)}% <span className="mx-1">·</span> 전체 {Math.round(user.stats.all_time_accuracy)}% <span className="mx-1">·</span> {user.stats.total_count}개
                </div>
              )}

              {!!excerpt && (
                <p className="text-xs text-muted-foreground/90 line-clamp-2 leading-relaxed">
                  {excerpt}
                </p>
              )}

              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <span className="whitespace-nowrap">
                  {stats.winRate} • {stats.count}
                </span>
                <span className="opacity-70">|</span>
                <span className="whitespace-nowrap">
                  {user.level}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>

      <LimitPopup 
        isOpen={showLimitPopup} 
        onClose={() => setShowLimitPopup(false)}
        type="VIEW"
        onSuccess={() => {
            setShowLimitPopup(false);
            router.push(`/posts/${id}`);
        }}
      />
    </div>
  );
}

