"use client";


import { PointHistory } from "@/components/point/PointHistory";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { getUserSubscription, getTodayUsage, getUserProfile, UserSubscription, TodayUsage, UserProfile } from "@/lib/api/mypage";
import { getUserActivity, ActivityItem } from "@/lib/api/activity";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings, CreditCard, User as UserIcon, BarChart3, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [usage, setUsage] = useState<TodayUsage | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const [subData, usageData, activityData, profileData] = await Promise.all([
          getUserSubscription(user.id),
          getTodayUsage(user.id),
          getUserActivity(user.id, 10),
          getUserProfile(user.id),
        ]);
        setSubscription(subData);
        setUsage(usageData);
        setActivity(activityData);
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setLoading(false);
    }
  };

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
                    Level {subscription?.accessMaxLevel || 1}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                    {subscription?.planName || '무료 멤버십'}
                </span>
            </div>
        </div>

        <div className="text-center p-4 bg-muted/30 rounded-xl min-w-[200px]">
            <p className="text-sm text-muted-foreground mb-1">보유 포인트</p>
            <p className="text-3xl font-bold text-primary">{profile?.point_balance.toLocaleString() || 0} P</p>
        </div>
      </section>

      {/* Subscription & Usage Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Subscription Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle>구독 정보</CardTitle>
              </div>
              <CardDescription>현재 구독 중인 플랜</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">{subscription?.planName}</p>
                  <p className="text-sm text-muted-foreground">
                    {subscription?.planPrice === 0 
                      ? '무료' 
                      : `${subscription?.planPrice.toLocaleString()}원/월`}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  subscription?.status === 'active' 
                    ? 'bg-green-500/10 text-green-500' 
                    : 'bg-gray-500/10 text-gray-500'
                }`}>
                  {subscription?.status === 'active' ? '활성' : '비활성'}
                </div>
              </div>

              {subscription?.planName !== 'Free' && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">다음 결제일</p>
                    <p className="text-sm font-medium">
                      {new Date(subscription?.currentPeriodEnd || '').toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">일일 한도</p>
                    <p className="text-sm font-medium">
                      열람 {subscription?.dailyViewLimit}회 / 글쓰기 {subscription?.dailyWriteLimit}회
                    </p>
                  </div>
                </div>
              )}

              <Button 
                className="w-full" 
                onClick={() => router.push('/subscription')}
              >
                {subscription?.planName === 'Free' ? '플랜 업그레이드' : '플랜 변경'}
              </Button>
            </CardContent>
          </Card>

          {/* Usage Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle>오늘 사용량</CardTitle>
              </div>
              <CardDescription>일일 한도 및 사용 현황</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 열람 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">열람</p>
                  <p className="text-sm text-muted-foreground">
                    {usage?.viewCount} / {(usage?.viewLimit || 0) + (usage?.additionalViewCount || 0)}회
                  </p>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(100, ((usage?.viewCount || 0) / ((usage?.viewLimit || 0) + (usage?.additionalViewCount || 0))) * 100)}%` 
                    }}
                  />
                </div>
                {usage?.additionalViewCount ? (
                  <p className="text-xs text-muted-foreground">
                    추가 구매: +{usage.additionalViewCount}회
                  </p>
                ) : null}
              </div>

              {/* 글쓰기 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">글쓰기</p>
                  <p className="text-sm text-muted-foreground">
                    {usage?.writeCount} / {(usage?.writeLimit || 0) + (usage?.additionalWriteCount || 0)}회
                  </p>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(100, ((usage?.writeCount || 0) / ((usage?.writeLimit || 0) + (usage?.additionalWriteCount || 0))) * 100)}%` 
                    }}
                  />
                </div>
                {usage?.additionalWriteCount ? (
                  <p className="text-xs text-muted-foreground">
                    추가 구매: +{usage.additionalWriteCount}회
                  </p>
                ) : null}
              </div>

              <div className="pt-2 text-xs text-muted-foreground text-center">
                매일 자정에 초기화됩니다
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="points" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px] mb-8">
            <TabsTrigger value="points">포인트 관리</TabsTrigger>
            <TabsTrigger value="activity">활동 내역</TabsTrigger>
            <TabsTrigger value="settings">설정</TabsTrigger>
        </TabsList>

        <TabsContent value="points" className="space-y-6">
            <div className="max-w-3xl mx-auto">
                {activity.length > 0 ? (
                  <PointHistory history={activity} />
                ) : (
                  <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
                    <p>아직 포인트 거래 내역이 없습니다.</p>
                  </div>
                )}
            </div>
        </TabsContent>

        <TabsContent value="activity">
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">
                <UserIcon className="h-12 w-12 mb-4 opacity-50" />
                <p>아직 활동 내역이 없습니다.</p>
                <Button variant="link" className="mt-2" onClick={() => router.push('/analyze')}>
                  커뮤니티 글 쓰러가기
                </Button>
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
