'use client';

import { useState } from 'react';
import { previewSettlement, executeSettlement } from '@/app/admin/actions';

interface SettlementProcessProps {
  tournamentId: string;
  tournamentTitle: string;
  eventType: 'DECIMAL' | 'PREDICTION';
  onClose: () => void;
}

export default function SettlementProcess({ tournamentId, tournamentTitle, eventType, onClose }: SettlementProcessProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [targetValue, setTargetValue] = useState<string>('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Step 1: Input
  // Step 2: Preview
  // Step 3: Success

  const handlePreview = async () => {
    if (!targetValue) return;
    setLoading(true);
    const res = await previewSettlement(tournamentId, Number(targetValue));
    setLoading(false);
    
    if (res.winners) {
      setPreviewData(res.winners);
      setStep(2);
    } else {
      alert('Error fetching preview');
    }
  };

  const handleExecute = async () => {
    if (!confirm('Are you sure you want to settle this tournament? This action cannot be undone.')) return;
    
    setLoading(true);
    const res = await executeSettlement(tournamentId, previewData);
    setLoading(false);

    if (res.success) {
      alert('Settlement Completed!');
      onClose(); // Will close modal and page likely revalidates
    } else {
      alert('Error executing settlement');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-2xl shadow-2xl">
        <div className="flex justify-between mb-6">
           <h3 className="text-xl font-bold text-white">Settlement: {tournamentTitle}</h3>
           <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>

        {step === 1 && (
          <div className="space-y-4">
             <div className="bg-gray-800 p-4 rounded text-sm text-gray-300">
               <p>Please enter the final {eventType === 'DECIMAL' ? 'Decimal (0-99)' : 'Closing Price'} for the target asset.</p>
             </div>
             <div>
               <label className="block text-gray-400 text-sm mb-1">Final Result Value</label>
               <input 
                 type="number" 
                 className="w-full bg-black border border-gray-700 rounded p-3 text-xl font-mono text-white" 
                 placeholder={eventType === 'DECIMAL' ? "45" : "75000"}
                 value={targetValue}
                 onChange={(e) => setTargetValue(e.target.value)}
                 autoFocus
               />
             </div>
             <div className="flex justify-end pt-4">
               <button 
                 onClick={handlePreview}
                 disabled={loading || !targetValue}
                 className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold"
               >
                 {loading ? 'Calculating...' : 'Next: Preview Winners'}
               </button>
             </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
             <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded text-sm text-yellow-200">
               <span className="font-bold">⚠ Dry Run Mode</span>: Review the calculated winners below. Points will be distributed upon confirmation.
             </div>
             
             <div className="max-h-60 overflow-y-auto bg-black rounded border border-gray-800">
                <table className="w-full text-left text-sm text-gray-400">
                  <thead className="bg-gray-900 text-gray-200">
                    <tr>
                      <th className="p-2">Rank</th>
                      <th className="p-2">User</th>
                      <th className="p-2">Prediction</th>
                      <th className="p-2">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-800">
                        <td className="p-2 font-bold text-white">#{idx + 1}</td>
                        <td className="p-2">{row.user?.nickname || row.user_id.slice(0, 8)}</td>
                        <td className="p-2">{row.val ?? row.bestPrice}</td>
                        <td className="p-2 font-mono">{row.diff}</td>
                      </tr>
                    ))}
                    {previewData.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center">No matching winners found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
             </div>

             <div className="flex justify-between pt-4">
               <button onClick={() => setStep(1)} className="text-gray-400 hover:text-white">Back</button>
               <button 
                 onClick={handleExecute}
                 disabled={loading}
                 className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded font-bold shadow-[0_0_15px_rgba(22,163,74,0.5)]"
               >
                 {loading ? 'Processing...' : 'Confirm & Payout'}
               </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
