"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Heart, Share2, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { LimitPopup } from "@/components/subscription/LimitPopup";
import { toast } from "sonner";
import { SavedChartViewer } from "@/components/analyze/SavedChartViewer";
import { PredictionInfo } from "@/components/analyze/PredictionInfo";
import { fetchPostById, Post } from "@/lib/api/posts";
import { getCurrentPrice } from "@/lib/api/prices";
import { calculateAccuracy } from "@/lib/utils/accuracy";


export default function PostDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  const [showLimitPopup, setShowLimitPopup] = useState(false);
  const router = useRouter();

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
      } catch (e: any) {
        if (e?.code === "LIMIT_REACHED" || e?.message?.includes("한도를 초과")) {
          console.log("Limit reached error caught, showing popup");
          setShowLimitPopup(true);
        } else {
          console.error("Unknown error in loadPost:", e);
          toast.error(e.message || "게시글을 불러오는데 실패했습니다.");
        }
      } finally {
        setLoading(false);
      }
    }
    loadPost();
  }, [id]);

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

  return (
    <div className="container mx-auto max-w-3xl py-8 md:py-12 space-y-10">
      {/* Back Button */}
      <div>
        <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로 돌아가기
        </Link>
      </div>

      {/* Post Content Wrapper */}
      <article className="space-y-8">
        {/* Header Section */}
        <header className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold tracking-tight">
                {post.ticker_symbol}
              </span>
              <span className="text-sm text-muted-foreground">
                {new Date(post.created_at).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground leading-tight tracking-tight">
              {post.title}
            </h1>
          </div>

          <div className="flex items-center justify-between py-4 border-y border-border/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold border border-border/50">
                {(post.profiles?.nickname || 'U')[0]}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">{post.profiles?.nickname || '익명'}</span>
                <span className="text-xs text-muted-foreground">조회 {post.view_count || 0}</span>
              </div>
            </div>
            
            <Button variant="ghost" size="sm" className="h-9 gap-2 text-muted-foreground hover:text-foreground">
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

        {/* Chart Section - Borderless container, but chart itself usually needs a subtle boundary */}
        <section>
          <h2 className="text-lg font-bold text-foreground mb-3">차트 분석</h2>
          <div className="h-[450px] w-full rounded-xl overflow-hidden border border-border/50 bg-background/50">
            <SavedChartViewer
              symbol={post.ticker_symbol}
              interval={interval}
              predictionPoints={predictionPoints}
              chartStyle={chartStyle}
            />
          </div>
        </section>

        {/* Main Body Content */}
        <div
          className="prose prose-neutral dark:prose-invert max-w-none leading-loose text-foreground/90"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-8">
          <Button variant="outline" className="h-11 px-6 rounded-full gap-2 group border-border/60 hover:border-primary/50 hover:bg-primary/5">
            <ThumbsUp className="h-4 w-4 group-hover:text-primary transition-colors" />
            좋아요 <span className="ml-1 font-mono">0</span>
          </Button>
        </div>
      </article>

      {/* Divider */}
      <hr className="border-border/40" />

      {/* Comments Section - Clean Style */}
      <section className="space-y-8">
        <h3 className="text-xl font-bold flex items-center gap-2">
          댓글 <span className="text-primary">0</span>
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
              <Button size="sm" disabled={!comment.trim()} className="rounded-full px-6">등록</Button>
            </div>
          </div>
        </div>

        {/* Comment List Placeholder */}
        <div className="py-10 text-center text-muted-foreground/60 text-sm">
          아직 댓글이 없습니다.<br/>첫 번째 댓글의 주인공이 되어보세요!
        </div>
      </section>

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