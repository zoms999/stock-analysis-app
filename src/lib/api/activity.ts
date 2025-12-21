import { createClient } from "@/lib/supabase/client";

export interface ActivityItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'earn' | 'spend';
}

/**
 * 사용자의 최근 활동 내역 조회 (포인트 거래 내역)
 */
export async function getUserActivity(userId: string, limit: number = 10): Promise<ActivityItem[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error('Failed to fetch activity:', error);
    return [];
  }

  return data.map(transaction => ({
    id: transaction.id.toString(),
    date: new Date(transaction.created_at).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\. /g, '.').replace(/\.$/, ''),
    description: transaction.description || getDescriptionFromType(transaction.transaction_type),
    amount: transaction.amount,
    type: transaction.amount > 0 ? 'earn' : 'spend',
  }));
}

function getDescriptionFromType(type: string): string {
  const typeMap: Record<string, string> = {
    'EARN': '포인트 획득',
    'USE': '포인트 사용',
    'PURCHASE': '포인트 구매',
    'REWARD': '보상',
    'REFERRAL': '친구 초대',
  };
  return typeMap[type] || '포인트 거래';
}
