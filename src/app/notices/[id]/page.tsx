"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const MOCK_NOTICES: Record<string, any> = {
  "1": { title: "서비스 오픈 기념 이벤트 안내", date: "2024.11.01", content: "<p>서비스 오픈을 기념하여 신규 회원 가입 시 500 포인트를 증정합니다.</p><br/><p>많은 참여 부탁드립니다.</p>" },
  "2": { title: "[공지] 시스템 점검 안내 (11/15)", date: "2024.11.10", content: "<p>안정적인 서비스를 위해 시스템 점검이 진행될 예정입니다.</p><br/><p>일시: 2024년 11월 15일 02:00 ~ 06:00 (4시간)</p>" },
  "3": { title: "주식 차트 데이터 연동 완료 (Finnhub)", date: "2024.11.20", content: "<p>미국 주식 데이터 연동이 완료되었습니다.</p><br/><p>이제 애플, 테슬라 등 해외 주식 차트도 확인하실 수 있습니다.</p>" },
  "4": { title: "VIP 등급 혜택 변경 안내", date: "2024.11.25", content: "<p>VIP 등급 회원을 위한 혜택이 강화됩니다.</p><br/><p>자세한 내용은 멤버십 페이지를 참고해주세요.</p>" },
  "5": { title: "개인정보 처리방침 개정 안내", date: "2024.12.01", content: "<p>개인정보 처리방침이 일부 개정되었습니다.</p>" },
};

export default function NoticeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const notice = MOCK_NOTICES[id];

  if (!notice) {
      return <div>공지사항을 찾을 수 없습니다.</div>;
  }

  return (
    <div className="container py-8 max-w-4xl mx-auto">
        <Link href="/notices" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로 돌아가기
        </Link>
        
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-6 md:p-8 border-b border-border">
                <div className="flex flex-col gap-2 mb-4">
                     <span className="text-primary font-bold text-sm">공지사항</span>
                     <h1 className="text-2xl md:text-3xl font-bold leading-tight">{notice.title}</h1>
                </div>
                <div className="text-sm text-muted-foreground">
                    작성일: {notice.date} • 조회수 1,205
                </div>
            </div>
            
            <div className="p-6 md:p-8 min-h-[300px] prose prose-invert max-w-none text-foreground/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: notice.content }} />
            
            <div className="p-6 bg-muted/20 border-t border-border flex justify-end">
                 <Link href="/notices">
                    <Button variant="outline">목록</Button>
                 </Link>
            </div>
        </div>
    </div>
  );
}
