import { createClient } from '@/lib/supabase/server';
import CreateTournamentForm from '@/components/admin/CreateTournamentForm';
import AdminTournamentList from '@/components/admin/AdminTournamentList'; 

// We'll create a client component "AdminTournamentList" to handle the client-side interactions 
// like opening modals, calling client-side state actions, etc. 
// Server components like this page are good for initial data fetching.

export const dynamic = 'force-dynamic';

export default async function AdminTournamentsPage() {
  const supabase = await createClient();
  
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-white">Tournament Management</h1>
      
      <CreateTournamentForm />

      <h2 className="text-xl font-bold text-gray-400 mb-4">Active & Past Tournaments</h2>
      
      {/* We pass data to a client component to handle interactions */}
      <AdminTournamentList initialTournaments={tournaments || []} />
    </div>
  );
}
