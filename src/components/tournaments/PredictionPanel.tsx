'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tournament, TournamentEntry, PredictionSlot } from '@/types/tournament';
import ViralModal from './ViralModal';

interface PredictionPanelProps {
  tournament: Tournament;
  userEntry: TournamentEntry | null;
  onUnlockSlots: () => Promise<any>;
  onSubmit: (slots: PredictionSlot[]) => Promise<void>;
  isPredictionDisabled?: boolean;
  disabledReason?: string;
  startDate?: Date;
  endDate?: Date;
  slots?: PredictionSlot[];
  onSlotsChange?: (slots: PredictionSlot[]) => void;
  maxSlots?: number;
  totalPossibleSlots?: number;
}

function formatDate(date: Date) {
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export default function PredictionPanel({
  tournament,
  userEntry,
  onUnlockSlots,
  onSubmit,
  isPredictionDisabled = false,
  disabledReason,
  startDate,
  endDate,
  slots = [{}],
  onSlotsChange,
  maxSlots = 1,
  totalPossibleSlots = 3
}: PredictionPanelProps) {
  const router = useRouter();
  const [isViralModalOpen, setIsViralModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleViralSuccess = async () => {
    setIsViralModalOpen(false);
    setLoading(true);
    try {
      const result = await onUnlockSlots();
      if (result?.error) {
        alert(`오류가 발생했습니다: ${result.error}`);
      } else if (result?.mock) {
        alert("Mock 모드: 슬롯 잠금 해제 요청이 성공했습니다. (화면이 새로고침되지 않을 수 있습니다)");
      } else {
        // Success - refresh to show updated slots
        router.refresh();
      }
    } catch (e) {
      console.error(e);
      alert("알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
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
    if (onSlotsChange) onSlotsChange(newSlots);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit(slots);
      // Refresh the page to show updated data
      router.refresh();
    } catch (error) {
      console.error('Submit error:', error);
      alert('예측 제출 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex flex-col gap-1 mb-6">
        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
          <span>나의 예측</span>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
            {maxSlots}/{totalPossibleSlots} 슬롯
          </span>
        </h3>
        {(startDate && endDate) && (
          <div className="text-xs text-muted-foreground">
            예측 기간: {formatDate(startDate)} ~ {formatDate(endDate)}
          </div>
        )}
        {isPredictionDisabled && (
          <span className="text-xs bg-red-900/50 text-red-400 px-2 py-1 rounded border border-red-800/50 w-fit mt-1">
            {disabledReason || "예측 기간이 아닙니다"}
          </span>
        )}
      </div>

      <div className="space-y-4 mb-8">
        {Array.from({ length: totalPossibleSlots }).map((_, index) => {
          const isLocked = index >= maxSlots;
          const isType1 = tournament.event_type === 'DECIMAL';

          return (
            <div
              key={index}
              className={`relative p-4 rounded-lg border transition-all ${isLocked
                ? 'bg-muted/50 border-input opacity-70 border-dashed cursor-pointer hover:border-purple-500/50'
                : 'bg-background border-input'
                }`}
              onClick={() => isLocked && setIsViralModalOpen(true)}
            >
              <div className="flex justify-between items-center mb-2">
                <span className={`text-sm font-bold ${isLocked ? 'text-muted-foreground' : 'text-purple-400'}`}>
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
                <div className="flex items-center justify-center py-4 text-muted-foreground text-sm font-medium">
                  공유하고 슬롯 잠금 해제
                </div>
              ) : (
                <div className="space-y-3">
                  {isType1 ? (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">예측값 (0-99)</label>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        className="w-full bg-muted border border-input rounded p-2 text-foreground outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        value={slots[index]?.val ?? ''}
                        onChange={(e) => handleInputChange(index, 'val', e.target.value)}
                        placeholder="45"
                        disabled={isPredictionDisabled}
                      />
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-muted-foreground mb-1">목표 가격</label>
                        <input
                          type="number"
                          className="w-full bg-muted border border-input rounded p-2 text-foreground outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          value={slots[index]?.price ?? ''}
                          onChange={(e) => handleInputChange(index, 'price', e.target.value)}
                          placeholder="75000"
                          disabled={isPredictionDisabled}
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
        disabled={loading || isPredictionDisabled}
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
