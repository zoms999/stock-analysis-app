import { createClient } from "@/lib/supabase/client";


// Re-export types if needed
export interface Plan { /* ... tied to DB now ... */ }

export interface UserSubscription {
  id: string;
  planName: string;
  planPrice: number;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  dailyViewLimit: number;
  dailyWriteLimit: number;
  accessMaxLevel: number;
  userLevel: number; // Added for checkCanViewPost
}

export interface TodayUsage {
  viewCount: number;
  writeCount: number;
  additionalViewCount: number;
  additionalWriteCount: number;
  viewLimit: number;
  writeLimit: number;
}

/**
 * 현재 사용자의 구독 정보 조회 (RPC/View 대체)
 * Free Tier 처리를 포함하여 항상 유효한 값을 반환하도록 보장
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      id,
      status,
      current_period_start,
      current_period_end,
      plan_id,
      plans!inner (
        name,
        price,
        daily_view_limit,
        daily_write_limit,
        access_max_level
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 사용자 레벨 조회 (Profiles)
  const { data: profile } = await supabase
      .from('profiles')
      .select('level')
      .eq('id', userId)
      .single();
  
  const userLevel = profile?.level || 1; // Default to level 1

  if (!data) {
    // 구독이 없으면 Free 플랜 반환
    return {
      id: '',
      planName: 'Free',
      planPrice: 0,
      status: 'active',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date().toISOString(),
      dailyViewLimit: 3,
      dailyWriteLimit: 5,
      accessMaxLevel: 5,
      userLevel,
    };
  }

  const plan = data.plans as any;
  
  return {
    id: data.id,
    planName: plan.name,
    planPrice: plan.price,
    status: data.status,
    currentPeriodStart: data.current_period_start,
    currentPeriodEnd: data.current_period_end,
    dailyViewLimit: plan.daily_view_limit,
    dailyWriteLimit: plan.daily_write_limit,
    accessMaxLevel: plan.access_max_level,
    userLevel,
  };
}

/**
 * 오늘 사용량 조회
 */
export async function getTodayUsage(userId: string): Promise<TodayUsage> {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('daily_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('usage_date', today)
    .single();

  // 사용 기록이 없으면 0으로 초기화된 객체 (Limits는 Subscription에서 가져와야 함)
  const currentUsage = data || {
      view_count: 0,
      write_count: 0,
      additional_view_count: 0,
      additional_write_count: 0
  };

  // 구독 정보에서 한도 가져오기
  const subscription = await getUserSubscription(userId);
  
  return {
    viewCount: currentUsage.view_count || 0,
    writeCount: currentUsage.write_count || 0,
    additionalViewCount: currentUsage.additional_view_count || 0,
    additionalWriteCount: currentUsage.additional_write_count || 0,
    viewLimit: subscription.dailyViewLimit,
    writeLimit: subscription.dailyWriteLimit,
  };
}

/**
 * Consumes a view count for the user.
 * Checks Access Level AND View Limit atomically via RPC.
 * Returns 'OK' if allowed, throws error otherwise.
 */
export async function consumeView(userId: string, requiredLevel: number, postId?: string) {
  const supabase = createClient();
  
  const { data: status, error } = await supabase.rpc('consume_view', {
    p_user_id: userId,
    p_required_level: requiredLevel,
    p_post_id: postId || null
  });

  if (error) {
    console.error("RPC consume_view failed:", error);
    // Fail safe: block or allow? detailed error?
    throw new Error("서버 오류로 열람을 처리할 수 없습니다.");
  }

  if (status === 'LEVEL_LOW') {
     throw new Error(`이 글을 읽으려면 레벨 ${requiredLevel} 이상이 필요합니다.`);
  }

  if (status === 'LIMIT_REACHED') {
      // Throw a specific error object or string that UI can catch to show Popup
      const e = new Error("일일 열람 한도를 초과했습니다.");
      (e as any).code = "LIMIT_REACHED";
      throw e;
  }

  return true;
}

/**
 * Consumes a write count for the user.
 */
export async function consumeWrite(userId: string) {
  const supabase = createClient();

  const { data: status, error } = await supabase.rpc('consume_write', {
    p_user_id: userId
  });

  if (error) {
      console.error("RPC consume_write failed:", error);
      throw new Error("서버 오류로 글쓰기를 처리할 수 없습니다.");
  }

  if (status === 'LIMIT_REACHED') {
      const e = new Error("일일 글쓰기 한도를 초과했습니다.");
      (e as any).code = "LIMIT_REACHED";
      throw e;
  }

  return true;
}

/**
 * Purchase additional view with points
 */
export async function purchaseAdditionalView(userId: string) {
    const supabase = createClient();
    const POINTS_COST = 100;

    const { data: status, error } = await supabase.rpc('purchase_additional_view', {
        p_user_id: userId,
        p_points: POINTS_COST
    });

    if (error || status !== 'OK') {
        throw new Error("포인트 구매 처리에 실패했습니다. 잔액을 확인해주세요.");
    }
    return true;
}

/**
 * Purchase additional write with points
 */
export async function purchaseAdditionalWrite(userId: string) {
    const supabase = createClient();
    const POINTS_COST = 200;

    const { data: status, error } = await supabase.rpc('purchase_additional_write', {
        p_user_id: userId,
        p_points: POINTS_COST
    });

    if (error || status !== 'OK') {
        throw new Error("포인트 구매 처리에 실패했습니다. 잔액을 확인해주세요.");
    }
    return true;
}

