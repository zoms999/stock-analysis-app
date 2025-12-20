
"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const TechChart = dynamic(() => import("@/components/chart/TechChart").then(mod => mod.TechChart), {
  ssr: false,
  loading: () => <div className="h-[320px] w-full animate-pulse bg-muted/20 rounded-xl" />
});

export function HeroChart() {
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
            <Link href="/subscription">
                <Button size="lg" className="px-8 font-bold">지금 시작</Button>
            </Link>
            <Link href="/analyze">
                <Button size="lg" variant="outline" className="px-8">더 알아보기</Button>
            </Link>
         </div>
      </div>

      {/* Right: Representative Chart */}
      <div className="w-full md:w-[500px] lg:w-[600px]">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xl relative overflow-hidden group">
             <div className="flex justify-between items-center mb-4 px-2">
                 <div>
                    <h3 className="font-bold text-lg">Bitcoin (BTC) Price</h3>
                    <p className="text-xs text-muted-foreground">Yahoo Finance Real-time</p>
                 </div>
                 <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    Live
                 </div>
            </div>
            
            <div className="rounded-xl overflow-hidden border border-border bg-background">
                 {/* Fixed Height Wrapper for Hero Chart */}
                 <div className="h-[280px]">
                    <TechChart symbol="BTC-USD" interval="1d" />
                 </div>
            </div>

             {/* Floating Badge Example */}
             <div className="absolute bottom-8 right-8 bg-card/90 backdrop-blur border border-border rounded-lg p-3 shadow-lg transform rotate-3 hover:rotate-0 transition-transform cursor-default hidden md:block">
                <div className="text-xs text-muted-foreground">Current Price</div>
                <div className="text-lg font-bold">₩97,542,000</div>
                <div className="text-xs text-red-500">▲ 2.4%</div>
             </div>
             
             {/* Center Action (Save Point style provided in ref, but maybe 'View Detail' here) */}
             <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button className="bg-[#4A90E2] hover:bg-[#357ABD] text-white shadow-lg h-8 text-xs px-6">
                    Save Point
                </Button>
             </div>
          </div>
      </div>
    </section>
  );
}
