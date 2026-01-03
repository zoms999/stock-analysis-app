'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPartnerSettlementHistory, PartnerSettlement } from '@/lib/api/partner-api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, Clock, Filter } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export default function PartnerSettlementsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [settlements, setSettlements] = useState<PartnerSettlement[]>([])
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all')

  useEffect(() => {
    loadSettlements()
  }, [])

  const loadSettlements = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const data = await getPartnerSettlementHistory(user.id)
      setSettlements(data)
    } catch (error) {
      console.error('Failed to load settlements:', error)
      alert('정산 내역을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const filteredSettlements = settlements.filter(s => {
    if (filter === 'paid') return s.is_paid
    if (filter === 'pending') return !s.is_paid
    return true
  })

  const totalAmount = filteredSettlements.reduce((sum, s) => sum + s.settlement_amount, 0)
  const paidAmount = settlements.filter(s => s.is_paid).reduce((sum, s) => sum + s.settlement_amount, 0)
  const pendingAmount = settlements.filter(s => !s.is_paid).reduce((sum, s) => sum + s.settlement_amount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">정산 내역</h1>
          <p className="text-muted-foreground">
            모든 정산 기록을 확인하세요.
          </p>
        </div>
        <Button onClick={() => router.push('/partner/request-settlement')}>
          정산 요청하기
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">전체 정산</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{settlements.length}건</span>
              <span className="text-sm text-muted-foreground">
                {totalAmount.toLocaleString()}원
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">지급 완료</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-green-600">
                {settlements.filter(s => s.is_paid).length}건
              </span>
              <span className="text-sm text-muted-foreground">
                {paidAmount.toLocaleString()}원
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">대기 중</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold text-orange-600">
                {settlements.filter(s => !s.is_paid).length}건
              </span>
              <span className="text-sm text-muted-foreground">
                {pendingAmount.toLocaleString()}원
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settlements Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">정산 목록</CardTitle>
              <CardDescription>총 {filteredSettlements.length}건의 정산 기록</CardDescription>
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-auto">
              <TabsList>
                <TabsTrigger value="all">전체</TabsTrigger>
                <TabsTrigger value="paid">지급완료</TabsTrigger>
                <TabsTrigger value="pending">대기중</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSettlements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>정산 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">발생일</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">결제자</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">결제금액</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">수수료율</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">정산금액</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSettlements.map((settlement) => (
                    <tr key={settlement.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                      <td className="px-4 py-4 whitespace-nowrap text-muted-foreground">
                        {new Date(settlement.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap font-medium">
                        {settlement.source_user_name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        {settlement.payment_amount.toLocaleString()}원
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        {settlement.commission_rate}%
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right font-bold text-primary">
                        {settlement.settlement_amount.toLocaleString()}원
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          settlement.is_paid
                            ? 'bg-green-500/10 text-green-600'
                            : 'bg-orange-500/10 text-orange-600'
                        }`}>
                          {settlement.is_paid ? '지급완료' : '대기중'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
