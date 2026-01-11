"use client";

import { Tournament, TournamentEntry, PredictionSlot } from '@/types/tournament';
import PredictionPanel from './PredictionPanel';
import RealtimeLeaderboard from './RealtimeLeaderboard';
import { Button } from '@/components/ui/button';

import Link from 'next/link';
import { ChartAnalyzer } from '@/components/analyze/ChartAnalyzer';
import { Card } from '@/components/ui/card';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart2, LineChart } from "lucide-react";

interface TournamentDetailViewProps {
  tournament: Tournament;
  userEntry: TournamentEntry | null;
  // Actions
  onUnlockSlots: () => Promise<any>;
  onSubmit: (slots: PredictionSlot[]) => Promise<void>;
}

export default function TournamentDetailView({ tournament, userEntry, onUnlockSlots, onSubmit }: TournamentDetailViewProps) {
  const startDate = useMemo(() => tournament.start_date ? new Date(tournament.start_date) : new Date(0), [tournament.start_date]);
  const endDate = useMemo(() => tournament.end_date ? new Date(tournament.end_date) : new Date(tournament.target_date), [tournament.end_date, tournament.target_date]);
  const now = new Date();
  
  const isEnded = tournament.status === 'SETTLED' || endDate < now;
  const isStarted = now >= startDate;
  const isPredictionPeriod = isStarted && !isEnded;
  
  const [interval, setInterval] = useState("D");
  const [chartStyle, setChartStyle] = useState<"candle" | "line">("line");

  // Mobile check for default interval
  useEffect(() => {
      if (typeof window === "undefined") return;
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      if (isMobile) setInterval("D");
  }, []);

  const activeIntervals = [
      { label: "년", value: "Y" },
      { label: "월", value: "M" },
      { label: "주", value: "W" },
      { label: "일", value: "D" },
      { label: "시", value: "60" },
      { label: "분", value: "1" },
  ];

  // --- [State Lifting & Sync] ---
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

  // Calculate duration in days (inclusive of start and end?)
  // Example: Jan 10 to Jan 15.
  // 10, 11, 12, 13, 14, 15 => 6 days? or 5?
  // User image: Jan 10 9pm to Jan 15 9pm. Exactly 5 days (120 hours).
  // If we want 1 slot per day, it should be 5.
  const durationInDays = useMemo(() => {
      if (!startDate || !endDate) return 3;
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      return Math.max(1, diffDays);
  }, [startDate, endDate]);

  const maxSlots = userEntry?.max_re_entry || 1;
  const totalPossibleSlots = durationInDays;

  // Sync Timer for Points <-> Slots
  // Chart Point structure: { time: Time, value: number }
  // Slot structure: { val?: number, price?: number } (plus implicit index)
  
  // We need to convert slots to points for the chart
  const [chartPoints, setChartPoints] = useState<{ time: string, value: number }[]>([]);

  // When slots change (from panel), update chart points? 
  // Actually, this is tricky because slots don't strictly have 'time' unless we store it.
  // BUT the chart needs time. 
  // If the user inputs a price in the panel, where do we put the point on the chart?
  // We cannot easily infer time. 
  // Strategy: 
  // 1. Chart -> Panel: Easy. Point has value -> Slot gets value.
  // 2. Panel -> Chart: Hard. Slot has value, but no time.
  //    - Option A: Don't show panel-edited values on chart unless they have a time associated (which they don't in current model).
  //    - Option B: Just show a horizontal line?
  //    - Option C: If the slot was originally created from a chart click, maybe we kept the time?
  //    Let's look at PredictionSlot type. It likely doesn't have time.
  //    
  //    For now, let's focus on Chart -> Panel (User clicks chart -> Fills slot).
  //    And Panel -> Chart (User edits price -> Updates point Y value, keeping X if it exists? Or ignoring?)
  
  // Let's assume for this task: One-way primary sync (Chart -> Panel) is the most critical for "Prediction Points".
  // If user types in panel, we might just leave the chart point as is or update if we can match it.
  
  // Actually, to make "points" constrain to "slots", we need to know which point corresponds to which slot.
  // Index-based mapping is the simplest. Point 0 -> Slot 0.

  const handleChartPointsChange = useCallback((newPoints: { time: any, value: number }[]) => {
      // Allow only up to maxSlots points
      if (newPoints.length > maxSlots) {
          newPoints = newPoints.slice(0, maxSlots); 
      }

      setChartPoints(newPoints);

      // Update slots based on points
      setSlots(prevSlots => {
          const newSlots = [...prevSlots];
          
          for (let i = 0; i < maxSlots; i++) {
             // Ensure slot object exists
             if (!newSlots[i]) newSlots[i] = {};

             if (i < newPoints.length) {
                 // Update price with rounding
                 const rounded = Math.round(newPoints[i].value * 100) / 100;
                 newSlots[i] = { ...newSlots[i], price: rounded };
             } else {
                 // Clear price if point removed
                 if (newSlots[i].price !== undefined) {
                     const { price, ...rest } = newSlots[i];
                     newSlots[i] = rest;
                 }
             }
          }
          return newSlots;
      });
  }, [maxSlots]);

  const handleSlotsChange = useCallback((newSlots: PredictionSlot[]) => {
      setSlots(newSlots);
      // We don't necessarily update chart points here because we lack 'time' for manual entries.
      // Unless we want to visualize manual entries as horizontal lines, but ChartAnalyzer expects points (Time+Value).
  }, []);



  const rules = tournament.ranking_rules 
      ? tournament.ranking_rules.split('\n').filter(Boolean)
      : [
          "목표 시간의 종가를 예측하세요.",
          "실제 가격과 가장 가까운 예측을 한 참가자가 승리합니다.", 
          "친구에게 공유하고 최대 3개의 예측 슬롯을 잠금 해제하세요."
        ];

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        
        {/* Header - Mobile only */}
        <div className="lg:hidden col-span-1 border-b border-border pb-4">
           <h1 className="text-2xl font-bold mb-2 text-foreground">{tournament.title}</h1>
           <div className="flex flex-col gap-1">
             <p className="text-gray-400 text-sm">{tournament.description}</p>
             {(tournament.start_date && tournament.end_date) && (
               <p className="text-xs text-blue-400 font-medium bg-blue-900/20 px-2 py-1 rounded w-fit">
                  📅 대회 기간: {new Date(tournament.start_date).toLocaleString()} ~ {new Date(tournament.end_date).toLocaleString()}
               </p>
             )}
           </div>
        </div>

        {/* Left Column: Chart & Info */}
        <div className="lg:col-span-8 flex flex-col gap-6">
           {/* Chart Area */}
           <div className="flex-1 min-h-[500px] bg-card rounded-2xl border border-border p-1 flex flex-col relative overflow-hidden group">
              {tournament.stock_symbol ? (
                  <div className="flex flex-col h-full">
                    {/* Control Bar */}
                    <div className="px-4 py-2 flex flex-col sm:flex-row justify-between items-center bg-transparent gap-4 border-b border-gray-800">
                         <div className="flex items-center gap-3">
                              <h2 className="font-bold text-lg text-white flex items-center gap-2">
                                  {tournament.stock_symbol}
                              </h2>
                              <span className="text-sm text-gray-400 mr-2">
                                  {interval === "Y" && "연봉"}
                                  {interval === "M" && "월봉"}
                                  {interval === "W" && "주봉"}
                                  {interval === "D" && "일봉"}
                                  {interval === "60" && "60분봉"}
                                  {interval === "1" && "1분봉"}
                              </span>
                          </div>

                          <div className="flex items-center gap-2">
                              <Tabs value={interval} onValueChange={setInterval} className="w-full sm:w-auto">
                                  <TabsList className="bg-gray-800 border-0 h-8 p-0.5">
                                      {activeIntervals.map((item) => (
                                          <TabsTrigger
                                              key={item.value}
                                              value={item.value}
                                              className="text-xs px-3 h-7 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-sm text-gray-400 hover:text-white transition-colors"
                                          >
                                              {item.label}
                                          </TabsTrigger>
                                      ))}
                                  </TabsList>
                              </Tabs>

                              <div className="flex items-center bg-gray-800 border-0 rounded-lg p-0.5 h-8">
                                  <Button
                                      variant="ghost"
                                      size="sm"
                                      className={`h-7 px-3 text-xs font-medium rounded-sm ${chartStyle === 'line' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                      onClick={() => setChartStyle('line')}
                                  >
                                      라인
                                  </Button>
                                  <Button
                                      variant="ghost"
                                      size="sm"
                                      className={`h-7 px-3 text-xs font-medium rounded-sm ${chartStyle === 'candle' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                      onClick={() => setChartStyle('candle')}
                                  >
                                      캔들
                                  </Button>
                              </div>
                          </div>
                    </div>

                    <div className="flex-1 w-full relative">
                        <ChartAnalyzer 
                            symbol={tournament.stock_symbol}
                            interval={interval}
                            chartStyle={chartStyle}
                            minDate={startDate}
                            maxDate={endDate}
                            maxPoints={maxSlots}
                            onPointsChange={handleChartPointsChange}
                        />
                    </div>
                  </div>
              ) : (
                  <div className="flex flex-col items-center justify-center h-full relative">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black opacity-50" />
                       <div className="z-10 text-center">
                          <h3 className="text-2xl font-bold text-gray-700 mb-2">실시간 차트 영역</h3>
                          <p className="text-gray-500">차트 컴포넌트가 이곳에 표시될 예정입니다.</p>
                          <p className="text-xs text-gray-600 mt-2">목표 시간: {new Date(tournament.target_date).toLocaleString()}</p>
                       </div>
                  </div>
              )}
           </div>

           {/* Results Button if Ended */}
           {isEnded && (
             <div className="bg-yellow-900/20 border border-yellow-700/50 p-6 rounded-xl text-center">
                <h3 className="text-xl font-bold text-yellow-500 mb-2">대회가 종료되었습니다!</h3>
                <p className="text-gray-400 mb-4">결과를 확인하고 상금을 수령하세요 (자동 지급됨).</p>
                <Link href={`/tournaments/${tournament.id}/results`}>
                    <Button size="lg" className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold">
                        🏆 결과 확인하기
                    </Button>
                </Link>
             </div>
           )}

            {/* Info / Rule Book */}
            <div className="bg-card/50 rounded-xl p-6 border border-border/50">
               <h4 className="font-bold text-foreground mb-2">대회 규칙</h4>
               <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {rules.map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                ))}
              </ul>
           </div>
        </div>

        {/* Right Column: Interaction & Leaderboard */}
        <div className="lg:col-span-4 flex flex-col gap-6">
           <div className="hidden lg:block">
              <h1 className="text-3xl font-black mb-2 leading-tight">{tournament.title}</h1>
              <div className="text-2xl font-bold text-yellow-500 mb-2">
                  {tournament.prize_pool} 
                  <span className="text-sm text-gray-500 ml-2 font-normal">
                      ({tournament.prize_type === 'VOUCHER' ? '상품권' : '포인트'})
                  </span>
              </div>
              {(tournament.start_date && tournament.end_date) && (
                <div className="mb-4">
                   <p className="text-sm text-blue-400 font-medium bg-blue-900/20 px-3 py-1.5 rounded-lg inline-flex items-center gap-2">
                      📅 {new Date(tournament.start_date).toLocaleString()} ~ {new Date(tournament.end_date).toLocaleString()}
                   </p>
                </div>
              )}
           </div>

           {!isEnded && (
             <PredictionPanel 
               tournament={tournament}
               userEntry={userEntry}
               onUnlockSlots={onUnlockSlots}
               onSubmit={onSubmit}
               isPredictionDisabled={!isPredictionPeriod}
               disabledReason={!isStarted ? "대회가 아직 시작되지 않았습니다." : undefined}
               startDate={startDate}
               endDate={endDate}
               slots={slots}
               onSlotsChange={handleSlotsChange}
               maxSlots={maxSlots}
               totalPossibleSlots={totalPossibleSlots}
             />
           )}

           {/* Real-time Leaderboard */}
           <RealtimeLeaderboard tournamentId={tournament.id} />
        </div>

      </div>
    </div>
  );
}
