"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchPosts, Post, PostSortOption } from "@/lib/api/posts";
import { Button } from "@/components/ui/button";
import { Loader2, LineChart, Search } from "lucide-react";
import { ChartCard } from "@/components/home/ChartCard";
import { calculateAccuracy } from "@/lib/utils/accuracy";
import { SyncPriceButton } from "@/components/admin/SyncPriceButton";
import { Input } from "@/components/ui/input";
import { clientCacheGet, clientCacheSet } from "@/lib/utils/clientCache";
import { subscribeTwelveDataPrices } from "@/lib/api/twelvedata";
import { searchSymbol } from "@/lib/api/search";
import { SORT_OPTIONS, type SortOption } from "@/lib/ui/chartBoardSort";
import { getKoreanName } from "@/lib/constants/krx_names";

export default function PostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [searchTerm, setSearchTerm] = useState("");
  const [resolvedSymbol, setResolvedSymbol] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const lastRequestIdRef = useRef(0);
  const priceRef = useRef<Map<string, number>>(new Map());
  const streamRef = useRef<{ close: () => void } | null>(null);

  const makeExcerpt = (html: string | null | undefined, maxLen = 120) => {
    const raw = String(html ?? "");
    const text = raw
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return "";
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen).trimEnd()}...`;
  };

  const getPointPhase = (post: Post): "진행중" | "완료" | null => {
    const pts = post?.chart_config?.prediction_points;
    if (!Array.isArray(pts) || pts.length === 0) return null;

    const interval = String(post?.chart_config?.interval ?? "D");
    const stepMs =
      interval === "1" ? 60_000 :
      interval === "60" ? 3_600_000 :
      interval === "D" ? 86_400_000 :
      interval === "W" ? 7 * 86_400_000 :
      interval === "M" ? 30 * 86_400_000 :
      interval === "Y" ? 365 * 86_400_000 :
      86_400_000;

    const toMs = (t: unknown): number | null => {
      if (typeof t === "number" && Number.isFinite(t)) return t * 1000; // unix seconds
      if (typeof t === "string") {
        const s = t.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          const ms = new Date(`${s}T00:00:00`).getTime();
          return Number.isFinite(ms) ? ms : null;
        }
        const ms = new Date(s).getTime();
        return Number.isFinite(ms) ? ms : null;
      }
      return null;
    };

    let maxMs: number | null = null;
    for (const p of pts) {
      const timeVal =
        typeof p === "object" && p !== null && "time" in p
          ? (p as { time?: unknown }).time
          : undefined;
      const ms = toMs(timeVal);
      if (ms === null) continue;
      if (maxMs === null || ms > maxMs) maxMs = ms;
    }
    if (maxMs === null) return null;

    const now = Date.now();
    return maxMs <= now - stepMs ? "완료" : "진행중";
  };

  useEffect(() => {
    const q = (searchTerm ?? "").trim();
    if (!q) {
      setResolvedSymbol(null);
      setIsResolving(false);
      return;
    }

    const looksLikeSymbol = /^[A-Za-z0-9][A-Za-z0-9.:/\\-]{0,30}$/.test(q);
    const hasKorean = /[가-힣]/.test(q);
    if (looksLikeSymbol && !hasKorean) {
      setResolvedSymbol(null);
      setIsResolving(false);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setIsResolving(true);
      try {
        const sym = await searchSymbol(q);
        if (cancelled) return;
        setResolvedSymbol(sym ? sym.symbol : null);
      } catch {
        if (cancelled) return;
        setResolvedSymbol(null);
      } finally {
        if (!cancelled) setIsResolving(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchTerm]);

  useEffect(() => {
    async function loadPosts() {
      const requestId = ++lastRequestIdRef.current;
      
      let apiSort: PostSortOption = 'latest';
      if (sortBy === 'accuracy') apiSort = 'accuracy';
      if (sortBy === 'recent_accuracy') apiSort = 'recent_accuracy';
      if (sortBy === 'most_analyzed') apiSort = 'views';
      if (sortBy === 'completed') apiSort = 'completed';
      if (sortBy === 'daily_accuracy') apiSort = 'accuracy_1day';
      if (sortBy === 'accuracy_5day') apiSort = 'accuracy_5day';
      if (sortBy === 'accuracy_10day') apiSort = 'accuracy_10day';
      
      const cacheKey = `posts:page:${apiSort}:limit=12:offset=0`;
      const cached = clientCacheGet<Post[]>(cacheKey);
      
      if (cached && cached.length > 0) {
        setPosts(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const fetchedPosts = await fetchPosts(12, 0, apiSort);
      
      const symbolsToStream = Array.from(
        new Set(
          fetchedPosts
            .filter((p) => p.prediction_type && p.ticker_symbol)
            .map((p) => p.ticker_symbol)
        )
      );
      
      const postsWithData = fetchedPosts.map((post) => {
        const currentPrice = priceRef.current.get(post.ticker_symbol);
        
        let profit = post.accuracy_score;
        let status = post.prediction_status;

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
      
      if (requestId !== lastRequestIdRef.current) return;

      setPosts(postsWithData);
      setLoading(false);
      clientCacheSet(cacheKey, postsWithData, 30_000);

      streamRef.current?.close();
      streamRef.current = null;
      if (symbolsToStream.length > 0) {
        streamRef.current = subscribeTwelveDataPrices(symbolsToStream, (msg) => {
          const p = Number(msg.price);
          if (!Number.isFinite(p)) return;
          priceRef.current.set(msg.symbol, p);

          setPosts((prev) =>
            prev.map((post) => {
              if (post.ticker_symbol !== msg.symbol) return post;
              const currentPrice = p;

              let profit = post.accuracy_score;
              let status = post.prediction_status;

              if (
                currentPrice &&
                post.prediction_type &&
                post.entry_price !== undefined &&
                post.target_price !== undefined &&
                post.stop_loss_price !== undefined &&
                post.target_date
              ) {
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
                profit = accuracy.profitPercentage;
                status = accuracy.status;
              }

              return {
                ...post,
                currentPrice,
                profitPercentage: profit,
                prediction_status: status,
              };
            })
          );
        });
      }
    }
    
    loadPosts();
    return () => {
      streamRef.current?.close();
      streamRef.current = null;
    };
  }, [sortBy]);

  const sortedPosts = posts;

  const filteredPosts = useMemo(() => {
    const q = (searchTerm ?? "").trim();
    if (!q) return sortedPosts;

    const qLower = q.toLowerCase();
    const resolved = (resolvedSymbol ?? "").trim();

    const normalize = (s: string) =>
      s
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "")
        .replace(/-/g, "/");

    const resolvedN = resolved ? normalize(resolved) : null;

    const krxBase =
      resolvedN && resolvedN.endsWith(":KRX") ? resolvedN.replace(/:KRX$/, "") : null;
    const krxEquivalents = krxBase ? new Set([`${krxBase}.KS`, `${krxBase}.KQ`, krxBase]) : null;

    return sortedPosts.filter((p) => {
      const sym = String(p.ticker_symbol ?? "").trim();
      const title = String(p.title ?? "");
      const symN = normalize(sym);

      if (resolvedN) {
        if (symN === resolvedN) return true;
        if (krxEquivalents && krxEquivalents.has(symN)) return true;
      }

      if (sym.toLowerCase().includes(qLower)) return true;
      if (title.toLowerCase().includes(qLower)) return true;
      return false;
    });
  }, [sortedPosts, searchTerm, resolvedSymbol]);

  if (loading) {
    return (
      <div className="container mx-auto py-12 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 overflow-x-auto pb-2 sm:pb-0">
             <h1 className="text-2xl font-bold whitespace-nowrap">차트 게시판</h1>
             <SyncPriceButton />
             
             {/* Search - Visible on Desktop */}
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
          
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="정렬 기준"
              className="px-4 py-2 rounded-lg border-0 bg-secondary/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            
            <Button
                className="gap-2 bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                onClick={() => router.push("/analyze")}
            >
                <LineChart className="h-4 w-4" />
                <span className="hidden sm:inline">차트 분석</span>
                <span className="sm:hidden">분석</span>
            </Button>
          </div>
        </div>
        
        {/* Search - Mobile Only */}
        <div className="sm:hidden">
             <div className="relative w-full">
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
      </div>

      {/* Posts Grid */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-12">
          {searchTerm.trim() ? (
             <p className="text-muted-foreground text-lg">
                {isResolving ? "검색 중..." : "검색 결과가 없습니다."}
             </p>
          ) : (
             <>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <LineChart className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-lg">
                    아직 게시글이 없습니다.
                </p>
                <p className="text-muted-foreground text-sm mt-2 mb-6">
                    첫 번째 차트 분석을 작성해보세요!
                </p>
             </>
          )}
          {!searchTerm.trim() && (
              <Button
                className="gap-2 bg-blue-600 hover:bg-blue-700"
                onClick={() => router.push("/analyze")}
            >
                <LineChart className="h-4 w-4" />
                차트 분석
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPosts.map((post) => (
            (() => {
                const pointsCount = Array.isArray(post?.chart_config?.prediction_points)
                  ? post.chart_config.prediction_points.length
                  : 0;
    
                const pointPhase = getPointPhase(post);
    
                const profitLabel =
                  typeof post.profitPercentage === "number"
                    ? `${post.profitPercentage >= 0 ? "+" : ""}${post.profitPercentage.toFixed(2)}%`
                    : pointsCount > 0
                      ? `포인트 ${pointsCount}개`
                      : "예측 없음";
    
                return (
                  <ChartCard
                    key={post.id}
                    id={post.id}
                    symbol={post.ticker_symbol}
                    source="yahoo"
                    title={post.title}
                    koreanName={getKoreanName(post.ticker_symbol)}
                    excerpt={makeExcerpt(post.content, 140)}
                    pointPhase={pointPhase ?? undefined}
                    chartImageUrl={post.chart_image_url}
                    user={{
                      name: post.profiles?.nickname || "익명",
                      level: "레벨 1",
                      ranking: 0,
                      avatar: post.profiles?.avatar_url,
                      countryCode: post.profiles?.country_code,
                      stats: post.profiles?.stats,
                    }}
                    stats={{
                      profit: profitLabel,
                      winRate: post.prediction_status || "대기",
                      count: `조회 ${post.view_count || 0}`,
                    }}
                    predictionStatus={post.prediction_status}
                    chartConfig={post.chart_config}
                  />
                );
              })()
          ))}
        </div>
      )}
    </div>
  );
}
