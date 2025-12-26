import { createClient } from '@/lib/supabase/server';
import CreateTournamentForm from '@/components/admin/CreateTournamentForm';
import AdminTournamentList from '@/components/admin/AdminTournamentList'; 

export const dynamic = 'force-dynamic';

export default async function AdminTournamentsPage() {
  const supabase = await createClient();
  
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">토너먼트 관리</h1>
        <p className="text-sm text-gray-500 mt-1">토너먼트를 생성하고 관리합니다.</p>
      </div>
      
      <CreateTournamentForm />

      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">진행 중 & 종료된 토너먼트</h2>
        <AdminTournamentList initialTournaments={tournaments || []} />
      </div>
    </div>
  );
}
