import { createClient } from "@/lib/supabase/client";

export interface DailyPrediction {
  id: string;
  post_id: string;
  prediction_date: string;
  predicted_price: number;
  previous_close: number | null;
  actual_close: number | null;
  daily_accuracy: number | null;
  calculated_at: string | null;
  created_at: string;
}

export interface DailyPredictionInput {
  date: string;
  price: number;
  previous_close?: number; // Optional manual override
}

/**
 * Save daily predictions for a post
 */
export async function saveDailyPredictions(
  postId: string,
  predictions: DailyPredictionInput[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // Format predictions for insertion
  const records = predictions.map((p) => ({
    post_id: postId,
    prediction_date: p.date,
    predicted_price: p.price,
    previous_close: p.previous_close || null, // Insert if provided
  }));

  const { error } = await supabase
    .from("daily_predictions")
    .insert(records);

  if (error) {
    console.error("Error saving daily predictions:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get daily predictions for a post
 */
export async function getDailyPredictions(
  postId: string
): Promise<DailyPrediction[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("daily_predictions")
    .select("*")
    .eq("post_id", postId)
    .order("prediction_date", { ascending: true });

  if (error) {
    console.error("Error fetching daily predictions:", error);
    return [];
  }

  return data || [];
}

/**
 * Delete all daily predictions for a post
 */
export async function deleteDailyPredictions(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from("daily_predictions")
    .delete()
    .eq("post_id", postId);

  if (error) {
    console.error("Error deleting daily predictions:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Trigger calculation of daily accuracies
 * This is typically called by the cron job
 */
export async function calculateDailyAccuracies(): Promise<{
  success: boolean;
  processed?: number;
  updated_posts?: number;
  error?: string;
}> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("calculate_daily_accuracies_v5");

  if (error) {
    console.error("Error calculating daily accuracies:", error);
    return { success: false, error: error.message };
  }

  // The function returns a single row with processed_count and updated_posts
  const result = Array.isArray(data) ? data[0] : data;

  return {
    success: true,
    processed: result?.processed_count || 0,
    updated_posts: result?.updated_posts || 0,
  };
}
