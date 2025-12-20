import { createClient } from "@/lib/supabase/client";

export interface PointTransaction {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  type: 'EARN' | 'USE' | 'ADMIN' | 'REFUND';
  created_at: string;
}

/**
 * Get current user point balance.
 * Assumes balance is calculated by summing transactions or stored in profiles.
 * For now, we will try to fetch from 'profiles.points' if it exists (common pattern),
 * fallback to summing transactions if not (or if preferred).
 * 
 * Given the user didn't specify a 'points' column in profiles, we'll implement a sum query 
 * on point_transactions for accuracy.
 */
export async function getUserPoints(userId: string): Promise<number> {
  const supabase = createClient();
  
  // Method 1: Sum transactions (Accurate but slower at scale)
  const { data, error } = await supabase
    .from('point_transactions')
    .select('amount')
    .eq('user_id', userId);

  if (error) {
    console.error("Error fetching points:", error);
    return 0;
  }

  // Calculate sum
  const balance = data.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  return balance;
}

/**
 * Fetch recent point history
 */
export async function getPointHistory(userId: string, limit = 20) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
      console.error("Error fetching point history:", error);
      return [];
  }
  
  return data as PointTransaction[];
}
