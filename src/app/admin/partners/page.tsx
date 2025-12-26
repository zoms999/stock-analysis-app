'use client'

import { useState, useEffect } from 'react'
import { getAllPartners, togglePartnerStatus, Partner } from '@/lib/api/admin-partners'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, DollarSign, TrendingUp } from 'lucide-react'

export default function AdminPartnersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [partners, setPartners] = useState<Partner[]>([])
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    fetchPartners()
  }, [])

  const fetchPartners = async () => {
    setLoading(true)
    try {
      const data = await getAllPartners()
      setPartners(data)
    } catch (error) {
      console.error('Failed to fetch partners:', error)
      alert('파트너 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleTogglePartner = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`정말로 파트너 상태를 ${currentStatus ? '비활성화' : '활성화'}하시겠습니까?`)) {
      return
    }

    setToggling(userId)
    try {
      await togglePartnerStatus(userId, !currentStatus)
      alert('파트너 상태가 변경되었습니다.')
      fetchPartners()
    } catch (error) {
      console.error('Failed to toggle partner:', error)
      alert('파트너 상태 변경에 실패했습니다.')
    } finally {
      setToggling(null)
    }
  }

  const totalPartners = partners.length
  const totalReferredUsers = partners.reduce((sum, p) => sum + (p.total_referred_users || 0), 0)
  const totalEarnings = partners.reduce((sum, p) => sum + (p.total_earnings || 0), 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">파트너 관리</h1>
        <p className="text-sm text-gray-500 mt-1">파트너 현황 및 실적을 관리합니다.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 파트너 수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{totalPartners}명</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 유치 회원</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{totalReferredUsers}명</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 정산 금액</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold">{totalEarnings.toLocaleString()}원</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partners Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">파트너 정보</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">추천 코드</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">유치 회원</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총 수익</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : partners.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  등록된 파트너가 없습니다.
                </td>
              </tr>
            ) : (
              partners.map((partner) => (
                <tr key={partner.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{partner.nickname || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{partner.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">{partner.referral_code || '-'}</code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {partner.total_referred_users || 0}명
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(partner.total_earnings || 0).toLocaleString()}원
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      partner.is_partner ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {partner.is_partner ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => router.push(`/admin/partners/${partner.id}`)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      상세보기
                    </button>
                    <button
                      onClick={() => handleTogglePartner(partner.id, partner.is_partner)}
                      disabled={toggling === partner.id}
                      className="text-orange-600 hover:text-orange-900 disabled:opacity-50"
                    >
                      {toggling === partner.id ? '처리중...' : (partner.is_partner ? '비활성화' : '활성화')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
