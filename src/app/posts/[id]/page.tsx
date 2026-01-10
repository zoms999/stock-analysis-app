"use client";

import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { LimitPopup } from "@/components/subscription/LimitPopup";
import { toast } from "sonner";
import { SavedChartViewer } from "@/components/analyze/SavedChartViewer";
import { PredictionInfo } from "@/components/analyze/PredictionInfo";
import { fetchPostById, fetchPostsBySymbol, Post } from "@/lib/api/posts";
import { getCurrentPrice } from "@/lib/api/prices";
import { calculateAccuracy } from "@/lib/utils/accuracy";
import { PostCard } from "@/components/posts/PostCard";
import { SORT_OPTIONS, type SortOption } from "@/lib/ui/chartBoardSort";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getKoreanName } from "@/lib/constants/krx_names";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CountryFlag } from "@/components/ui/CountryFlag";

type CommentItem = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles?: { nickname: string | null; avatar_url: string | null } | null;
};

export default function PostDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedSortBy, setRelatedSortBy] = useState<SortOption>("latest");

  const [showLimitPopup, setShowLimitPopup] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const errorMessage = (e: unknown) => {
    if (typeof e === "string") return e;
    if (e && typeof e === "object" && "message" in e) {
      return String((e as { message?: unknown }).message);
    }
    return String(e);
  };

  const grantShareReward = async (platform: string) => {
    try {
      const res = await fetch(`/api/posts/${id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.error === "LOGIN_REQUIRED") {
          toast.info("공유 보상은 로그인 후 받을 수 있어요.");
          return;
        }
        // 실패해도 공유 자체는 성공했을 수 있으니 조용히 안내
        toast.error("공유 보상 지급에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }

      const reward = json?.reward;
      const already = json?.alreadyRewarded === true;
      if (already) {
        toast.info("오늘은 이미 이 게시글 공유 보상을 받았어요.");
        return;
      }

      const viewN = Number(reward?.additionalViews ?? 0);
      const pts = Number(reward?.points ?? 0);
      const parts: string[] = [];
      if (viewN > 0) parts.push(`열람권 +${viewN}`);
      if (pts > 0) parts.push(`포인트 +${pts}`);
      toast.success(`공유 보상 지급 완료${parts.length ? `: ${parts.join(", ")}` : ""}`);
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    if (!post) return;
    if (typeof window === "undefined") return;
    if (isSharing) return;

    const url = window.location.href;
    const title = post.title || `${post.ticker_symbol} 차트 분석`;
    const text = `${post.ticker_symbol} 차트 분석`;

    setIsSharing(true);
    try {
      // 1) Web Share API (모바일/일부 브라우저)
      if (navigator.share) {
        await navigator.share({ title, text, url });
        await grantShareReward("webshare");
        return;
      }

      // 2) Fallback: 링크 복사
      await navigator.clipboard.writeText(url);
      toast.success("링크가 복사되었습니다.");
      await grantShareReward("copy");
    } catch (e: unknown) {
      // 사용자가 공유 취소하면 조용히 종료
      const msg = errorMessage(e);
      if (msg.toLowerCase().includes("abort") || msg.includes("취소")) return;
      toast.error("공유에 실패했습니다.");
    } finally {
      setIsSharing(false);
    }
  };

  // 내 사용자(로그인) 확인
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled) setMeId(user?.id ?? null);
      } catch {
        if (!cancelled) setMeId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    async function loadPost() {
      setLoading(true);
      try {
        const data = await fetchPostById(id);
        setPost(data);
        
        // Fetch current price if prediction exists
        if (data?.prediction_type && data.ticker_symbol) {
          const price = await getCurrentPrice(data.ticker_symbol, "yahoo");
          setCurrentPrice(price);
        }
      } catch (e: unknown) {
        const msg = errorMessage(e);
        const code =
          e && typeof e === "object" && "code" in e
            ? String((e as { code?: unknown }).code ?? "")
            : "";
        if (code === "LIMIT_REACHED" || msg.includes("한도를 초과")) {
          console.log("Limit reached error caught, showing popup");
          setShowLimitPopup(true);
        } else {
          console.error("Unknown error in loadPost:", e);
          toast.error(msg || "게시글을 불러오는데 실패했습니다.");
        }
      } finally {
        setLoading(false);
      }
    }
    loadPost();
  }, [id]);

  const loadComments = async () => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/posts/${id}/comments`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "댓글을 불러오는데 실패했습니다.");
      setComments(Array.isArray(json?.comments) ? (json.comments as CommentItem[]) : []);
    } catch (e: unknown) {
      toast.error(errorMessage(e) || "댓글을 불러오는데 실패했습니다.");
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submitComment = async () => {
    const text = comment.trim();
    if (!text) return;
    if (commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.error === "LOGIN_REQUIRED") {
          toast.info("댓글 작성은 로그인 후 이용할 수 있어요.");
          return;
        }
        throw new Error(json?.error || "댓글 작성에 실패했습니다.");
      }
      const created = json?.comment as CommentItem | undefined;
      if (created?.id) {
        setComments((prev) => [...prev, created]);
        setComment("");
      } else {
        await loadComments();
        setComment("");
      }
      toast.success("댓글이 등록되었습니다.");
    } catch (e: unknown) {
      toast.error(errorMessage(e) || "댓글 작성에 실패했습니다.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const startEdit = (c: CommentItem) => {
    setEditingId(c.id);
    setEditingText(c.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const saveEdit = async (commentId: string) => {
    const text = editingText.trim();
    if (!text) {
      toast.info("내용을 입력해주세요.");
      return;
    }
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.error === "LOGIN_REQUIRED") {
          toast.info("로그인이 필요합니다.");
          return;
        }
        if (json?.error === "FORBIDDEN_OR_NOT_FOUND") {
          toast.error("수정 권한이 없거나 댓글을 찾을 수 없습니다.");
          return;
        }
        throw new Error(json?.error || "댓글 수정에 실패했습니다.");
      }
      const updated = json?.comment as CommentItem | undefined;
      if (updated?.id) {
        setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        await loadComments();
      }
      toast.success("댓글이 수정되었습니다.");
      cancelEdit();
    } catch (e: unknown) {
      toast.error(errorMessage(e) || "댓글 수정에 실패했습니다.");
    }
  };

  const deleteComment = async (commentId: string) => {
    const ok = window.confirm("댓글을 삭제할까요?");
    if (!ok) return;
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.error === "LOGIN_REQUIRED") {
          toast.info("로그인이 필요합니다.");
          return;
        }
        if (json?.error === "FORBIDDEN_OR_NOT_FOUND") {
          toast.error("삭제 권한이 없거나 댓글을 찾을 수 없습니다.");
          return;
        }
        throw new Error(json?.error || "댓글 삭제에 실패했습니다.");
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success("댓글이 삭제되었습니다.");
    } catch (e: unknown) {
      toast.error(errorMessage(e) || "댓글 삭제에 실패했습니다.");
    }
  };

  // ✅ 같은 종목 다른 게시물: SORT 기준으로만 정렬(검색창 제거)
  useEffect(() => {
    if (!post?.ticker_symbol) return;
    let cancelled = false;
    (async () => {
      setRelatedLoading(true);
      try {
        const sort = (
          relatedSortBy === "accuracy"
            ? "accuracy"
            : relatedSortBy === "most_analyzed"
              ? "views"
              : relatedSortBy === "completed"
                ? "completed"
                : "latest"
        ) as Parameters<typeof fetchPostsBySymbol>[0]["sort"];

        const rel = await fetchPostsBySymbol({
          symbol: post.ticker_symbol,
          excludeId: id,
          limit: 12,
          sort,
        });
        if (!cancelled) setRelatedPosts(rel);
      } finally {
        if (!cancelled) setRelatedLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [post?.ticker_symbol, relatedSortBy, id]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl py-20 text-center">
        <div className="animate-pulse text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto max-w-3xl py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">게시글을 찾을 수 없습니다.</h1>
        <Link href="/">
          <Button>홈으로 돌아가기</Button>
        </Link>
      </div>
    );
  }

  // Extract chart config
  const chartConfig = post.chart_config || {};
  const interval = chartConfig.interval || "D";
  const predictionPoints = chartConfig.prediction_points || [];
  const chartStyle = chartConfig.chartStyle || "candle";

  // Calculate accuracy if prediction exists
  let accuracyResult = null;
  if (post.prediction_type && post.entry_price && post.target_price && post.stop_loss_price && post.target_date && currentPrice) {
    accuracyResult = calculateAccuracy(
      {
        predictionType: post.prediction_type,
        entryPrice: post.entry_price,
        targetPrice: post.target_price,
        stopLossPrice: post.stop_loss_price,
        targetDate: new Date(post.target_date),
      },
      currentPrice
    );
  }

  const krName = post?.ticker_symbol ? getKoreanName(post.ticker_symbol) : null;

  const relatedSortOptions = SORT_OPTIONS.filter((o) =>
    ["latest", "accuracy", "most_analyzed", "completed"].includes(o.value)
  );

  return (
    <div className="container mx-auto max-w-6xl py-8 md:py-12 space-y-10">
      {/* Back Button */}
      <div>
        <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로 돌아가기
        </Link>
      </div>

      {/* Header / Meta */}
      <article className="space-y-8">
        <header className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold tracking-tight">
                {post.ticker_symbol}
              </span>
              {krName && <span className="text-sm text-foreground/80 font-medium">({krName})</span>}
              <span className="text-sm text-muted-foreground">
                {new Date(post.created_at).toLocaleString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                })}
              </span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground leading-tight tracking-tight">
              {post.title}
            </h1>
          </div>

          <div className="flex items-center justify-between py-4 border-y border-border/50">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10 border border-border/50">
                  <AvatarImage src={post.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="bg-muted text-sm font-bold">
                    {(post.profiles?.nickname || 'U')[0]}
                  </AvatarFallback>
                </Avatar>
                {post.profiles?.country_code && (
                  <div className="absolute -bottom-1 -right-1 bg-background rounded-sm shadow-sm">
                    <CountryFlag countryCode={post.profiles.country_code} size={14} />
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">{post.profiles?.nickname || '익명'}</span>
                <span className="text-xs text-muted-foreground">조회 {post.view_count || 0}</span>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-2 text-muted-foreground hover:text-foreground"
              onClick={handleShare}
              disabled={isSharing}
              title="공유하면 열람권/포인트 보상을 받을 수 있어요"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">공유하기</span>
            </Button>
          </div>
        </header>

        {/* Prediction Info (if exists) */}
        {post.prediction_type && post.entry_price && post.target_price && post.stop_loss_price && post.target_date && (
          <div className="py-2">
            <PredictionInfo
              predictionType={post.prediction_type}
              entryPrice={post.entry_price}
              targetPrice={post.target_price}
              stopLossPrice={post.stop_loss_price}
              targetDate={post.target_date}
              currentPrice={currentPrice || undefined}
              profitPercentage={accuracyResult?.profitPercentage}
              status={accuracyResult?.status || post.prediction_status}
            />
          </div>
        )}

        {/* Chart Section (Full width) */}
        <section>
          <h2 className="text-lg font-bold text-foreground mb-3">차트 분석</h2>
          <div className="h-[520px] w-full rounded-xl overflow-hidden border border-border/50 bg-background/50">
            <SavedChartViewer
              symbol={post.ticker_symbol}
              interval={interval}
              predictionPoints={predictionPoints}
              chartStyle={chartStyle}
            />
          </div>
        </section>
      </article>

      {/* Below chart: content + same-symbol list */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-10">
        <main className="space-y-10">
          {/* Main Body Content */}
          <div
            className="prose prose-neutral dark:prose-invert max-w-none leading-loose text-foreground/90"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button variant="outline" className="h-11 px-6 rounded-full gap-2 group border-border/60 hover:border-primary/50 hover:bg-primary/5">
              <ThumbsUp className="h-4 w-4 group-hover:text-primary transition-colors" />
              좋아요 <span className="ml-1 font-mono">0</span>
            </Button>
          </div>

          {/* Divider */}
          <hr className="border-border/40" />

          {/* Comments Section - Clean Style */}
          <section className="space-y-8">
            <h3 className="text-xl font-bold flex items-center gap-2">
              댓글 <span className="text-primary">{comments.length}</span>
            </h3>

            {/* Comment Input */}
            <div className="flex gap-4">
              <div className="h-10 w-10 rounded-full bg-muted flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <textarea
                  className="w-full min-h-[100px] rounded-xl border border-border/60 bg-transparent p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none placeholder:text-muted-foreground/70"
                  placeholder="의견을 남겨주세요."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={!comment.trim() || commentSubmitting}
                    className="rounded-full px-6"
                    onClick={submitComment}
                    title={meId ? undefined : "로그인이 필요합니다."}
                  >
                    {commentSubmitting ? "등록 중..." : "등록"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Comment List */}
            {commentsLoading ? (
              <div className="py-10 text-center text-muted-foreground/60 text-sm animate-pulse">
                댓글을 불러오는 중...
              </div>
            ) : comments.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground/60 text-sm">
                아직 댓글이 없습니다.<br />
                첫 번째 댓글의 주인공이 되어보세요!
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((c) => {
                  const isMine = !!meId && c.user_id === meId;
                  const nickname = c.profiles?.nickname || "익명";
                  return (
                    <div key={c.id} className="rounded-xl border border-border/50 bg-background/40 p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold border border-border/50">
                          {String(nickname)[0] || "U"}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold">{nickname}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(c.created_at).toLocaleString("ko-KR")}
                              </div>
                            </div>
                            {isMine && (
                              <div className="flex items-center gap-2">
                                {editingId === c.id ? (
                                  <>
                                    <button
                                      className="text-xs text-primary hover:underline"
                                      onClick={() => saveEdit(c.id)}
                                    >
                                      저장
                                    </button>
                                    <button
                                      className="text-xs text-muted-foreground hover:underline"
                                      onClick={cancelEdit}
                                    >
                                      취소
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      className="text-xs text-muted-foreground hover:underline"
                                      onClick={() => startEdit(c)}
                                    >
                                      수정
                                    </button>
                                    <button
                                      className="text-xs text-red-500 hover:underline"
                                      onClick={() => deleteComment(c.id)}
                                    >
                                      삭제
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {editingId === c.id ? (
                            <textarea
                              className="w-full min-h-[90px] rounded-xl border border-border/60 bg-transparent p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none"
                              placeholder="댓글을 수정하세요."
                              aria-label="댓글 수정"
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                            />
                          ) : (
                            <div className="text-sm whitespace-pre-wrap leading-relaxed">{c.content}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        {/* Right: Same symbol posts + search filter */}
        <aside className="hidden lg:block">
          <div className="space-y-4">
            <div className="rounded-xl border border-border/50 bg-background/50 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-sm font-semibold">같은 종목 다른 게시물</div>
                  <div className="text-xs text-muted-foreground">{post.ticker_symbol}</div>
                </div>
              </div>

              <select
                value={relatedSortBy}
                onChange={(e) => setRelatedSortBy(e.target.value as SortOption)}
                aria-label="같은 종목 게시물 정렬"
                className="w-full mb-3 px-3 py-2 rounded-lg border-0 bg-secondary/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {relatedSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {relatedLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">불러오는 중...</div>
              ) : relatedPosts.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  다른 게시물이 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {relatedPosts.map((p) => (
                    <div key={p.id} className="rounded-xl border border-border/40 bg-background/30 p-3">
                      <PostCard post={p} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Limit Popup */}
      <LimitPopup 
        isOpen={showLimitPopup} 
        onClose={() => setShowLimitPopup(false)}
        type="VIEW"
        onSuccess={() => window.location.reload()}
      />
    </div>
  );
}