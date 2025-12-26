import { createClient } from "@/lib/supabase/client";
import { getUserSubscription, getTodayUsage, getUserProfile, UserSubscription, TodayUsage, UserProfile } from "@/lib/api/subscription";

export interface PartnerDashboard {
  partner_id: string;
  nickname: string;
  is_partner: boolean;
  referral_code: string;
  referral_url: string;
  total_referred_users: number;
  total_settled_amount: number;
  pending_settlement_amount: number;
}

export async function getPartnerDashboard(userId: string): Promise<PartnerDashboard | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('view_partner_dashboard')
    .select('*')
    .eq('partner_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // 파트너가 아닌 경우
      return null;
    }
    console.error('Failed to fetch partner dashboard:', error);
    return null;
  }

  return data;
}

export type { UserSubscription, TodayUsage, UserProfile };
export { getUserSubscription, getTodayUsage, getUserProfile };

