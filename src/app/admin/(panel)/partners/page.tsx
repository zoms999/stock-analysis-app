'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAllPartners, togglePartnerStatus, Partner } from '@/lib/api/admin-partners'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminTableCard } from '@/components/admin/AdminTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DollarSign, TrendingUp, Users } from 'lucide-react'

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
      <AdminPageHeader title="파트너 관리" description="파트너 현황 및 실적을 관리합니다." />

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

      <AdminTableCard>
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">파트너 정보</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">추천 코드</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">유치 회원</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">총 수익</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">상태</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">로딩 중...</td>
              </tr>
            ) : partners.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">등록된 파트너가 없습니다.</td>
              </tr>
            ) : (
              partners.map((partner) => (
                <tr key={partner.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium">{partner.nickname || 'Unknown'}</div>
                      <div className="text-sm text-muted-foreground">{partner.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-sm bg-muted px-2 py-1 rounded">{partner.referral_code || '-'}</code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{partner.total_referred_users || 0}명</td>
                  <td className="px-6 py-4 whitespace-nowrap">{(partner.total_earnings || 0).toLocaleString()}원</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      partner.is_partner ? 'bg-emerald-500/10 text-emerald-700' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {partner.is_partner ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => router.push(`/admin/partners/${partner.id}`)}
                      >
                        상세보기
                      </Button>
                      <Button
                        size="sm"
                        variant="link"
                        className="h-auto p-0 text-orange-700"
                        onClick={() => handleTogglePartner(partner.id, partner.is_partner)}
                        disabled={toggling === partner.id}
                      >
                        {toggling === partner.id ? '처리중...' : (partner.is_partner ? '비활성화' : '활성화')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </AdminTableCard>
    </div>
  )
}







