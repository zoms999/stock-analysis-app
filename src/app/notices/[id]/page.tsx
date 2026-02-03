"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pin } from "lucide-react";
import { fetchNoticeById, Notice, getCategoryColor, getCategoryLabel, logNoticeView } from "@/lib/api/notices";

export default function NoticeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadNotice() {
      try {
        const data = await fetchNoticeById(id);
        if (!data) {
          setError("공지사항을 찾을 수 없습니다.");
        } else {
          // 성공
          setNotice(data);
          await logNoticeView(id);
          // notice_view_logs
          // INSERT INTO public.notice_view_logs
          // (id, notice_id, user_id, viewed_at)
          // VALUES(gen_random_uuid(), ?, ?, now());
        }
      } catch (err) {
        console.error("Failed to load notice:", err);
        setError("공지사항을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }
    loadNotice();
  }, [id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).replace(/\. /g, ".").replace(/\.$/, "");
  };

  const formatViewCount = (count: number) => {
    return count.toLocaleString("ko-KR");
  };

  if (loading) {
    return (
      <div className="container py-8 max-w-4xl mx-auto">
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !notice) {
    return (
      <div className="container py-8 max-w-4xl mx-auto">
        <Link href="/notices" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로 돌아가기
        </Link>
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">{error || "공지사항을 찾을 수 없습니다."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <Link href="/notices" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        목록으로 돌아가기
      </Link>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-6 md:p-8 border-b border-border">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${getCategoryColor(notice.category)}`}>
                {getCategoryLabel(notice.category)}
              </span>
              {notice.is_important && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  <Pin className="h-3 w-3" />
                  필독
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">{notice.title}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>작성일: {formatDate(notice.created_at)}</span>
            <span>•</span>
            <span>조회수: {formatViewCount(notice.view_count)}</span>
            {notice.profiles && (
              <>
                <span>•</span>
                <span>작성자: {notice.profiles.nickname}</span>
              </>
            )}
          </div>
        </div>

        <div
          className="p-6 md:p-8 min-h-[300px] prose prose-invert max-w-none text-foreground/90 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: notice.content }}
        />

        <div className="p-6 bg-muted/20 border-t border-border flex justify-end">
          <Link href="/notices">
            <Button variant="outline">목록</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
