"use client";

import { usePoints } from "@/hooks/use-points";
import { PointHistory } from "@/components/point/PointHistory";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings, CreditCard, User as UserIcon } from "lucide-react";

const HISTORY_DATA = [
    { id: '1', date: '2023.12.07 14:30', description: '일일 차트 분석글 작성', amount: 500, type: 'earn' as const },
    { id: '2', date: '2023.12.06 09:15', description: '토너먼트 참가비', amount: -1000, type: 'spend' as const },
    { id: '3', date: '2023.12.05 18:20', description: '친구 초대 보상', amount: 500, type: 'earn' as const },
    { id: '4', date: '2023.12.05 10:00', description: '출석체크', amount: 50, type: 'earn' as const },
];



export default function MyPage() {
  const { points } = usePoints();
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
    };
    getUser();
  }, []);

  return (
    <div className="container py-8 max-w-5xl mx-auto space-y-8">
      {/* Profile Header */}
      <section className="flex flex-col md:flex-row items-center gap-6 p-8 rounded-2xl border border-border bg-card shadow-sm">
        <Avatar className="h-24 w-24 border-2 border-primary/20">
            <AvatarImage src="" />
            <AvatarFallback className="text-2xl font-bold bg-muted">
                {user?.email?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 text-center md:text-left space-y-2">
            <h1 className="text-2xl font-bold">{user?.email?.split('@')[0] || "게스트"}</h1>
            <p className="text-muted-foreground">{user?.email || "로그인이 필요합니다"}</p>
            <div className="flex items-center justify-center md:justify-start gap-2 pt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Level 1
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                    무료 멤버십
                </span>
            </div>
        </div>

        <div className="text-center p-4 bg-muted/30 rounded-xl min-w-[200px]">
            <p className="text-sm text-muted-foreground mb-1">보유 포인트</p>
            <p className="text-3xl font-bold text-primary">{points.toLocaleString()} P</p>
        </div>
      </section>

      {/* Main Content Tabs */}
      <Tabs defaultValue="points" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px] mb-8">
            <TabsTrigger value="points">포인트 관리</TabsTrigger>
            <TabsTrigger value="activity">활동 내역</TabsTrigger>
            <TabsTrigger value="settings">설정</TabsTrigger>
        </TabsList>

        <TabsContent value="points" className="space-y-6">
            <div className="max-w-3xl mx-auto">
                <PointHistory history={HISTORY_DATA} />
            </div>
        </TabsContent>

        <TabsContent value="activity">
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">
                <UserIcon className="h-12 w-12 mb-4 opacity-50" />
                <p>아직 활동 내역이 없습니다.</p>
                <Button variant="link" className="mt-2">커뮤니티 글 쓰러가기</Button>
            </div>
        </TabsContent>
        
        <TabsContent value="settings">
             <div className="rounded-xl border border-border bg-card p-6 space-y-6">
                <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                        <Settings className="h-5 w-5" /> 계정 설정
                    </h3>
                    <div className="grid gap-4 max-w-md">
                        <Button variant="outline" className="justify-start">비밀번호 변경</Button>
                        <Button variant="outline" className="justify-start">알림 설정</Button>
                        <Button variant="destructive" className="justify-start bg-red-500/10 text-red-500 hover:bg-red-500/20">회원 탈퇴</Button>
                    </div>
                </div>
             </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
