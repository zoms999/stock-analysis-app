'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getReferredUsers, getPartnerSettlements, ReferredUser, Settlement } from '@/lib/api/admin-partners'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Users, DollarSign, Calendar } from 'lucide-react'

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
    if (partnerId) {
      fetchPartnerData()
    }
  }, [partnerId])

  const fetchPartnerData = async () => {
    setLoading(true)
    try {
      // Fetch partner profile directly
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
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    )
  }

  if (!partner) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">파트너를 찾을 수 없습니다.</p>
      </div>
    )
  }

  const totalEarnings = settlements.reduce((sum, s) => sum + s.settlement_amount, 0)
  const paidEarnings = settlements.filter(s => s.is_paid).reduce((sum, s) => sum + s.settlement_amount, 0)
  const pendingEarnings = totalEarnings - paidEarnings

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          파트너 목록으로
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{partner.nickname || 'Unknown'}</h1>
        <p className="text-sm text-gray-500 mt-1">{partner.email}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">유치 회원 수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{referredUsers.length}명</span>
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
              <span className="text-2xl font-bold">{paidEarnings.toLocaleString()}원</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">정산 대기</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold">{pendingEarnings.toLocaleString()}원</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info">기본 정보</TabsTrigger>
          <TabsTrigger value="settlements">정산 내역</TabsTrigger>
          <TabsTrigger value="users">유치 회원 목록</TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>파트너 기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">이메일</p>
                  <p className="font-medium">{partner.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">닉네임</p>
                  <p className="font-medium">{partner.nickname || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">추천 코드</p>
                  <code className="bg-gray-100 px-2 py-1 rounded">{partner.referral_code || '-'}</code>
                </div>
                <div>
                  <p className="text-sm text-gray-500">사용자 레벨</p>
                  <p className="font-medium">Level {partner.user_level}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">포인트 잔액</p>
                  <p className="font-medium">{partner.point_balance.toLocaleString()} P</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settlements Tab */}
        <TabsContent value="settlements">
          <Card>
            <CardHeader>
              <CardTitle>정산 내역</CardTitle>
              <CardDescription>총 {settlements.length}건의 정산 기록</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">결제자</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">결제금액</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수수료율</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">정산금액</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {settlements.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          정산 내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      settlements.map((settlement) => (
                        <tr key={settlement.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(settlement.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {settlement.source_user_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {settlement.payment_amount.toLocaleString()}원
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {settlement.commission_rate}%
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {settlement.settlement_amount.toLocaleString()}원
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              settlement.is_paid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {settlement.is_paid ? '지급완료' : '대기중'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Referred Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>유치 회원 목록</CardTitle>
              <CardDescription>총 {referredUsers.length}명의 회원</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">가입일</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">닉네임</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">레벨</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {referredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          유치한 회원이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      referredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {user.email}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {user.nickname || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              LV {user.user_level}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
