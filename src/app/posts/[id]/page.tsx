"use client";

import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Heart, Share2, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// Dynamic import for Chart to avoid SSR issues
const TechChart = dynamic(() => import("@/components/chart/TechChart").then(mod => mod.TechChart), {
  ssr: false,
  loading: () => <div className="h-[400px] w-full animate-pulse bg-muted/20 rounded-xl" />
});

// Mock Data for Posts
const MOCK_POSTS: Record<string, any> = {
  "1": {
    id: 1,
    title: "비트코인 65k 저항 돌파 가능할까요? (차트분석)",
    author: "CryptoKing",
    date: "2시간 전",
    views: "1.2k",
    content: `
      <p>현재 4시간 봉 기준 다이버전스가 명확하게 보입니다.</p>
      <p>거래량이 동반된 상승이 필요해 보이는 시점입니다. 65k를 강하게 뚫어준다면 다음 저항선인 68k까지는 무난하게 갈 것으로 보이나,</p>
      <p>여기서 저항을 맞고 떨어진다면 62k 부근의 지지 테스트를 다시 하러 갈 수도 있습니다.</p>
      <br />
      <p>RSI 지표상으로도 과매수 구간에 진입하여 단기 조정 가능성을 열어두어야 합니다.</p>
    `,
    symbol: "KRW-BTC",
    source: "upbit",
    comments: [
        { id: 1, user: "BitMax", text: "동의합니다. 65k가 중요해 보이네요.", time: "10분 전" },
        { id: 2, user: "ToTheMoon", text: "그냥 롱 잡고 잡니다.", time: "1시간 전" }
    ]
  },
  "2": {
    id: 2,
    title: "이더리움 현물 ETF 승인 이후 흐름 예측",
    author: "EtherWhale",
    date: "5시간 전",
    views: "3.4k",
    content: `
      <p>이더리움 현물 ETF 승인이 사실상 확정적인 분위기입니다.</p>
      <p>과거 비트코인 ETF 승인 당시의 차트 흐름을 복기해보면, 승인 직전까지 기대감으로 상승하다가 승인 직후 '뉴스에 팔아라' 매물로 인해 단기 하락이 나왔습니다.</p>
      <p>하지만 기관 자금 유입이 본격화되면서 장기적으로는 우상향 곡선을 그렸죠.</p>
      <br />
      <p>현재 이더리움 차트도 수렴 끝자락에 와있으며, 방향성이 곧 나올 것으로 보입니다.</p>
    `,
    symbol: "KRW-ETH",
    source: "upbit",
    comments: [
         { id: 1, user: "GasFeeHater", text: "가스비나 좀 내렸으면...", time: "30분 전" }
    ]
  },
  "3": {
    id: 3,
    title: "애플(AAPL) 실적 발표 전 기술적 분석",
    author: "StockPro",
    date: "1일 전",
    views: "5.1k",
    content: `
      <p>애플이 곧 실적을 발표합니다. 차트상으로는 박스권 하단을 지지받고 반등하는 모습입니다.</p>
      <p>아이폰 판매량 둔화 우려가 선반영되어 주가가 눌려있었기 때문에, 실적이 예상치만 상회하더라도 큰 반등이 나올 수 있습니다.</p>
      <p>단기 목표가는 $185, 손절가는 $165로 보고 대응하면 좋을 것 같습니다.</p>
    `,
    symbol: "AAPL",
    source: "finnhub",
    comments: []
  }
};

export default function PostDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const post = MOCK_POSTS[id];
  const [comment, setComment] = useState("");

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

  return (
    <div className="container mx-auto max-w-4xl py-6 pb-20 space-y-6">
      {/* Back Button */}
      <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        목록으로 돌아가기
      </Link>

      {/* Chart Section */}
      <section className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-sm">
        <div className="mb-4">
            <h2 className="text-sm font-medium text-muted-foreground mb-1">관련 차트</h2>
            <div className="h-[400px] w-full rounded-lg overflow-hidden border border-border">
                <TechChart source={post.source} symbol={post.symbol} />
            </div>
        </div>
      </section>

      {/* Post Content */}
      <article className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <header className="mb-6 border-b border-border pb-6">
            <div className="flex items-center gap-2 mb-3">
                 <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {post.symbol}
                 </span>
                 <span className="text-xs text-muted-foreground">{post.date}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3 leading-tight">
                {post.title}
            </h1>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                        {post.author[0]}
                    </div>
                    <div>
                        <p className="text-sm font-medium">{post.author}</p>
                        <p className="text-xs text-muted-foreground">조회 {post.views}</p>
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
                좋아요 12
            </Button>
             <Button variant="ghost" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                댓글 {post.comments.length}
            </Button>
        </div>
      </article>

      {/* Comments Section */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            댓글 <span className="text-primary">{post.comments.length}</span>
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
            {post.comments.map((comment: any) => (
                <div key={comment.id} className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {comment.user[0]}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold">{comment.user}</span>
                            <span className="text-xs text-muted-foreground">{comment.time}</span>
                        </div>
                        <p className="text-sm text-foreground/80">{comment.text}</p>
                    </div>
                </div>
            ))}
             {post.comments.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                    아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!
                </div>
            )}
        </div>
      </section>
    </div>
  );
}
