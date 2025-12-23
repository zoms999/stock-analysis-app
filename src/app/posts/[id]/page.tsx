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
      <div className="container mx-auto max-w-4xl py-10 text-center">
        <div className="animate-pulse">로딩 중...</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto max-w-4xl py-10 text-center">
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
    <div className="container mx-auto max-w-4xl py-6 pb-20 space-y-6">
      {/* Back Button */}
      <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        목록으로 돌아가기
      </Link>

      {/* Prediction Info (if exists) */}
      {post.prediction_type && post.entry_price && post.target_price && post.stop_loss_price && post.target_date && (
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
      )}

      {/* Chart Section */}
      <section className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-1">차트 분석</h2>
          <div className="h-[400px] w-full rounded-lg overflow-hidden border border-border">
            <SavedChartViewer
              symbol={post.ticker_symbol}
              interval={interval}
              predictionPoints={predictionPoints}
              chartStyle={chartStyle}
            />
          </div>
        </div>
      </section>

      {/* Post Content */}
      <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <header className="mb-6 border-b border-border pb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
              {post.ticker_symbol}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(post.created_at).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3 leading-tight">
            {post.title}
          </h1>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                {(post.profiles?.nickname || 'U')[0]}
              </div>
              <div>
                <p className="text-sm font-medium">{post.profiles?.nickname || '익명'}</p>
                <p className="text-xs text-muted-foreground">조회 {post.view_count || 0}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">공유</span>
              </Button>
            </div>
          </div>
        </header>

        <div
          className="prose prose-invert max-w-none text-muted-foreground leading-relaxed mb-8"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button variant="outline" className="gap-2 group">
            <ThumbsUp className="h-4 w-4 group-hover:text-primary transition-colors" />
            좋아요 0
          </Button>
          <Button variant="ghost" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            댓글 0
          </Button>
        </div>
      </article>

      {/* Comments Section */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
          댓글 <span className="text-primary">0</span>
        </h3>

        {/* Comment Input */}
        <div className="flex gap-3 mb-8">
          <div className="h-10 w-10 rounded-full bg-muted/50 flex-shrink-0" />
          <div className="flex-1">
            <textarea
              className="w-full min-h-[80px] rounded-lg border border-border bg-secondary/50 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              placeholder="매너있는 댓글을 남겨주세요."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex justify-end mt-2">
              <Button size="sm" disabled={!comment.trim()}>등록</Button>
            </div>
          </div>
        </div>

        {/* Comment List */}
        <div className="space-y-6">
          <div className="text-center py-8 text-muted-foreground text-sm">
            아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!
          </div>
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
