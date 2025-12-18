import { createClient } from "@/lib/supabase/client";

export type PredictionType = "LONG" | "SHORT";
export type PredictionStatus = "WAITING" | "SUCCESS" | "FAIL" | "TIMEOUT";

export interface PredictionData {
  predictionType: PredictionType;
  entryPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  targetDate: Date;
}

export interface AccuracyResult {
  status: PredictionStatus;
  profitPercentage: number;
  isSuccess: boolean;
}

/**
 * Calculate profit percentage based on prediction type
 */
export function calculateProfitPercentage(
  entryPrice: number,
  currentPrice: number,
  predictionType: PredictionType
): number {
  if (predictionType === "LONG") {
    return ((currentPrice - entryPrice) / entryPrice) * 100;
  } else {
    // SHORT
    return ((entryPrice - currentPrice) / entryPrice) * 100;
  }
}

/**
 * Determine prediction status based on current price
 */
export function calculatePredictionStatus(
  entryPrice: number,
  targetPrice: number,
  stopLossPrice: number,
  currentPrice: number,
  predictionType: PredictionType,
  targetDate: Date
): PredictionStatus {
  const now = new Date();
  const isExpired = now > targetDate;

  if (predictionType === "LONG") {
    // Success: price reached target
    if (currentPrice >= targetPrice) {
      return "SUCCESS";
    }
    // Fail: price hit stop loss
    if (currentPrice <= stopLossPrice) {
      return "FAIL";
    }
    // Timeout: expired without hitting target or stop loss
    if (isExpired) {
      return "TIMEOUT";
    }
    // Still waiting
    return "WAITING";
  } else {
    // SHORT
    // Success: price fell to target
    if (currentPrice <= targetPrice) {
      return "SUCCESS";
    }
    // Fail: price rose to stop loss
    if (currentPrice >= stopLossPrice) {
      return "FAIL";
    }
    // Timeout: expired without hitting target or stop loss
    if (isExpired) {
      return "TIMEOUT";
    }
    // Still waiting
    return "WAITING";
  }
}

/**
 * Calculate accuracy for a single prediction
 */
export function calculateAccuracy(
  prediction: PredictionData,
  currentPrice: number
): AccuracyResult {
  const status = calculatePredictionStatus(
    prediction.entryPrice,
    prediction.targetPrice,
    prediction.stopLossPrice,
    currentPrice,
    prediction.predictionType,
    prediction.targetDate
  );

  const profitPercentage = calculateProfitPercentage(
    prediction.entryPrice,
    currentPrice,
    prediction.predictionType
  );

  return {
    status,
    profitPercentage,
    isSuccess: status === "SUCCESS",
  };
}

/**
 * Validate prediction data
 */
export function validatePrediction(
  prediction: PredictionData
): { valid: boolean; error?: string } {
  const { predictionType, entryPrice, targetPrice, stopLossPrice } = prediction;

  if (predictionType === "LONG") {
    if (targetPrice <= entryPrice) {
      return {
        valid: false,
        error: "LONG 예측: 목표가는 진입가보다 높아야 합니다.",
      };
    }
    if (stopLossPrice >= entryPrice) {
      return {
        valid: false,
        error: "LONG 예측: 손절가는 진입가보다 낮아야 합니다.",
      };
    }
  } else {
    // SHORT
    if (targetPrice >= entryPrice) {
      return {
        valid: false,
        error: "SHORT 예측: 목표가는 진입가보다 낮아야 합니다.",
      };
    }
    if (stopLossPrice <= entryPrice) {
      return {
        valid: false,
        error: "SHORT 예측: 손절가는 진입가보다 높아야 합니다.",
      };
    }
  }

  return { valid: true };
}

/**
 * Calculate overall accuracy statistics for multiple posts
 */
export interface AccuracyStats {
  totalPredictions: number;
  successCount: number;
  failCount: number;
  waitingCount: number;
  timeoutCount: number;
  successRate: number;
  averageProfit: number;
}

export function calculateAccuracyStats(
  results: AccuracyResult[]
): AccuracyStats {
  const total = results.length;
  const successCount = results.filter((r) => r.status === "SUCCESS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  const waitingCount = results.filter((r) => r.status === "WAITING").length;
  const timeoutCount = results.filter((r) => r.status === "TIMEOUT").length;

  const successRate = total > 0 ? (successCount / total) * 100 : 0;
  const averageProfit =
    total > 0
      ? results.reduce((sum, r) => sum + r.profitPercentage, 0) / total
      : 0;

  return {
    totalPredictions: total,
    successCount,
    failCount,
    waitingCount,
    timeoutCount,
    successRate,
    averageProfit,
  };
}
