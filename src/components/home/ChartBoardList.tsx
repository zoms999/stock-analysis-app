"use client";

import { useState, useEffect } from "react";
import { ChartCard } from "./ChartCard";
import { fetchPosts, Post, PostSortOption } from "@/lib/api/posts";
import { getCurrentPrice, getBatchPrices } from "@/lib/api/prices";
import { calculateAccuracy } from "@/lib/utils/accuracy";
import { SyncPriceButton } from "@/components/admin/SyncPriceButton";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type SortOption =
  | "all"
  | "accuracy"
  | "recent_accuracy"
  | "most_analyzed"
  | "latest"
  | "completed"
  | "daily_accuracy"
  | "accuracy_5day"
  | "accuracy_10day";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "accuracy", label: "정확도순" },
  { value: "recent_accuracy", label: "최근정확도순" },
  { value: "most_analyzed", label: "많이분석한종목순" },
  { value: "latest", label: "최신분석순" },
  { value: "completed", label: "분석완료순" },
  { value: "daily_accuracy", label: "정확도 일일순" },
  { value: "accuracy_5day", label: "정확도 5일순" },
  { value: "accuracy_10day", label: "정확도 10일순" },
];

export function ChartBoardList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadPosts() {
      setLoading(true);
      
      // Map UI sort to API sort
      let apiSort: PostSortOption = 'latest';
      if (sortBy === 'accuracy') apiSort = 'accuracy';
      if (sortBy === 'recent_accuracy') apiSort = 'recent_accuracy';
      if (sortBy === 'most_analyzed') apiSort = 'views';
      if (sortBy === 'completed') apiSort = 'completed';
      if (sortBy === 'daily_accuracy') apiSort = 'accuracy_1day';
      if (sortBy === 'accuracy_5day') apiSort = 'accuracy_5day';
      if (sortBy === 'accuracy_10day') apiSort = 'accuracy_10day';
      
      // Fetch posts with server-side sorting
      const fetchedPosts = await fetchPosts(12, 0, apiSort);
      
      // Client-side Price Fetching (Hybrid)
      // Even if we have accuracy_score from DB, we might want *Live* price for the card display.
      // But for the sake of the list, we can trust the DB score for sorting order.
      // Let's still fetch prices to show "Current Price" on the card.
      
      const symbolsToFetch = fetchedPosts
        .filter((p) => p.prediction_type && p.ticker_symbol)
        .map((p) => ({ symbol: p.ticker_symbol, source: "yahoo" as const }));
      
      let prices = new Map<string, number>();
      if (symbolsToFetch.length > 0) {
        prices = await getBatchPrices(symbolsToFetch);
      }
      
      // Merge Live Prices + DB Accuracy
      // We can use DB accuracy_score as fallback or primary.
      // If we want "Live Accuracy", we calculate it. If we want "Ranking Accuracy", we use DB.
      // Let's use DB accuracy_score for sorting (already done by SQL) and display.
      // BUT, if we have live price, maybe we show live profit?
      // Let's prioritize Live Profit for display if available, but use DB score if not?
      // Actually the user wants "Ranked by Accuracy". The DB score is the 'Official' score.
      // Let's use the DB score for 'profitPercentage' if available, or calc it.
      
      const postsWithData = fetchedPosts.map((post) => {
        const priceKey = `yahoo:${post.ticker_symbol}`;
        const currentPrice = prices.get(priceKey);
        
        // Use DB Accuracy if available, otherwise calc
        let profit = post.accuracy_score;
        let status = post.prediction_status;

        // Optional: Re-calc if we have live price (for display 'flashiness')
        if (currentPrice && post.prediction_type && post.entry_price && post.target_price && post.stop_loss_price && post.target_date) {
             const accuracy = calculateAccuracy(
              {
                predictionType: post.prediction_type,
                entryPrice: post.entry_price,
                targetPrice: post.target_price,
                stopLossPrice: post.stop_loss_price,
                targetDate: new Date(post.target_date),
              },
              currentPrice
            );
            // We can decide to show the Live Profit or the Stored Score.
            // Let's show Live Profit for "Active" posts, and Stored Score for sorting?
            // Simpler: Just override with Live calc for display.
            profit = accuracy.profitPercentage;
            status = accuracy.status;
        }

        return {
          ...post,
          currentPrice,
          profitPercentage: profit,
          prediction_status: status
        };
      });
      
      setPosts(postsWithData);
      setLoading(false);
    }
    
    loadPosts();
  }, [sortBy]); // Re-fetch when sort changes

  // Client-side simple fallback sort or identical to posts if server did it
  // We can just use 'posts' directly since server sorted them.
  const sortedPosts = posts;

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-pulse text-muted-foreground">차트 분석 로딩 중...</div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header with Sort Dropdown */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

        <div className="flex items-center gap-4 flex-1">
          <h2 className="text-2xl font-bold whitespace-nowrap">차트 게시판</h2>
          <SyncPriceButton />
          
          <div className="relative w-full max-w-xs hidden sm:block">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="종목 검색..."
              className="w-full bg-secondary pl-9 h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedPosts.map((post) => (
          <ChartCard
            key={post.id}
            id={post.id}
            symbol={post.ticker_symbol}
            source="yahoo"
            title={post.title}
            user={{
              name: post.profiles?.nickname || "익명",
              level: "레벨 1",
              ranking: 0,
              avatar: post.profiles?.avatar_url,
            }}
            stats={{
              profit: typeof post.profitPercentage === 'number'
                ? `${post.profitPercentage >= 0 ? "+" : ""}${post.profitPercentage.toFixed(2)}%`
                : "예측 없음",
              winRate: post.prediction_status || "대기",
              count: `조회 ${post.view_count || 0}`,
            }}
            predictionStatus={post.prediction_status}
            chartConfig={post.chart_config}
          />
        ))}
      </div>

      {sortedPosts.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          아직 차트 분석이 없습니다.
        </div>
      )}
    </section>
  );
}
