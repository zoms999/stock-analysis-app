"use client";

import { CategoryFilter } from "./CategoryFilter";
import { ChartCard } from "./ChartCard";

const MOCK_GRID_DATA = [
  {
    id: 1,
    symbol: "KRW-BTC",
    source: "upbit",
    title: "삼성전자", // Using text from user image for vibe matching
    user: { name: "랭킹1024", level: "레벨 7", ranking: 1024, avatar: "" },
    stats: { profit: "수익금 900만 92%", winRate: "최근 80%", count: "전체 70% 102개" }
  },
  {
    id: 2,
    symbol: "KRW-ETH",
    source: "upbit",
    title: "현대자동차",
    user: { name: "차트마스터", level: "레벨 9", ranking: 12, avatar: "" },
    stats: { profit: "수익금 5억 120%", winRate: "최근 95%", count: "전체 90% 500개" }
  },
  {
    id: 3,
    symbol: "AAPL",
    source: "twelvedata",
    title: "애플 (AAPL)",
    user: { name: "StockPro", level: "레벨 5", ranking: 330, avatar: "" },
    stats: { profit: "수익금 200만 15%", winRate: "최근 60%", count: "전체 55% 42개" }
  },
  {
    id: 4,
    symbol: "KRW-SOL",
    source: "upbit",
    title: "솔라나",
    user: { name: "SolANA", level: "레벨 6", ranking: 450, avatar: "" },
    stats: { profit: "수익금 800만 50%", winRate: "최근 75%", count: "전체 60% 80개" }
  },
   {
    id: 5,
    symbol: "TSLA",
    source: "twelvedata",
    title: "테슬라",
    user: { name: "MuskFan", level: "레벨 3", ranking: 1200, avatar: "" },
    stats: { profit: "수익금 -50만 -10%", winRate: "최근 40%", count: "전체 45% 20개" }
  },
   {
    id: 6,
    symbol: "KRW-XRP",
    source: "upbit",
    title: "리플",
    user: { name: "XRPArmy", level: "레벨 8", ranking: 50, avatar: "" },
    stats: { profit: "수익금 1억 300%", winRate: "최근 88%", count: "전체 85% 300개" }
  }
];

export function PostFeed() {
  return (
    <section className="space-y-8">
       {/* Category Filters */}
       <CategoryFilter />

       {/* Grid Layout */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_GRID_DATA.map((post) => (
             <ChartCard
                key={post.id}
                id={post.id.toString()}
                symbol={post.symbol}
                source={post.source as "upbit" | "finnhub" | "yahoo" | "twelvedata"}
                title={post.title}
                user={post.user}
                stats={post.stats}
             />
          ))}
       </div>
       
       <div className="flex justify-center py-8">
         <button className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
            더 보기
         </button>
       </div>
    </section>
  );
}
