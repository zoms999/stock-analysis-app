'use client';

import { useState } from 'react';
import { createTournament } from '@/app/admin/actions';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export default function CreateTournamentForm() {
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    const payload = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      event_type: formData.get('event_type') as 'DECIMAL' | 'PREDICTION',
      target_date: formData.get('target_date') as string,
      prize_pool: formData.get('prize_pool') as string,
    };

    const res = await createTournament(payload);
    setLoading(false);
    if (res.error) {
      alert(res.error);
    } else {
      alert('Tournament Created Successfully!');
      setIsOpen(false);
      (e.target as HTMLFormElement).reset();
    }
  };

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)}>
        + 새 토너먼트 만들기
      </Button>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle>새 토너먼트 만들기</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            이벤트 정보를 입력하고 토너먼트를 생성합니다.
          </p>
        </div>
        <Button variant="outline" onClick={() => setIsOpen(false)}>
          닫기
        </Button>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">제목</label>
              <Input name="title" required placeholder="예: 삼성 주간 예측전" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">상금(Prize Pool)</label>
              <Input name="prize_pool" required placeholder="예: 1,000,000 P" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">설명</label>
            <Textarea
              name="description"
              placeholder="규칙/승리 조건/기타 안내를 입력하세요"
              className="min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">이벤트 타입</label>
              <select
                name="event_type"
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                )}
              >
                <option value="PREDICTION">Price Prediction (Type B)</option>
                <option value="DECIMAL">Decimal/Lotto (Type A)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">타겟 날짜</label>
              <Input name="target_date" type="datetime-local" required />
            </div>
          </div>
        </CardContent>

        <CardFooter className="gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
            취소
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "생성 중..." : "토너먼트 생성"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
