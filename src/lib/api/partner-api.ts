import { createClient } from "@/lib/supabase/client";

export interface PartnerStats {
  partner_id: string;
  nickname: string;
  email: string;
  referral_code: string;
  total_referred_users: number;
  total_earnings: number;
  paid_earnings: number;
  pending_earnings: number;
}

export interface PartnerSettlement {
  id: string;
  created_at: string;
  source_user_name: string;
  payment_amount: number;
  commission_rate: number;
  settlement_amount: number;
  is_paid: boolean;
  paid_at?: string;
}

/**
 * Get partner statistics and earnings summary
 */
export async function getPartnerStats(partnerId: string): Promise<PartnerStats | null> {
  const supabase = createClient();

  // Get partner profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, nickname, email, referral_code, is_partner')
    .eq('id', partnerId)
    .single();

  if (profileError || !profile?.is_partner) {
    console.error('Failed to fetch partner profile:', profileError);
    return null;
  }

  // Count referred users
  const { count: referredCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('referred_by', partnerId);

  // Get all settlements
  const { data: settlements } = await supabase
    .from('partner_settlements')
    .select('settlement_amount, is_paid')
    .eq('partner_id', partnerId);

  const totalEarnings = settlements?.reduce((sum, s) => sum + s.settlement_amount, 0) || 0;
  const paidEarnings = settlements?.filter(s => s.is_paid).reduce((sum, s) => sum + s.settlement_amount, 0) || 0;
  const pendingEarnings = totalEarnings - paidEarnings;

  return {
    partner_id: profile.id,
    nickname: profile.nickname || 'Unknown',
    email: profile.email || '',
    referral_code: profile.referral_code || '',
    total_referred_users: referredCount || 0,
    total_earnings: totalEarnings,
    paid_earnings: paidEarnings,
    pending_earnings: pendingEarnings,
  };
}

/**
 * Get partner settlement history
 */
export async function getPartnerSettlementHistory(partnerId: string): Promise<PartnerSettlement[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('partner_settlements')
    .select(`
      id,
      created_at,
      payment_amount,
      commission_rate,
      settlement_amount,
      is_paid,
      source_user:profiles!source_user_id(nickname)
    `)
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch partner settlements:', error);
    throw error;
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    created_at: item.created_at,
    source_user_name: item.source_user?.nickname || 'Unknown',
    payment_amount: item.payment_amount,
    commission_rate: item.commission_rate,
    settlement_amount: item.settlement_amount,
    is_paid: item.is_paid,
  }));
}

/**
 * Request a settlement (creates a pending settlement request)
 * Note: This is a simplified version. In production, you might want to:
 * 1. Create a separate settlement_requests table
 * 2. Add bank account validation
 * 3. Implement approval workflow
 */
export async function requestSettlement(
  partnerId: string,
  requestedAmount: number,
  bankAccountInfo?: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createClient();

  // Validate partner status
  const stats = await getPartnerStats(partnerId);
  if (!stats) {
    return { success: false, message: '파트너 정보를 찾을 수 없습니다.' };
  }

  // Check if requested amount is valid
  if (requestedAmount <= 0) {
    return { success: false, message: '요청 금액은 0보다 커야 합니다.' };
  }

  if (requestedAmount > stats.pending_earnings) {
    return { success: false, message: '요청 금액이 정산 가능 금액을 초과합니다.' };
  }

  // Minimum settlement amount (10,000원)
  const MIN_SETTLEMENT = 10000;
  if (requestedAmount < MIN_SETTLEMENT) {
    return { success: false, message: `최소 정산 금액은 ${MIN_SETTLEMENT.toLocaleString()}원입니다.` };
  }

  // For now, we'll just return success
  // In a real implementation, you would:
  // 1. Create a settlement request record
  // 2. Notify admins
  // 3. Store bank account info securely
  
  // TODO: Implement actual settlement request creation
  // This would typically involve creating a record in a settlement_requests table
  // or adding metadata to existing settlements to mark them as "requested"

  return { 
    success: true, 
    message: '정산 요청이 접수되었습니다. 관리자 승인 후 처리됩니다.' 
  };
}

/**
 * Get recent settlements (last N items)
 */
export async function getRecentSettlements(partnerId: string, limit: number = 5): Promise<PartnerSettlement[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('partner_settlements')
    .select(`
      id,
      created_at,
      payment_amount,
      commission_rate,
      settlement_amount,
      is_paid,
      source_user:profiles!source_user_id(nickname)
    `)
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch recent settlements:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    created_at: item.created_at,
    source_user_name: item.source_user?.nickname || 'Unknown',
    payment_amount: item.payment_amount,
    commission_rate: item.commission_rate,
    settlement_amount: item.settlement_amount,
    is_paid: item.is_paid,
  }));
}
