"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

const MOCK_NOTICES = [
  { id: 1, title: "서비스 오픈 기념 이벤트 안내", date: "2024.11.01", views: 1205 },
  { id: 2, title: "[공지] 시스템 점검 안내 (11/15)", date: "2024.11.10", views: 854 },
  { id: 3, title: "주식 차트 데이터 연동 완료 (Finnhub)", date: "2024.11.20", views: 2341 },
  { id: 4, title: "VIP 등급 혜택 변경 안내", date: "2024.11.25", views: 1532 },
  { id: 5, title: "개인정보 처리방침 개정 안내", date: "2024.12.01", views: 420 },
];

export default function NoticesPage() {
  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
           <h1 className="text-3xl font-bold mb-2">공지사항</h1>
           <p className="text-muted-foreground">새로운 소식과 업데이트를 확인하세요.</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                    <th className="px-6 py-4 font-medium w-[80px] text-center">번호</th>
                    <th className="px-6 py-4 font-medium">제목</th>
                    <th className="px-6 py-4 font-medium w-[120px] text-center hidden sm:table-cell">날짜</th>
                    <th className="px-6 py-4 font-medium w-[100px] text-center hidden sm:table-cell">조회수</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-border">
                {MOCK_NOTICES.map((notice) => (
                    <tr key={notice.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-6 py-4 text-center text-muted-foreground">{notice.id}</td>
                        <td className="px-6 py-4">
                            <Link href={`/notices/${notice.id}`} className="font-medium group-hover:text-primary transition-colors block">
                                {notice.title}
                            </Link>
                        </td>
                        <td className="px-6 py-4 text-center text-muted-foreground hidden sm:table-cell">{notice.date}</td>
                        <td className="px-6 py-4 text-center text-muted-foreground hidden sm:table-cell">{notice.views}</td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}
