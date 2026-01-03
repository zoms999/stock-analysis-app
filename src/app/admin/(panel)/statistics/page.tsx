'use client'

import { useEffect, useState } from 'react'
import { getPartnerStatistics, PartnerStats } from '@/lib/api/admin-partners'
import { getDailyUserGrowth, getDailyRevenue, DailyStat, RevenueStat } from '@/lib/api/analytics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { Trophy, TrendingUp, Users, DollarSign, Activity, Calendar } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function AdminStatisticsPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<PartnerStats[]>([])
  const [userGrowth, setUserGrowth] = useState<DailyStat[]>([])
  const [revenueTrend, setRevenueTrend] = useState<RevenueStat[]>([])

  useEffect(() => {
    fetchStatistics()
  }, [])

  const fetchStatistics = async () => {
    setLoading(true)
    try {
      const pStats = getPartnerStatistics()
      const pUserGrowth = getDailyUserGrowth(30)
      const pRevenue = getDailyRevenue(30)

      const [data, users, revenue] = await Promise.all([pStats, pUserGrowth, pRevenue])
      
      setStats(data)
      setUserGrowth(users)
      setRevenueTrend(revenue)
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
    <div className="space-y-6">
      <AdminPageHeader title="통계 대시보드" description="전체 시스템의 현황을 시각적으로 확인합니다." />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 파트너</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.length}명</div>
            <p className="text-xs text-muted-foreground">
               활성 파트너 수
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 유치 회원</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}명</div>
            <p className="text-xs text-muted-foreground">
              파트너를 통한 가입
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 발생 수익</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRevenue.toLocaleString()}원</div>
            <p className="text-xs text-muted-foreground">
              누적 정산 금액 기준
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>일별 신규 가입 추이</CardTitle>
            <CardDescription>
              최근 30일간의 사용자 가입 현황입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
             <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={userGrowth}>
                        <XAxis 
                            dataKey="date" 
                            stroke="#888888" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false}
                            tickFormatter={(value) => new Date(value).getDate().toString()}
                        />
                        <YAxis
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}`}
                        />
                        <Tooltip 
                            contentStyle={{ background: '#333', border: 'none', borderRadius: '4px', color: '#fff' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="count"
                            stroke="#8884d8"
                            strokeWidth={2}
                            activeDot={{ r: 8 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
             </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>일별 매출(정산) 추이</CardTitle>
            <CardDescription>
              최근 30일간 발생한 정산 금액입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <div className="h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={revenueTrend}>
                    <XAxis
                        dataKey="date"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => new Date(value).getDate().toString()}
                    />
                    <YAxis
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${value}`}
                    />
                     <Tooltip 
                        cursor={{fill: 'transparent'}}
                        contentStyle={{ background: '#333', border: 'none', borderRadius: '4px', color: '#fff' }}
                        formatter={(value: number | undefined) => [value?.toLocaleString() ?? '0', '금액']}
                    />
                    <Bar dataKey="amount" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
            <TabsTrigger value="revenue">수익 랭킹</TabsTrigger>
            <TabsTrigger value="users">유치 회원 랭킹</TabsTrigger>
        </TabsList>
        <TabsContent value="revenue" className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>수익 랭킹 TOP 10</CardTitle>
                    <CardDescription>가장 많은 수익을 창출한 파트너입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-8"> 
                    {/* Reusing existing ranked list layout */}
                     {stats.slice(0, 10).map((partner, index) => (
                      <div key={partner.partner_id} className="flex items-center">
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary font-bold mr-4">
                            {index + 1}
                        </div>
                        <div className="ml-4 space-y-1">
                          <p className="text-sm font-medium leading-none">{partner.nickname}</p>
                          <p className="text-sm text-muted-foreground">{partner.email}</p>
                        </div>
                        <div className="ml-auto font-medium">+{partner.total_earnings.toLocaleString()}원</div>
                      </div>
                    ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="users">
            <Card>
                <CardHeader>
                    <CardTitle>회원 유치 랭킹 TOP 10</CardTitle>
                    <CardDescription>가장 많은 회원을 유치한 파트너입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-8">
                     {[...stats].sort((a,b) => b.invited_user_count - a.invited_user_count).slice(0, 10).map((partner, index) => (
                      <div key={partner.partner_id} className="flex items-center">
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-500/10 text-blue-500 font-bold mr-4">
                            {index + 1}
                        </div>
                        <div className="ml-4 space-y-1">
                          <p className="text-sm font-medium leading-none">{partner.nickname}</p>
                          <p className="text-sm text-muted-foreground">{partner.email}</p>
                        </div>
                        <div className="ml-auto font-medium">{partner.invited_user_count}명</div>
                      </div>
                    ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
