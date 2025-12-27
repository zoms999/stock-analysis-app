import { createClient } from '@/lib/supabase/server'
import CreateTournamentForm from '@/components/admin/CreateTournamentForm'
import AdminTournamentList from '@/components/admin/AdminTournamentList'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

export const dynamic = 'force-dynamic'

export default async function AdminTournamentsPage() {
  const supabase = await createClient()

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <AdminPageHeader title="토너먼트 관리" description="토너먼트를 생성하고 관리합니다." />

      <CreateTournamentForm />

      <div className="mt-8">
        <h2 className="text-xl font-semibold tracking-tight mb-4">진행 중 & 종료된 토너먼트</h2>
        <AdminTournamentList initialTournaments={tournaments || []} />
      </div>
    </div>
  )
}






