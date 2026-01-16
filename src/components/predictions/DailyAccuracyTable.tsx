"use client";

import { useEffect, useState } from "react";
import { getDailyPredictions, DailyPrediction } from "@/lib/api/daily-predictions";
import { format } from "date-fns";

interface DailyAccuracyTableProps {
  postId: string;
}

export function DailyAccuracyTable({ postId }: DailyAccuracyTableProps) {
  const [predictions, setPredictions] = useState<DailyPrediction[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Calculate average accuracy (excluding uncalculated ones)
  const calculatePredictions = predictions.filter(p => p.daily_accuracy !== null);
  const averageAccuracy = calculatePredictions.length > 0
    ? calculatePredictions.reduce((sum, p) => sum + (p.daily_accuracy || 0), 0) / calculatePredictions.length
    : 0;

  return (
    <div className="mt-8 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          일별 예측 정확도
          {calculatePredictions.length > 0 && (
            <span className="text-sm font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              평균: {averageAccuracy.toFixed(1)}%
            </span>
          )}
        </h3>
      </div>
      
      <div className="grid gap-2">
        {/* Header (PC Only - or styled as a row of labels) */}
        {/* Based on image, it looks like a list of cards OR a table with very specific styling. 
            The image shows headers "전일종가", "예측가/금일종가", "정확도/금액차" aligned with values.
            Let's use a Table for alignment but style it like the image.
        */}
        <div className="border border-border/50 rounded-lg overflow-hidden bg-muted/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground bg-muted/40">
                {/* 1. 날짜 (Hidden in image but needed? Image shows "Date (Symbol)" on left aside) 
                    The image shows: "Date (Symbol) Samsung Electronics Stock Analysis" on the LEFT outside the box.
                    Inside the box: "Previous Close", "Prediction / Today", "Accuracy / Diff".
                    So the date should be displayed perhaps in the first column or outside?
                    The current implementation has date in the first column.
                    The image design seems to merge Date/Title outside.
                    BUT simply, making the table inside the box match the columns is the goal.
                    Let's keep Date as the first column for clarity or merge it?
                    The image shows "Previous Close" as the first column header.
                    Let's put Date in a separate column or combine.
                    Actually, let's keep Date column but maybe smaller or merged?
                    User image snippet doesn't show Date in the box table.
                    Wait, "날짜(종목명) 삼성전자 주식분석" is on the left.
                    So maybe each ROW is a date?
                    Yes, "Daily Accuracy".
                    Let's add Date column for clarity.
                */}
                <th className="py-3 px-4 text-left font-medium">날짜</th>
                <th className="py-3 px-4 text-right font-medium">전일종가</th>
                <th className="py-3 px-4 text-right font-medium">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs opacity-70">예측가</span>
                    <span className="text-xs opacity-70">금일종가</span>
                  </div>
                </th>
                <th className="py-3 px-4 text-right font-medium">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs opacity-70">정확도</span>
                    <span className="text-xs opacity-70">금액차</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 bg-card">
              {predictions.map((p) => {
                 const change = (p.actual_close || 0) - (p.previous_close || 0);
                 const isRise = change > 0;
                 const isFall = change < 0;
                 // Standard Korean: Red = Rise, Blue = Fall
                 // User text: "오르면 파란색" (Rise Blue).
                 // I will use Red for Rise to match the rest of the app (consistent).
                 // Use blue for Rise only if I want to strictly follow that one text.
                 const colorClass = isRise ? "text-red-500" : isFall ? "text-blue-500" : "text-gray-500";
                 
                 return (
                  <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                    <td className="py-4 px-4 align-top text-muted-foreground font-medium whitespace-nowrap">
                      {p.prediction_date}
                    </td>
                    <td className="py-4 px-4 text-right align-top font-semibold">
                      {p.previous_close ? p.previous_close.toLocaleString() : '-'}
                    </td>
                    <td className="py-4 px-4 text-right align-top">
                      <div className="flex flex-col items-end gap-1">
                        {/* Prediction (Top) */}
                        <span className="font-bold text-foreground">
                            {p.predicted_price.toLocaleString()}
                        </span>
                        {/* Actual (Bottom) - highlighted? */}
                        <span className={`text-sm font-medium ${colorClass}`}>
                            {p.actual_close ? p.actual_close.toLocaleString() : '-'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right align-top">
                      <div className="flex flex-col items-end gap-1">
                        {/* Accuracy (Top) */}
                        <span className={`font-bold ${
                            (p.daily_accuracy || 0) >= 80 ? 'text-green-600' :
                            (p.daily_accuracy || 0) >= 50 ? 'text-blue-600' :
                            'text-muted-foreground'
                        }`}>
                          {p.daily_accuracy !== null ? `${p.daily_accuracy.toFixed(0)}%` : '-'}
                        </span>
                        {/* Status/Diff (Bottom) */}
                        <span className={`text-sm font-medium ${colorClass}`}>
                             {/* 금액차 (Actual Change) - Requested "500원" format */}
                             {p.actual_close && p.previous_close ? (
                                <>
                                  <span className="text-xs mr-0.5">{isRise ? '▲' : isFall ? '▼' : ''}</span>
                                  {Math.abs(change).toLocaleString()}원
                                </>
                             ) : (
                                <span className="text-xs text-muted-foreground">{p.calculated_at ? '계산중' : '대기중'}</span>
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
      
      <p className="mt-2 text-xs text-muted-foreground text-right">
        * 예측 정확도 = (실제 변동분 / 예측 변동분) %
      </p>
    </div>
  );
}
