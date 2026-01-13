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
    <div className="mt-6 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          일별 예측 정확도
        </h3>
        {calculatePredictions.length > 0 && (
            <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded-full">
                <span className="text-sm font-bold text-blue-800 dark:text-blue-100">
                    평균 정확도: {averageAccuracy.toFixed(1)}%
                </span>
            </div>
        )}
      </div>
      
      <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase tracking-wider dark:text-gray-400">
                날짜
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-right text-gray-500 uppercase tracking-wider dark:text-gray-400">
                예측가
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-right text-gray-500 uppercase tracking-wider dark:text-gray-400">
                전일 종가
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-right text-gray-500 uppercase tracking-wider dark:text-gray-400">
                실제 종가
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-right text-gray-500 uppercase tracking-wider dark:text-gray-400">
                일별 정확도
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-center text-gray-500 uppercase tracking-wider dark:text-gray-400">
                상태
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 dark:divide-gray-700 dark:bg-gray-900">
            {predictions.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {p.prediction_date}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  <div className="flex flex-col items-end">
                    <span className="font-medium">{p.predicted_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    {p.previous_close && (
                      <span className={`text-xs ${p.predicted_price - p.previous_close > 0 ? 'text-red-500' : p.predicted_price - p.previous_close < 0 ? 'text-blue-500' : 'text-gray-500'}`}>
                        ({p.predicted_price - p.previous_close > 0 ? '+' : ''}{(p.predicted_price - p.previous_close).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {p.previous_close ? p.previous_close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  <div className="flex flex-col items-end">
                    <span>{p.actual_close ? p.actual_close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</span>
                    {p.actual_close && p.previous_close && (
                      <span className={`text-xs ${p.actual_close - p.previous_close > 0 ? 'text-red-500' : p.actual_close - p.previous_close < 0 ? 'text-blue-500' : 'text-gray-500'}`}>
                         ({p.actual_close - p.previous_close > 0 ? '+' : ''}{(p.actual_close - p.previous_close).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-right whitespace-nowrap font-bold">
                  {p.daily_accuracy !== null ? (
                    <span className={
                        p.daily_accuracy >= 80 ? 'text-green-600 dark:text-green-400' : 
                        p.daily_accuracy >= 50 ? 'text-blue-600 dark:text-blue-400' : 
                        p.daily_accuracy >= 0 ? 'text-gray-600 dark:text-gray-400' :
                        'text-red-500 dark:text-red-400' // Negative accuracy
                    }>
                        {p.daily_accuracy.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-center whitespace-nowrap">
                  {p.calculated_at ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      계산완료
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                      대기중
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
        * 일별 정확도 = (실제 움직임 / 예측 움직임) × 100 (전일 종가 기준)
      </p>
    </div>
  );
}
