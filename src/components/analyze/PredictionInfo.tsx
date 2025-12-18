"use client";

import { PredictionType, PredictionStatus } from "@/lib/api/posts";
import { TrendingUp, TrendingDown, Clock, Target, Shield, Calendar } from "lucide-react";

interface PredictionInfoProps {
  predictionType: PredictionType;
  entryPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  targetDate: string;
  currentPrice?: number;
  profitPercentage?: number;
  status?: PredictionStatus;
}

export function PredictionInfo({
  predictionType,
  entryPrice,
  targetPrice,
  stopLossPrice,
  targetDate,
  currentPrice,
  profitPercentage,
  status = "WAITING",
}: PredictionInfoProps) {
  const isLong = predictionType === "LONG";
  const isSuccess = status === "SUCCESS";
  const isFail = status === "FAIL";
  const isWaiting = status === "WAITING";

  const statusColors = {
    SUCCESS: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    FAIL: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    WAITING: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    TIMEOUT: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
  };

  const statusLabels = {
    SUCCESS: "목표 달성",
    FAIL: "손절",
    WAITING: "진행 중",
    TIMEOUT: "기간 만료",
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isLong ? "bg-red-500/10" : "bg-blue-500/10"}`}>
            {isLong ? (
              <TrendingUp className="h-5 w-5 text-red-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-blue-500" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold">
              {isLong ? "LONG (매수)" : "SHORT (매도)"} 예측
            </h3>
            <p className="text-sm text-muted-foreground">
              {isLong ? "가격 상승 예측" : "가격 하락 예측"}
            </p>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg border ${statusColors[status]} font-medium text-sm`}>
          {statusLabels[status]}
        </div>
      </div>

      {/* Price Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Target className="h-3.5 w-3.5" />
            진입가
          </div>
          <div className="text-lg font-bold">
            {entryPrice.toLocaleString("ko-KR")}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <TrendingUp className="h-3.5 w-3.5" />
            목표가
          </div>
          <div className="text-lg font-bold text-green-600 dark:text-green-400">
            {targetPrice.toLocaleString("ko-KR")}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
            <Shield className="h-3.5 w-3.5" />
            손절가
          </div>
          <div className="text-lg font-bold text-red-600 dark:text-red-400">
            {stopLossPrice.toLocaleString("ko-KR")}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            목표일
          </div>
          <div className="text-sm font-medium">
            {new Date(targetDate).toLocaleDateString("ko-KR", {
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* Current Status */}
      {currentPrice !== undefined && profitPercentage !== undefined && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">현재가</div>
              <div className="text-2xl font-bold">
                {currentPrice.toLocaleString("ko-KR")}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">수익률</div>
              <div
                className={`text-2xl font-bold ${
                  profitPercentage >= 0
                    ? "text-red-500"
                    : "text-blue-500"
                }`}
              >
                {profitPercentage >= 0 ? "+" : ""}
                {profitPercentage.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
