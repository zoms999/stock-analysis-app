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

export interface WithdrawRequest {
  id: string;
  user_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  created_at: string;
  processed_at?: string;
  user?: { // Joined profile
      nickname: string;
      email: string;
  };
}

/**
 * Request a point withdrawal
 */
export async function requestWithdrawal(userId: string, amount: number, bankInfo: { bankName: string, accountNumber: string, accountHolder: string }) {
  const supabase = createClient();
  
  // 1. Check Balance
  const currentPoints = await getUserPoints(userId);
  if (currentPoints < amount) {
      throw new Error("Insufficient points");
  }

  // 2. Create Withdrawal Request
  const { data: request, error: reqError } = await supabase
      .from('withdraw_requests')
      .insert({
          user_id: userId,
          amount: amount,
          bank_name: bankInfo.bankName,
          account_number: bankInfo.accountNumber,
          account_holder: bankInfo.accountHolder,
          status: 'PENDING'
      })
      .select()
      .single();

  if (reqError) throw reqError;

  // 3. Deduct Points immediately (Lock funds)
  const { error: txError } = await supabase
      .from('point_transactions')
      .insert({
          user_id: userId,
          amount: -amount,
          reason: `Withdrawal Request #${request.id.slice(0, 8)}`,
          type: 'WITHDRAW' // Ensure 'WITHDRAW' is added to SQL enum or handled as text
      });

  if (txError) {
      // Rollback request if tx failed (Manual rollback since no transaction)
      await supabase.from('withdraw_requests').delete().eq('id', request.id);
      throw txError;
  }

  return request;
}

/**
 * Get all withdrawal requests (Admin)
 */
export async function getWithdrawalRequests(status?: string) {
    const supabase = createClient();
    
    let query = supabase
        .from('withdraw_requests')
        .select('*, profiles:user_id(nickname, email)') // Join profiles
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Map profiles to user property
    return data.map((item: any) => ({
        ...item,
        user: item.profiles
    })) as WithdrawRequest[];
}

/**
 * Process a withdrawal request (Admin)
 */
export async function processWithdrawalRequest(requestId: string, action: 'APPROVE' | 'REJECT', adminId: string) {
    const supabase = createClient();

    // Fetch request first to get amount and userId
    const { data: request } = await supabase
        .from('withdraw_requests')
        .select('*')
        .eq('id', requestId)
        .single();
    
    if (!request) throw new Error("Request not found");
    if (request.status !== 'PENDING') throw new Error("Request is not pending");

    const now = new Date().toISOString();

    if (action === 'APPROVE') {
        // Update status to COMPLETED
        const { error } = await supabase
            .from('withdraw_requests')
            .update({ status: 'COMPLETED', processed_at: now })
            .eq('id', requestId);
        if (error) throw error;
    } else {
        // REJECT
        // 1. Update status
        const { error: updateError } = await supabase
            .from('withdraw_requests')
            .update({ status: 'REJECTED', processed_at: now })
            .eq('id', requestId);
        if (updateError) throw updateError;

        // 2. Refund Points
        const { error: refundError } = await supabase
            .from('point_transactions')
            .insert({
                user_id: request.user_id,
                amount: request.amount, // Positive amount to refund
                reason: `Withdrawal Rejected #${request.id.slice(0, 8)}`,
                type: 'REFUND'
            });
        if (refundError) throw refundError;
    }
}
