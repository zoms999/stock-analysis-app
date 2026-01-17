"use client";

import { useEffect, useState } from "react";
import { getDailyPredictions, DailyPrediction } from "@/lib/api/daily-predictions";
import { format } from "date-fns";

interface DailyAccuracyTableProps {
  postId: string;
  symbol: string;
  koreanName?: string | null;
}

export function DailyAccuracyTable({ postId, symbol, koreanName }: DailyAccuracyTableProps) {
  const [predictions, setPredictions] = useState<DailyPrediction[]>([]);
  const [loading, setLoading] = useState(true);

  // Determine display name and type
  // If koreanName exists -> Likely Stock (주식분석)
  // Else -> Likely Coin (코인분석)
  const displayName = koreanName || symbol;
  const analysisType = koreanName ? "주식분석" : "코인분석";

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getDailyPredictions(postId);
        setPredictions(data);
      } catch (error) {
        console.error("Failed to fetch daily predictions", error);
      } finally {
        setLoading(false);
      }
    }

    if (postId) {
      fetchData();
    }
  }, [postId]);

  if (loading) {
    return <div className="text-sm text-gray-500 animate-pulse">일별 정확도 로딩 중...</div>;
  }

  if (predictions.length === 0) {
    return null; // Don't show anything if no daily predictions exist
  }

  // Calculate average accuracy (Reach Rate)
  const calculatePredictions = predictions.filter(p => p.actual_close !== null && p.previous_close !== null);

  const processedPredictions = calculatePredictions.map(p => {
    const prev = p.previous_close || 0;
    const actual = p.actual_close || 0;
    const predicted = p.predicted_price || 0;

    const actualDiff = actual - prev;
    const predictedDiff = predicted - prev;

    const isSameDirection = (actualDiff > 0 && predictedDiff > 0) || (actualDiff < 0 && predictedDiff < 0);
    
    let reachRate = 0;
    let excessRate = 0;

    if (isSameDirection && predictedDiff !== 0) {
      const absActual = Math.abs(actualDiff);
      const absPredicted = Math.abs(predictedDiff);
      
      // 1. Reach Rate (Max 100%)
      reachRate = Math.min(absActual / absPredicted, 1) * 100;
      
      // 2. Excess Rate
      if (absActual > absPredicted) {
        excessRate = ((absActual - absPredicted) / absPredicted) * 100;
      }
    }

    return {
      ...p,
      reachRate,
      excessRate,
      status: !isSameDirection ? 'FAIL' : reachRate === 100 ? 'HIT' : 'PARTIAL' as 'FAIL' | 'HIT' | 'PARTIAL',
      actualDiff,
      predictedDiff
    };
  });

  const averageReachRate = processedPredictions.length > 0
    ? processedPredictions.reduce((sum, p) => sum + p.reachRate, 0) / processedPredictions.length
    : 0;

  return (
    <div className="mt-8 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          일별 예측 도달률
          <SimpleTooltip 
            title="일별 예측 도달률"
            content="예측 도달률은 전일 종가를 기준으로 예측한 상승폭 대비 실제 상승폭이 얼마나 충족되었는지를 나타냅니다. 100%는 예측 목표에 도달했음을 의미하며, 초과 상승은 별도로 표시됩니다."
          >
             <div className="cursor-help text-muted-foreground hover:text-foreground transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
             </div>
          </SimpleTooltip>

          {processedPredictions.length > 0 && (
            <span className="text-sm font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">
              평균 도달률: <span style={{ color: getReachRateColor(averageReachRate) }}>{averageReachRate.toFixed(1)}%</span>
            </span>
          )}
        </h3>
      </div>
      
      <div className="grid gap-2">
        <div className="border border-border/50 rounded-lg overflow-hidden bg-card/50 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground bg-muted/30">
                <th className="py-3 px-4 text-left font-medium">
                  날짜(종목명) {displayName} {analysisType}
                </th>
                <th className="py-3 px-4 text-right font-medium">전일종가</th>
                <th className="py-3 px-4 text-right font-medium">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs opacity-70">예측가</span>
                    <span className="text-xs opacity-70">금일종가</span>
                  </div>
                </th>
                <th className="py-3 px-4 text-right font-medium">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs opacity-70">도달률</span>
                    <span className="text-xs opacity-70">금액차</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 bg-card/30">
              {predictions.map((rawP) => {
                 const p = processedPredictions.find(pp => pp.id === rawP.id);
                 const hasData = !!p;
                 
                 const previousClose = rawP.previous_close || 0;
                 const predictedPrice = rawP.predicted_price || 0;
                 const actualPrice = rawP.actual_close;
                 
                 const change = actualPrice ? actualPrice - previousClose : 0;
                 const isRise = change > 0;
                 const isFall = change < 0;
                 
                 const colorClass = isRise ? "text-red-500" : isFall ? "text-blue-500" : "text-muted-foreground";
                 
                 return (
                  <tr key={rawP.id} className="hover:bg-muted/50 transition-colors group/row">
                    <td className="py-4 px-4 align-top text-muted-foreground font-medium whitespace-nowrap">
                      {rawP.prediction_date}
                    </td>
                    <td className="py-4 px-4 text-right align-top font-semibold text-foreground/90">
                      {previousClose.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-right align-top">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-foreground">
                            {predictedPrice.toLocaleString()}
                        </span>
                        <span className={`text-sm font-medium ${colorClass}`}>
                            {actualPrice ? actualPrice.toLocaleString() : '-'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right align-top">
                      <div className="flex flex-col items-end gap-1">
                        {/* Accuracy Section */}
                        {hasData ? (
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5">
                                {/* Status Badge */}
                                <StatusBadge status={p.status} reachRate={p.reachRate} />

                                {/* Reach Rate Text */}
                                <span className="font-bold whitespace-nowrap" style={{ color: getReachRateColor(p.reachRate) }}>
                                  {p.reachRate.toFixed(0)}%
                                </span>
                            </div>
                            
                            {/* Excess Rate */}
                            {p.excessRate > 0 && (
                                <SimpleTooltip 
                                  title="초과 달성" 
                                  content="실제 상승폭이 예측한 상승폭을 크게 초과했습니다. 초과율은 예측 대비 얼마나 더 상승했는지를 의미하며, 정확도 점수에는 포함되지 않습니다."
                                >
                                  <div className="flex items-center gap-0.5 cursor-help">
                                    <span className="text-[#0EA5E9] text-xs">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                                    </span>
                                    <span className="text-xs font-medium text-[#38BDF8]">
                                        초과 +{p.excessRate.toFixed(0)}%
                                    </span>
                                  </div>
                                </SimpleTooltip>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                        
                        {/* Diff */}
                        <span className={`text-sm font-medium ${colorClass} mt-0.5`}>
                             {actualPrice ? (
                                <>
                                  <span className="text-xs mr-0.5">{isRise ? '▲' : isFall ? '▼' : ''}</span>
                                  {Math.abs(change).toLocaleString()}원
                                </>
                             ) : (
                                <span className="text-xs text-muted-foreground">{rawP.calculated_at ? '계산중' : '대기중'}</span>
                             )}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mt-3 text-xs text-muted-foreground text-right space-y-1">
        <p>* 예측 도달률은 전일 종가 기준 예측 상승폭 대비 실제 상승폭의 비율입니다.</p>
        <p>* 도달률은 최대 100%로 제한되며, 예측 초과분은 별도로 표시됩니다.</p>
        <p>* 가격을 정확히 맞춘 정도가 아닌, 예측 목표 충족 여부를 평가합니다.</p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Helper Components & Functions
// ----------------------------------------------------------------------

function getReachRateColor(rate: number) {
    if (rate >= 100) return '#34D399';
    if (rate >= 70) return '#6EE7B7';
    if (rate >= 40) return '#FFD166';
    return '#FF6B6B'; // 0-39
}

function StatusBadge({ status, reachRate }: { status: 'FAIL' | 'PARTIAL' | 'HIT', reachRate: number }) {
    if (status === 'FAIL') {
        return (
            <SimpleTooltip title="실패" content="실제 가격이 전일 종가보다 상승하지 않아 예측 방향을 충족하지 못했습니다.">
                <span className="cursor-help inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border" 
                      style={{ backgroundColor: '#3A1E1E', color: '#FF6B6B', borderColor: '#5C2A2A' }}>
                    실패
                </span>
            </SimpleTooltip>
        );
    }
    if (status === 'PARTIAL') {
         return (
            <SimpleTooltip title="부분 도달" content={`예측한 상승폭의 일부만 충족했습니다. (도달률 ${reachRate.toFixed(0)}%)`}>
                <span className="cursor-help inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border" 
                      style={{ backgroundColor: '#3B3320', color: '#FFD166', borderColor: '#5E4B1F' }}>
                    부분
                </span>
            </SimpleTooltip>
        );
    }
    return (
        <SimpleTooltip title="목표 도달" content="예측한 상승폭에 도달하거나 이를 초과했습니다. 목표 도달률은 최대 100%로 표시됩니다.">
            <span className="cursor-help inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border" 
                  style={{ backgroundColor: '#1F3A2E', color: '#6EE7B7', borderColor: '#2F5D4B' }}>
                적중
            </span>
        </SimpleTooltip>
    );
}

function SimpleTooltip({ title, content, children }: { title: string, content: string, children: React.ReactNode }) {
  // Simple pure CSS tooltip implementation
  return (
    <div className="relative group/tooltip inline-block">
      {children}
      <div className="absolute z-50 bottom-full mb-2 right-1/2 translate-x-1/2 w-64 invisible opacity-0 group-hover/tooltip:visible group-hover/tooltip:opacity-100 transition-all duration-200 pointer-events-none">
         <div className="bg-popover border border-border rounded-lg shadow-xl p-3 text-left">
            <div className="font-bold text-popover-foreground text-xs mb-1">{title}</div>
            <div className="text-muted-foreground text-[10px] leading-relaxed break-keep">
                {content}
            </div>
         </div>
      </div>
    </div>
  );
}
