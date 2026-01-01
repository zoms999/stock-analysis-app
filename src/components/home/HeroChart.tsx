
"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchPosts, type Post } from "@/lib/api/posts";

const TechChart = dynamic(() => import("@/components/chart/TechChart").then(mod => mod.TechChart), {
  ssr: false,
  loading: () => <div className="h-[320px] w-full animate-pulse bg-muted/20 rounded-xl" />
});

const SavedChartViewer = dynamic(
  () => import("@/components/analyze/SavedChartViewer").then((mod) => mod.SavedChartViewer),
  {
    ssr: false,
    loading: () => <div className="h-[280px] w-full animate-pulse bg-muted/20 rounded-xl" />,
  }
);

export function HeroChart() {
  const router = require("next/navigation").useRouter();
  const [topPost, setTopPost] = useState<Post | null>(null);
  const [loadingTop, setLoadingTop] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingTop(true);
        // ✅ 정확도(accuracy) 가장 높은 게시글 1개를 가져옴
        const posts = await fetchPosts(1, 0, "accuracy");
        if (!alive) return;
        setTopPost(posts?.[0] ?? null);
      } catch {
        if (!alive) return;
        setTopPost(null);
      } finally {
        if (!alive) return;
        setLoadingTop(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const topConfig = (topPost as any)?.chart_config;
  const topSymbol = topPost?.ticker_symbol || "BTC-USD";
  const topInterval = topConfig?.interval || "D";
  const topPredictionPoints = topConfig?.prediction_points || [];
  const topChartStyle = topConfig?.chartStyle || "line";
  const topAccuracy = useMemo(() => {
    const v = (topPost as any)?.accuracy_score;
    return typeof v === "number" ? v : null;
  }, [topPost]);

  return (
    <section className="flex flex-col md:flex-row items-center justify-between gap-8 py-8 md:py-12 border-b border-border/50">
      {/* Left: Text Content */}
      <div className="flex-1 space-y-6 text-left">
         <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
            차트 커뮤니티에서 실력을<br />
            <span className="text-primary">향상 시키세요</span>
         </h1>
         <p className="text-muted-foreground text-lg leading-relaxed max-w-md">
            전 세계 주식 코인 커뮤니티에서 투자자들과 정보를 교환하고 소통하세요.
            실시간 데이터와 전문적인 분석 도구를 제공합니다.
         </p>
         <div className="flex gap-3 pt-2">
             <Button size="lg" className="px-8 font-bold" onClick={async () => {
                const supabase = await import("@/lib/supabase/client").then(mod => mod.createClient());
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    router.push("/analyze");
                } else {
                    router.push("/login"); 
                }
             }}>
                지금 시작
             </Button>
            <Link href="/analyze">
                <Button size="lg" variant="outline" className="px-8">더 알아보기</Button>
            </Link>
         </div>
      </div>

      {/* Right: Representative Chart */}
      {/* ✅ 히어로 차트: 조금 더 축소 + 테두리 제거(플랫) */}
      <div className="w-full md:w-[420px] lg:w-[480px]">
          <div className="rounded-2xl border-0 bg-transparent p-3 shadow-none relative overflow-hidden group">
             <div className="flex justify-between items-center mb-3 px-1">
                 <div>
                    <h3 className="font-bold text-lg">
                      {topPost ? `${topSymbol} Top Accuracy` : "Bitcoin (BTC) Price"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {topPost ? "커뮤니티 최고 정확도 게시글" : "Twelve Data (WebSocket Stream)"}
                    </p>
                 </div>
                 <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    {topPost ? "Top" : "Live"}
                 </div>
            </div>
            
            <div className="rounded-xl overflow-hidden border-0 bg-background/30">
                 {/* Fixed Height Wrapper for Hero Chart */}
                 <div className="h-[230px]">
                    {loadingTop ? (
                      <div className="h-[230px] w-full animate-pulse bg-muted/20" />
                    ) : topPost ? (
                      <SavedChartViewer
                        symbol={topSymbol}
                        interval={topInterval}
                        predictionPoints={topPredictionPoints}
                        chartStyle={topChartStyle}
                        showStyleToggle={false}
                        // ✅ 리스트 카드와 동일한 룩&필로 (미래 여백/마커/글로우 정책 포함)
                        mode="card"
                      />
                    ) : (
                      <TechChart symbol="BTC-USD" interval="1d" />
                    )}
                 </div>
            </div>

             {/* Floating Badge Example */}
             <div className="absolute bottom-6 right-6 bg-card/90 backdrop-blur border-0 rounded-lg p-3 shadow-lg transform rotate-3 hover:rotate-0 transition-transform cursor-default hidden md:block">
                <div className="text-xs text-muted-foreground">
                  {topPost ? "Accuracy" : "Current Price"}
                </div>
                <div className="text-lg font-bold">
                  {topPost && topAccuracy !== null ? `${topAccuracy.toFixed(2)}%` : "₩97,542,000"}
                </div>
                <div className="text-xs text-red-500">
                  {topPost ? "최고 정확도 게시글" : "▲ 2.4%"}
                </div>
             </div>
             
             {/* Center Action (Save Point style provided in ref, but maybe 'View Detail' here) */}
             <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button className="bg-[#4A90E2] hover:bg-[#357ABD] text-white shadow-lg h-8 text-xs px-6">
                    Save Point
                </Button>
             </div>
          </div>
      </div>
    </section>
  );
}
