"use client";

import { useState, useEffect } from "react";
import { ChartCard } from "./ChartCard";
import { fetchPosts, Post } from "@/lib/api/posts";
import { getCurrentPrice, getBatchPrices } from "@/lib/api/prices";
import { calculateAccuracy } from "@/lib/utils/accuracy";

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

  useEffect(() => {
    async function loadPosts() {
      setLoading(true);
      
      // Fetch posts
      const fetchedPosts = await fetchPosts(50);
      console.log("Fetched posts:", fetchedPosts);
      console.log("Number of posts:", fetchedPosts.length);
      
      // Fetch current prices for posts with predictions
      const symbolsToFetch = fetchedPosts
        .filter((p) => p.prediction_type && p.ticker_symbol)
        .map((p) => ({ symbol: p.ticker_symbol, source: "yahoo" as const }));
      
      console.log("Symbols to fetch prices for:", symbolsToFetch);
      
      const prices = await getBatchPrices(symbolsToFetch);
      console.log("Fetched prices:", prices);
      
      // Calculate accuracy for each post
      const postsWithAccuracy = fetchedPosts.map((post) => {
        if (post.prediction_type && post.entry_price && post.target_price && post.stop_loss_price && post.target_date) {
          const priceKey = `yahoo:${post.ticker_symbol}`;
          const currentPrice = prices.get(priceKey);
          
          if (currentPrice) {
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
            
            return {
              ...post,
              currentPrice,
              profitPercentage: accuracy.profitPercentage,
              prediction_status: accuracy.status,
            };
          }
        }
        return post;
      });
      
      console.log("Posts with accuracy:", postsWithAccuracy);
      setPosts(postsWithAccuracy);
      setLoading(false);
    }
    
    loadPosts();
  }, []);

  // Sort posts based on selected option
  const sortedPosts = [...posts].sort((a, b) => {
    switch (sortBy) {
      case "accuracy":
        // Sort by success rate (SUCCESS > WAITING > FAIL)
        const statusOrder = { SUCCESS: 3, WAITING: 2, FAIL: 1, TIMEOUT: 0 };
        return (statusOrder[b.prediction_status || "WAITING"] || 0) - (statusOrder[a.prediction_status || "WAITING"] || 0);
      
      case "recent_accuracy":
        // Sort by profit percentage
        return (b.profitPercentage || 0) - (a.profitPercentage || 0);
      
      case "most_analyzed":
        // Sort by view count (proxy for popularity)
        return (b.view_count || 0) - (a.view_count || 0);
      
      case "latest":
        // Sort by creation date (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      
      case "completed":
        // Sort by completed predictions (SUCCESS or FAIL)
        const isCompleted = (status?: string) => status === "SUCCESS" || status === "FAIL";
        return (isCompleted(b.prediction_status) ? 1 : 0) - (isCompleted(a.prediction_status) ? 1 : 0);
      
      case "daily_accuracy":
      case "accuracy_5day":
      case "accuracy_10day":
        // For now, sort by profit percentage (can be enhanced with time-based filtering)
        return (b.profitPercentage || 0) - (a.profitPercentage || 0);
      
      default:
        return 0;
    }
  });

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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">차트 게시판</h2>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
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
              profit: post.profitPercentage
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
