'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPartnerStats, getRecentSettlements, PartnerStats, PartnerSettlement } from '@/lib/api/partner-api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, DollarSign, TrendingUp, Loader2, Copy, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'

export default function PartnerDashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<PartnerStats | null>(null)
  const [recentSettlements, setRecentSettlements] = useState<PartnerSettlement[]>([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const [statsData, settlementsData] = await Promise.all([
        getPartnerStats(user.id),
        getRecentSettlements(user.id, 10),
      ])

      setStats(statsData)
      setRecentSettlements(settlementsData)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      alert('대시보드 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const copyReferralLink = () => {
    if (!stats?.referral_code) return
    const referralUrl = `${window.location.origin}/login?ref=${stats.referral_code}`
    navigator.clipboard.writeText(referralUrl).then(() => {
      alert('추천 링크가 복사되었습니다!')
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">파트너 정보를 불러올 수 없습니다.</p>
      </div>
    )
  }

  const referralUrl = stats.referral_code 
    ? `${window.location.origin}/login?ref=${stats.referral_code}`
    : ''

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">파트너 대시보드</h1>
        <p className="text-muted-foreground">
          파트너 활동 현황과 수익을 확인하세요.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 유치 회원</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{stats.total_referred_users}명</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 수익</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold">{stats.total_earnings.toLocaleString()}원</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">정산 완료</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{stats.paid_earnings.toLocaleString()}원</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">정산 가능</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold text-orange-600">{stats.pending_earnings.toLocaleString()}원</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral Link Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">내 추천 링크</CardTitle>
          <CardDescription>친구를 초대하고 수익을 창출하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
            <Input
              readOnly
              value={referralUrl}
              className="h-9 border-0 bg-transparent px-0 font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={copyReferralLink}
              aria-label="추천 링크 복사"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            추천인 코드: <code className="bg-muted px-2 py-1 rounded">{stats.referral_code}</code>
          </p>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button 
          size="lg" 
          className="w-full"
          onClick={() => router.push('/partner/request-settlement')}
          disabled={stats.pending_earnings < 10000}
        >
          <DollarSign className="h-5 w-5 mr-2" />
          정산 요청하기
          {stats.pending_earnings < 10000 && (
            <span className="ml-2 text-xs opacity-70">(최소 10,000원)</span>
          )}
        </Button>
        <Button 
          size="lg" 
          variant="outline" 
          className="w-full"
          onClick={() => router.push('/partner/settlements')}
        >
          <ExternalLink className="h-5 w-5 mr-2" />
          전체 정산 내역 보기
        </Button>
      </div>

      {/* Recent Settlements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">최근 정산 내역</CardTitle>
          <CardDescription>최근 10건의 정산 기록</CardDescription>
        </CardHeader>
        <CardContent>
          {recentSettlements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>아직 정산 내역이 없습니다.</p>
              <p className="text-sm mt-2">추천한 회원이 결제하면 자동으로 정산됩니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSettlements.map((settlement) => (
                <div 
                  key={settlement.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{settlement.source_user_name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        settlement.is_paid 
                          ? 'bg-green-500/10 text-green-600' 
                          : 'bg-orange-500/10 text-orange-600'
                      }`}>
                        {settlement.is_paid ? '지급완료' : '대기중'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(settlement.created_at).toLocaleDateString('ko-KR')} · 
                      결제금액 {settlement.payment_amount.toLocaleString()}원 · 
                      수수료 {settlement.commission_rate}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      {settlement.settlement_amount.toLocaleString()}원
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
