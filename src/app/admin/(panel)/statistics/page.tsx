'use client'

import { useEffect, useState } from 'react'
import { getPartnerStatistics, PartnerStats } from '@/lib/api/admin-partners'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { Trophy, TrendingUp, Users } from 'lucide-react'

export default function AdminStatisticsPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<PartnerStats[]>([])

  useEffect(() => {
    fetchStatistics()
  }, [])

  const fetchStatistics = async () => {
    setLoading(true)
    try {
      const data = await getPartnerStatistics()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch statistics:', error)
      alert('통계를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const totalUsers = stats.reduce((sum, s) => sum + s.invited_user_count, 0)
  const totalRevenue = stats.reduce((sum, s) => sum + s.total_earnings, 0)

  return (
    <div>
      <AdminPageHeader title="파트너 통계" description="파트너 실적 및 랭킹을 확인합니다." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">전체 파트너</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold">{stats.length}명</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 유치 회원</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{totalUsers}명</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 발생 수익</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{totalRevenue.toLocaleString()}원</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>수익 랭킹</CardTitle>
            <CardDescription>총 발생 수익 기준</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">로딩 중...</p>
              ) : stats.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">데이터가 없습니다.</p>
              ) : (
                stats.slice(0, 10).map((partner, index) => (
                  <div key={partner.partner_id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/40">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-foreground">
                        <span className="text-sm font-bold">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-semibold">{partner.nickname}</p>
                        <p className="text-xs text-muted-foreground">{partner.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{partner.total_earnings.toLocaleString()}원</p>
                      <p className="text-sm text-muted-foreground">{partner.invited_user_count}명 유치</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>유치 회원 랭킹</CardTitle>
            <CardDescription>총 유치 회원 수 기준</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">로딩 중...</p>
              ) : stats.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">데이터가 없습니다.</p>
              ) : (
                [...stats]
                  .sort((a, b) => b.invited_user_count - a.invited_user_count)
                  .slice(0, 10)
                  .map((partner, index) => (
                    <div key={partner.partner_id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/40">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-foreground">
                          <span className="text-sm font-bold">{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-semibold">{partner.nickname}</p>
                          <p className="text-xs text-muted-foreground">{partner.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{partner.invited_user_count}명</p>
                        <p className="text-sm text-muted-foreground">{partner.total_earnings.toLocaleString()}원</p>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}







