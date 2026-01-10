"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { ChartCard } from "./ChartCard";
import { fetchPosts, Post, PostSortOption } from "@/lib/api/posts";
import { calculateAccuracy } from "@/lib/utils/accuracy";
import { SyncPriceButton } from "@/components/admin/SyncPriceButton";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { clientCacheGet, clientCacheSet } from "@/lib/utils/clientCache";
import { subscribeTwelveDataPrices } from "@/lib/api/twelvedata";
import { searchSymbol } from "@/lib/api/search";
import { SORT_OPTIONS, type SortOption } from "@/lib/ui/chartBoardSort";
import { getKoreanName } from "@/lib/constants/krx_names";

export function ChartBoardList() {
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
        // YYYY-MM-DD는 로컬 00:00 기준으로 해석(일봉 UX 안정화)
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

    // ✅ "완료"는 마지막 포인트가 '충분히 과거'일 때만(1 bar 여유)
    const now = Date.now();
    return maxMs <= now - stepMs ? "완료" : "진행중";
  };

  // ✅ 한글/회사명 검색 지원: 입력이 심볼이 아니면 Twelve Data 검색 프록시로 심볼을 리졸브
  useEffect(() => {
    const q = (searchTerm ?? "").trim();
    if (!q) {
      setResolvedSymbol(null);
      setIsResolving(false);
      return;
    }

    // 빠른 탈출: 심볼처럼 보이면 리졸브하지 않고 로컬 필터만 수행
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
        const res = await searchSymbol(q);
        if (cancelled) return;
        setResolvedSymbol(res ? res.symbol : null);
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
      
      // Map UI sort to API sort
      let apiSort: PostSortOption = 'latest';
      if (sortBy === 'accuracy') apiSort = 'accuracy';
      if (sortBy === 'recent_accuracy') apiSort = 'recent_accuracy';
      if (sortBy === 'most_analyzed') apiSort = 'views';
      if (sortBy === 'completed') apiSort = 'completed';
      if (sortBy === 'daily_accuracy') apiSort = 'accuracy_1day';
      if (sortBy === 'accuracy_5day') apiSort = 'accuracy_5day';
      if (sortBy === 'accuracy_10day') apiSort = 'accuracy_10day';
      
      const cacheKey = `home:chartBoard:${apiSort}:limit=12:offset=0`;
      const cached = clientCacheGet<Post[]>(cacheKey);
      // ✅ 캐시가 있으면 즉시 렌더(UX 개선) + 백그라운드 갱신
      if (cached && cached.length > 0) {
        setPosts(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // Fetch posts with server-side sorting
      const fetchedPosts = await fetchPosts(12, 0, apiSort);
      
      // Client-side Price Fetching (Hybrid)
      // Even if we have accuracy_score from DB, we might want *Live* price for the card display.
      // But for the sake of the list, we can trust the DB score for sorting order.
      // Let's still fetch prices to show "Current Price" on the card.
      
      // ✅ 실시간 가격은 WebSocket 스트리밍(서버 SSE 프록시)로 받습니다.
      //    초기 렌더는 DB 값/예측점수로 먼저 그리고, 가격이 들어오면 UI를 갱신합니다.
      const symbolsToStream = Array.from(
        new Set(
          fetchedPosts
            .filter((p) => p.prediction_type && p.ticker_symbol)
            .map((p) => p.ticker_symbol)
        )
      );
      
      // Merge Live Prices + DB Accuracy
      // We can use DB accuracy_score as fallback or primary.
      // If we want "Live Accuracy", we calculate it. If we want "Ranking Accuracy", we use DB.
      // Let's use DB accuracy_score for sorting (already done by SQL) and display.
      // BUT, if we have live price, maybe we show live profit?
      // Let's prioritize Live Profit for display if available, but use DB score if not?
      // Actually the user wants "Ranked by Accuracy". The DB score is the 'Official' score.
      // Let's use the DB score for 'profitPercentage' if available, or calc it.
      
      const postsWithData = fetchedPosts.map((post) => {
        const currentPrice = priceRef.current.get(post.ticker_symbol);
        
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
      
      // ✅ React StrictMode(개발)에서 effect가 2번 돌 수 있어, 최신 요청만 반영
      if (requestId !== lastRequestIdRef.current) return;

      setPosts(postsWithData);
      setLoading(false);
      // TTL 30초: 홈 리스트는 자주 바뀌지 않지만, 너무 오래된 캐시는 피함
      clientCacheSet(cacheKey, postsWithData, 30_000);

      // ✅ 스트림 재연결 (sort 변경/리로드 시 심볼 세트가 바뀔 수 있음)
      streamRef.current?.close();
      streamRef.current = null;
      if (symbolsToStream.length > 0) {
        streamRef.current = subscribeTwelveDataPrices(symbolsToStream, (msg) => {
          const p = Number(msg.price);
          if (!Number.isFinite(p)) return;
          priceRef.current.set(msg.symbol, p);

          // 들어온 가격만 반영해서 카드 UI 갱신(간단)
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
  }, [sortBy]); // Re-fetch when sort changes

  // Client-side simple fallback sort or identical to posts if server did it
  // We can just use 'posts' directly since server sorted them.
  const sortedPosts = posts;

  // ✅ 검색(로컬 필터 + 심볼 리졸브 결과 반영)
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
        .replace(/-/g, "/"); // BTC-USD vs BTC/USD

    const resolvedN = resolved ? normalize(resolved) : null;

    // KRX 동치 처리: 005930:KRX <-> 005930.KS/005930.KQ/005930
    const krxBase =
      resolvedN && resolvedN.endsWith(":KRX") ? resolvedN.replace(/:KRX$/, "") : null;
    const krxEquivalents = krxBase ? new Set([`${krxBase}.KS`, `${krxBase}.KQ`, krxBase]) : null;

    return sortedPosts.filter((p) => {
      const sym = String(p.ticker_symbol ?? "").trim();
      const title = String(p.title ?? "");
      const symN = normalize(sym);

      // 1) 리졸브된 심볼이 있으면 그걸 최우선 매칭
      if (resolvedN) {
        if (symN === resolvedN) return true;
        if (krxEquivalents && krxEquivalents.has(symN)) return true;
      }

      // 2) 텍스트 매칭(심볼/제목)
      if (sym.toLowerCase().includes(qLower)) return true;
      if (title.toLowerCase().includes(qLower)) return true;
      return false;
    });
  }, [sortedPosts, searchTerm, resolvedSymbol]);

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
          aria-label="정렬 기준"
          className="px-4 py-2 rounded-lg border-0 bg-secondary/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto"
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

      {filteredPosts.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {searchTerm.trim()
            ? isResolving
              ? "검색 중..."
              : "검색 결과가 없습니다."
            : "아직 차트 분석이 없습니다."}
        </div>
      )}
    </section>
  );
}
