import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { Activity, CreditCard, Trophy, Users } from "lucide-react"

export const dynamic = "force-dynamic"

type RecentUser = {
  id: string
  email: string | null
  nickname: string | null
  user_level: number | null
  is_partner: boolean | null
  created_at: string
}

type SettlementAmountRow = { settlement_amount: number | null }
type PaymentAmountRow = { payment_amount: number | null; created_at: string }
type DailyUsageRow = {
  user_id: string | null
  view_count: number | null
  write_count: number | null
  additional_view_count: number | null
  additional_write_count: number | null
}

function getUtcDayRangeIso(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0, 0))
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  const today = new Date().toISOString().split("T")[0]
  const { startIso, endIso } = getUtcDayRangeIso(new Date())

  const [
    totalUsersRes,
    activeTournamentsRes,
    lockedTournamentsRes,
    pendingSettlementsCountRes,
    pendingSettlementsAmountRes,
    todayRevenueRes,
    todayUsageRes,
    recentUsersRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("tournaments").select("*", { count: "exact", head: true }).in("status", ["OPEN", "LOCKED"]),
    supabase.from("tournaments").select("*", { count: "exact", head: true }).eq("status", "LOCKED"),
    supabase.from("partner_settlements").select("*", { count: "exact", head: true }).eq("is_paid", false),
    supabase.from("partner_settlements").select("settlement_amount").eq("is_paid", false),
    supabase
      .from("partner_settlements")
      .select("payment_amount, created_at")
      .gte("created_at", startIso)
      .lt("created_at", endIso),
    supabase
      .from("daily_usage")
      .select("user_id, view_count, write_count, additional_view_count, additional_write_count")
      .eq("usage_date", today),
    supabase
      .from("profiles")
      .select("id, email, nickname, user_level, is_partner, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const totalUsers = totalUsersRes.count ?? null
  const activeTournaments = activeTournamentsRes.count ?? null

  const lockedTournaments = lockedTournamentsRes.count ?? 0
  const pendingSettlementsCount = pendingSettlementsCountRes.count ?? 0

  const pendingSettlementsAmount =
    (pendingSettlementsAmountRes.data as SettlementAmountRow[] | null)?.reduce(
      (sum, r) => sum + (r.settlement_amount ?? 0),
      0
    ) ?? 0

  // 오늘 매출(정산 발생 기준): partner_settlements.payment_amount 합계
  const todayRevenue =
    (todayRevenueRes.data as PaymentAmountRow[] | null)?.reduce((sum, r) => sum + (r.payment_amount ?? 0), 0) ?? 0

  // 오늘 방문자(추정): daily_usage에서 오늘 usage가 있는 유저 수
  const todayVisitors = (() => {
    const rows = (todayUsageRes.data as DailyUsageRow[] | null) || []
    const set = new Set<string>()
    for (const r of rows) {
      const total =
        (r.view_count ?? 0) + (r.write_count ?? 0) + (r.additional_view_count ?? 0) + (r.additional_write_count ?? 0)
      if (total > 0 && r.user_id) set.add(String(r.user_id))
    }
    return set.size
  })()

  const recentUsers = (recentUsersRes.data || []) as RecentUser[]

  return (
    <div>
      <AdminPageHeader
        title="대시보드"
        description="관리자 현황을 한눈에 확인합니다."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              총 회원수
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <p className="text-2xl font-bold">
                {typeof totalUsers === "number" ? `${totalUsers.toLocaleString()}명` : "-"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              오늘 매출(정산 기준)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              <p className="text-2xl font-bold">{todayRevenue.toLocaleString()}원</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              진행중 토너먼트
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <p className="text-2xl font-bold">
                {typeof activeTournaments === "number" ? `${activeTournaments}개` : "-"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              오늘 방문자(추정)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-500" />
              <p className="text-2xl font-bold">{todayVisitors.toLocaleString()}명</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              daily_usage 기준(열람/작성 등 활동 사용자)
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>할 일 (Pending Actions)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <div className="font-semibold">미지급 정산</div>
                  <div className="text-sm text-muted-foreground">
                    {pendingSettlementsCount.toLocaleString()}건 · {pendingSettlementsAmount.toLocaleString()}원
                  </div>
                </div>
                <Link
                  href="/admin/settlements"
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                >
                  바로가기
                </Link>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <div className="font-semibold">정산 대기 토너먼트(LOCKED)</div>
                  <div className="text-sm text-muted-foreground">{lockedTournaments.toLocaleString()}개</div>
                </div>
                <Link
                  href="/admin/tournaments"
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                >
                  바로가기
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 가입 회원</CardTitle>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">최근 가입 회원이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {recentUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg hover:bg-muted/40 p-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{u.nickname || u.email || `UUID: ${u.id.slice(0, 8)}...`}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleString("ko-KR", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {typeof u.user_level === "number" ? ` · LV ${u.user_level}` : ""}
                        {u.is_partner ? " · 파트너" : ""}
                      </div>
                    </div>
                    <Link
                      href="/admin/users"
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                    >
                      회원
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}







