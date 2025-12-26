'use client';

import { useState } from 'react';
import { Tournament, TournamentEntry, PredictionSlot } from '@/types/tournament';
import ViralModal from './ViralModal';

interface PredictionPanelProps {
  tournament: Tournament;
  userEntry: TournamentEntry | null;
  onUnlockSlots: () => Promise<void>;
  onSubmit: (slots: PredictionSlot[]) => Promise<void>;
}

export default function PredictionPanel({ tournament, userEntry, onUnlockSlots, onSubmit }: PredictionPanelProps) {
  const [isViralModalOpen, setIsViralModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Initialize slots based on entry or defaults
  // If userEntry exists, use its data. If not, start with 1 empty slot.
  const [slots, setSlots] = useState<PredictionSlot[]>(() => {
    if (userEntry?.prediction_json?.slots) {
      return userEntry.prediction_json.slots;
    }
    if (userEntry?.prediction_value !== null && userEntry?.prediction_value !== undefined) {
      // Type 1 legacy mapping
      return [{ val: userEntry.prediction_value }];
    }
    return [{}]; // Default 1 empty slot
  });

  const maxSlots = userEntry?.max_re_entry || 1; // Default to 1 if no entry
  // If user hasn't unlocked, maxSlots is 1. If unlocked, it's 3.
  // Actually, we should check `max_re_entry`. If it's 3, we show 3 slots available. 
  // If it's 1 (default), we show 1 active and 2 locked.

  const totalPossibleSlots = 3;

  const handleViralSuccess = async () => {
    setIsViralModalOpen(false);
    setLoading(true);
    await onUnlockSlots();
    // Optimistically update UI or waiting for parent refresh
    setLoading(false);
  };

  const handleInputChange = (index: number, field: keyof PredictionSlot, value: string) => {
    const newSlots = [...slots];
    if (!newSlots[index]) newSlots[index] = {};

    // Type conversion
    if (field === 'val' || field === 'price') {
      newSlots[index] = { ...newSlots[index], [field]: Number(value) };
    } else {
      newSlots[index] = { ...newSlots[index], [field]: value };
    }
    setSlots(newSlots);
  };

  const handleSubmit = async () => {
    setLoading(true);
    await onSubmit(slots);
    setLoading(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <span>나의 예측</span>
        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">
          {maxSlots}/{totalPossibleSlots} 슬롯
        </span>
      </h3>

      <div className="space-y-4 mb-8">
        {Array.from({ length: totalPossibleSlots }).map((_, index) => {
          const isLocked = index >= maxSlots;
          const isType1 = tournament.event_type === 'DECIMAL';

          return (
            <div
              key={index}
              className={`relative p-4 rounded-lg border transition-all ${isLocked
                  ? 'bg-gray-950 border-gray-900 opacity-70 border-dashed cursor-pointer hover:border-purple-500/50'
                  : 'bg-black border-gray-800'
                }`}
              onClick={() => isLocked && setIsViralModalOpen(true)}
            >
              <div className="flex justify-between items-center mb-2">
                <span className={`text-sm font-bold ${isLocked ? 'text-gray-600' : 'text-purple-400'}`}>
                  슬롯 #{index + 1}
                </span>
                {isLocked && (
                  <span className="text-xs text-purple-500 font-bold flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7c0-2.757-2.243-5-5-5zm6 10v8H6v-8h12zm-9-2V7c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9z" /></svg>
                    잠김
                  </span>
                )}
              </div>

              {isLocked ? (
                <div className="flex items-center justify-center py-4 text-gray-500 text-sm font-medium">
                  공유하고 슬롯 잠금 해제
                </div>
              ) : (
                <div className="space-y-3">
                  {isType1 ? (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">예측값 (0-99)</label>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none focus:border-purple-500"
                        value={slots[index]?.val ?? ''}
                        onChange={(e) => handleInputChange(index, 'val', e.target.value)}
                        placeholder="45"
                      />
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">목표 가격</label>
                        <input
                          type="number"
                          className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none focus:border-purple-500"
                          value={slots[index]?.price ?? ''}
                          onChange={(e) => handleInputChange(index, 'price', e.target.value)}
                          placeholder="75000"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? '제출 중...' : '예측 제출하기'}
      </button>

      <ViralModal
        isOpen={isViralModalOpen}
        onClose={() => setIsViralModalOpen(false)}
        onShared={handleViralSuccess}
        tournamentId={tournament.id}
      />
    </div>
  );
}
