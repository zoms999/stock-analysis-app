"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchNotices, Notice, getCategoryColor, getCategoryLabel } from "@/lib/api/notices";
import { Pin } from "lucide-react";

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNotices() {
      try {
        const data = await fetchNotices();
        setNotices(data);
      } catch (error) {
        console.error("Failed to load notices:", error);
      } finally {
        setLoading(false);
      }
    }
    loadNotices();
  }, []);

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

  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
           <h1 className="text-3xl font-bold mb-2">공지사항</h1>
           <p className="text-muted-foreground">새로운 소식과 업데이트를 확인하세요.</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      ) : notices.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">등록된 공지사항이 없습니다.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                      <th className="px-6 py-4 font-medium w-[100px] text-center">분류</th>
                      <th className="px-6 py-4 font-medium">제목</th>
                      <th className="px-6 py-4 font-medium w-[120px] text-center hidden sm:table-cell">날짜</th>
                      <th className="px-6 py-4 font-medium w-[100px] text-center hidden sm:table-cell">조회수</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-border">
                  {notices.map((notice, index) => (
                      <tr key={notice.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${getCategoryColor(notice.category)}`}>
                              {getCategoryLabel(notice.category)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                              <Link href={`/notices/${notice.id}`} className="font-medium group-hover:text-primary transition-colors flex items-center gap-2">
                                {notice.is_important && (
                                  <Pin className="h-4 w-4 text-primary flex-shrink-0" />
                                )}
                                <span className={notice.is_important ? "text-primary font-semibold" : ""}>
                                  {notice.title}
                                </span>
                              </Link>
                          </td>
                          <td className="px-6 py-4 text-center text-muted-foreground hidden sm:table-cell">
                            {formatDate(notice.created_at)}
                          </td>
                          <td className="px-6 py-4 text-center text-muted-foreground hidden sm:table-cell">
                            {formatViewCount(notice.view_count)}
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
