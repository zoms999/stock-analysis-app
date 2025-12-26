import { createClient } from "@/lib/supabase/client";

export interface Partner {
  id: string;
  email: string;
  nickname: string;
  is_partner: boolean;
  referral_code: string;
  user_level: number;
  created_at: string;
  total_referred_users?: number;
  total_earnings?: number;
}

export interface ReferredUser {
  id: string;
  email: string;
  nickname: string;
  created_at: string;
  user_level: number;
}

export interface Settlement {
  id: string;
  created_at: string;
  partner_id: string;
  partner_name: string;
  partner_email: string;
  source_user_id: string;
  source_user_name: string;
  payment_amount: number;
  commission_rate: number;
  settlement_amount: number;
  is_paid: boolean;
}

export interface PartnerStats {
  partner_id: string;
  nickname: string;
  email: string;
  invited_user_count: number;
  total_earnings: number;
}

/**
 * Get all partners with basic stats
 */
export async function getAllPartners(): Promise<Partner[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_partner', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch partners:', error);
    throw error;
  }

  // Enrich with stats
  const partnersWithStats = await Promise.all(
    (data || []).map(async (partner) => {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('referred_by', partner.id);

      const { data: settlements } = await supabase
        .from('partner_settlements')
        .select('settlement_amount')
        .eq('partner_id', partner.id);

      const totalEarnings = settlements?.reduce((sum, s) => sum + s.settlement_amount, 0) || 0;

      return {
        ...partner,
        total_referred_users: count || 0,
        total_earnings: totalEarnings,
      };
    })
  );

  return partnersWithStats;
}

/**
 * Toggle partner status
 */
export async function togglePartnerStatus(userId: string, isPartner: boolean): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ is_partner: isPartner })
    .eq('id', userId);

  if (error) {
    console.error('Failed to toggle partner status:', error);
    throw error;
  }
}

/**
 * Get all users referred by a specific partner
 */
export async function getReferredUsers(partnerId: string): Promise<ReferredUser[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, nickname, created_at, user_level')
    .eq('referred_by', partnerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch referred users:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get pending settlements (unpaid)
 */
export async function getPendingSettlements(): Promise<Settlement[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('partner_settlements')
    .select(`
      id,
      created_at,
      partner_id,
      source_user_id,
      payment_amount,
      commission_rate,
      settlement_amount,
      is_paid,
      partner:profiles!partner_id(nickname, email),
      source_user:profiles!source_user_id(nickname)
    `)
    .eq('is_paid', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch pending settlements:', error);
    throw error;
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    created_at: item.created_at,
    partner_id: item.partner_id,
    partner_name: item.partner?.nickname || 'Unknown',
    partner_email: item.partner?.email || '',
    source_user_id: item.source_user_id,
    source_user_name: item.source_user?.nickname || 'Unknown',
    payment_amount: item.payment_amount,
    commission_rate: item.commission_rate,
    settlement_amount: item.settlement_amount,
    is_paid: item.is_paid,
  }));
}

/**
 * Get all settlements for a specific partner
 */
export async function getPartnerSettlements(partnerId: string): Promise<Settlement[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('partner_settlements')
    .select(`
      id,
      created_at,
      partner_id,
      source_user_id,
      payment_amount,
      commission_rate,
      settlement_amount,
      is_paid,
      partner:profiles!partner_id(nickname, email),
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
    partner_id: item.partner_id,
    partner_name: item.partner?.nickname || 'Unknown',
    partner_email: item.partner?.email || '',
    source_user_id: item.source_user_id,
    source_user_name: item.source_user?.nickname || 'Unknown',
    payment_amount: item.payment_amount,
    commission_rate: item.commission_rate,
    settlement_amount: item.settlement_amount,
    is_paid: item.is_paid,
  }));
}

/**
 * Mark settlement as paid
 */
export async function markSettlementPaid(settlementId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('partner_settlements')
    .update({ 
      is_paid: true
    })
    .eq('id', settlementId);

  if (error) {
    console.error('Failed to mark settlement as paid:', error);
    throw error;
  }
}

/**
 * Get partner performance statistics
 */
export async function getPartnerStatistics(): Promise<PartnerStats[]> {
  const supabase = createClient();

  // Get all partners
  const { data: partners, error: partnersError } = await supabase
    .from('profiles')
    .select('id, nickname, email')
    .eq('is_partner', true);

  if (partnersError) {
    console.error('Failed to fetch partners for stats:', partnersError);
    throw partnersError;
  }

  // Calculate stats for each partner
  const stats = await Promise.all(
    (partners || []).map(async (partner) => {
      // Count referred users
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('referred_by', partner.id);

      // Sum earnings
      const { data: settlements } = await supabase
        .from('partner_settlements')
        .select('settlement_amount')
        .eq('partner_id', partner.id);

      const totalEarnings = settlements?.reduce((sum, s) => sum + s.settlement_amount, 0) || 0;

      return {
        partner_id: partner.id,
        nickname: partner.nickname || 'Unknown',
        email: partner.email || '',
        invited_user_count: count || 0,
        total_earnings: totalEarnings,
      };
    })
  );

  // Sort by total earnings descending
  return stats.sort((a, b) => b.total_earnings - a.total_earnings);
}
