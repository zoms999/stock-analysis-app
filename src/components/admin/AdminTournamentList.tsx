'use client';

import { useState } from 'react';
import { Tournament } from '@/types/tournament';
import { updateTournamentStatus } from '@/app/admin/actions';
import SettlementProcess from './SettlementProcess';
import { format } from 'date-fns';

interface AdminTournamentListProps {
  initialTournaments: any[]; // Using any generally or defined type if matched perfectly
}

export default function AdminTournamentList({ initialTournaments }: AdminTournamentListProps) {
  const [settlementTarget, setSettlementTarget] = useState<any | null>(null);

  const handleStatusChange = async (id: string, newStatus: 'OPEN' | 'LOCKED' | 'SETTLED') => {
    if (!confirm(`Change status to ${newStatus}?`)) return;
    await updateTournamentStatus(id, newStatus);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-800 text-gray-300 uppercase font-bold">
          <tr>
            <th className="p-4">Title</th>
            <th className="p-4">Type</th>
            <th className="p-4">Target Date</th>
            <th className="p-4">Status</th>
            <th className="p-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {initialTournaments.map((t) => (
            <tr key={t.id} className="hover:bg-gray-800/50 transition-colors">
              <td className="p-4 font-medium text-white">{t.title}</td>
              <td className="p-4">
                <span className={`px-2 py-1 rounded text-xs ${t.event_type === 'DECIMAL' ? 'bg-purple-900 text-purple-200' : 'bg-blue-900 text-blue-200'}`}>
                  {t.event_type}
                </span>
              </td>
              <td className="p-4 text-gray-400">
                {format(new Date(t.target_date), 'MMM d, HH:mm')}
              </td>
              <td className="p-4">
                 <span className={`px-2 py-1 rounded text-xs font-bold 
                   ${t.status === 'OPEN' ? 'bg-green-500/20 text-green-400' : 
                     t.status === 'LOCKED' ? 'bg-red-500/20 text-red-400' : 
                     t.status === 'UPCOMING' ? 'bg-yellow-500/20 text-yellow-400' : 
                     'bg-gray-500/20 text-gray-400'}`}>
                   {t.status}
                 </span>
              </td>
              <td className="p-4 text-right space-x-2">
                {t.status === 'UPCOMING' && (
                  <button onClick={() => handleStatusChange(t.id, 'OPEN')} className="text-green-400 hover:text-green-300 hover:underline">Start (Open)</button>
                )}
                {t.status === 'OPEN' && (
                  <button onClick={() => handleStatusChange(t.id, 'LOCKED')} className="text-red-400 hover:text-red-300 hover:underline">Lock</button>
                )}
                {(t.status === 'LOCKED' || t.status === 'OPEN') && (
                   <button 
                     onClick={() => setSettlementTarget(t)}
                     className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded"
                   >
                     Settle
                   </button>
                )}
              </td>
            </tr>
          ))}
          {initialTournaments.length === 0 && (
            <tr>
              <td colSpan={5} className="p-8 text-center text-gray-500">No tournaments found. Create one above.</td>
            </tr>
          )}
        </tbody>
      </table>

      {settlementTarget && (
        <SettlementProcess 
          tournamentId={settlementTarget.id}
          tournamentTitle={settlementTarget.title}
          eventType={settlementTarget.event_type}
          onClose={() => setSettlementTarget(null)}
        />
      )}
    </div>
  );
}
