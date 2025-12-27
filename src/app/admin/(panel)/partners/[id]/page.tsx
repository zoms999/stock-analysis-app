'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPartnerSettlements, getReferredUsers, ReferredUser, Settlement } from '@/lib/api/admin-partners'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminTableCard } from '@/components/admin/AdminTable'

interface PartnerProfile {
  id: string
  email: string
  nickname: string
  referral_code: string | null
  user_level: number
  point_balance: number
  is_partner: boolean
}

export default function PartnerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const partnerId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState<PartnerProfile | null>(null)
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])

  useEffect(() => {
    if (partnerId) fetchPartnerData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId])

  const fetchPartnerData = async () => {
    setLoading(true)
    try {
      const { data: partnerData, error: partnerError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', partnerId)
        .single()

      if (partnerError) throw partnerError

      const [referred, settlementsData] = await Promise.all([
        getReferredUsers(partnerId),
        getPartnerSettlements(partnerId),
      ])

      setPartner(partnerData)
      setReferredUsers(referred)
      setSettlements(settlementsData)
    } catch (error) {
      console.error('Failed to fetch partner data:', error)
      alert('파트너 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="py-12 text-sm text-muted-foreground">로딩 중...</div>
  }

  if (!partner) {
    return <div className="py-12 text-sm text-muted-foreground">파트너를 찾을 수 없습니다.</div>
  }

  const totalEarnings = settlements.reduce((sum, s) => sum + s.settlement_amount, 0)
  const paidEarnings = settlements.filter((s) => s.is_paid).reduce((sum, s) => sum + s.settlement_amount, 0)
  const pendingEarnings = totalEarnings - paidEarnings

  return (
    <div>
      <AdminPageHeader
        title={partner.nickname || 'Unknown'}
        description={partner.email}
        actions={
          <Button variant="outline" onClick={() => router.back()}>
            목록으로
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">유치 회원 수</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{referredUsers.length}명</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">정산 완료</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{paidEarnings.toLocaleString()}원</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">정산 대기</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{pendingEarnings.toLocaleString()}원</span>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info">기본 정보</TabsTrigger>
          <TabsTrigger value="settlements">정산 내역</TabsTrigger>
          <TabsTrigger value="users">유치 회원 목록</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>파트너 기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">이메일</p>
                  <p className="font-medium">{partner.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">닉네임</p>
                  <p className="font-medium">{partner.nickname || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">추천 코드</p>
                  <code className="bg-muted px-2 py-1 rounded">{partner.referral_code || '-'}</code>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">사용자 레벨</p>
                  <p className="font-medium">Level {partner.user_level}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">포인트 잔액</p>
                  <p className="font-medium">{partner.point_balance.toLocaleString()} P</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settlements">
          <Card>
            <CardHeader>
              <CardTitle>정산 내역</CardTitle>
              <CardDescription>총 {settlements.length}건의 정산 기록</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminTableCard>
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">날짜</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">결제자</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">결제금액</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">수수료율</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">정산금액</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          정산 내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      settlements.map((settlement) => (
                        <tr key={settlement.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(settlement.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">{settlement.source_user_name}</td>
                          <td className="px-4 py-3">{settlement.payment_amount.toLocaleString()}원</td>
                          <td className="px-4 py-3">{settlement.commission_rate}%</td>
                          <td className="px-4 py-3 font-medium">{settlement.settlement_amount.toLocaleString()}원</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              settlement.is_paid ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'
                            }`}>
                              {settlement.is_paid ? '지급완료' : '대기중'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </AdminTableCard>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>유치 회원 목록</CardTitle>
              <CardDescription>총 {referredUsers.length}명의 회원</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminTableCard>
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">가입일</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">이메일</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">닉네임</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">레벨</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          유치한 회원이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      referredUsers.map((user) => (
                        <tr key={user.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">{user.email}</td>
                          <td className="px-4 py-3">{user.nickname || '-'}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary/10 text-primary">
                              LV {user.user_level}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </AdminTableCard>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}




