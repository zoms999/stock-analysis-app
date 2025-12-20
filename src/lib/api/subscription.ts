import { createClient } from "@/lib/supabase/client";

export interface Plan {
  id: string;
  name?: string;
  daily_view_limit: number;
  daily_write_limit: number;
  access_max_level: number;
}

export interface Subscription {
  user_id: string;
  plan_id: string;
  status: string;
  plans?: Plan;
}

export interface DailyUsage {
  user_id: string;
  usage_date: string;
  view_count: number;
  write_count: number;
}

const FREE_TIER = {
  daily_view_limit: 3,
  daily_write_limit: 5,
  access_max_level: 5,
};

export async function getUserPlan(userId: string) {
  const supabase = createClient();
  
  // Fetch active subscription
  // We assume 'active' or 'trialing' determines validity. Adjust based on your Stripe logic.
  const { data: sub, error } = await supabase
    .from('subscriptions')
    .select(`
      plan_id,
      status,
      plans (
        daily_view_limit,
        daily_write_limit,
        access_max_level
      )
    `)
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle();

  if (error) {
    console.error("Error fetching subscription:", error);
  }

  // If no active subscription found, return Free Tier defaults
  if (!sub || !sub.plans) {
    return FREE_TIER;
  }

  // Supabase returns 'plans' as an object or array depending on relationship. 
  // Using .maybeSingle() on the main query, 'plans' should be a single object if it's a many-to-one.
  // We cast it safely.
  const plan = sub.plans as unknown as Plan;
  
  return {
    daily_view_limit: plan.daily_view_limit ?? FREE_TIER.daily_view_limit,
    daily_write_limit: plan.daily_write_limit ?? FREE_TIER.daily_write_limit,
    access_max_level: plan.access_max_level ?? FREE_TIER.access_max_level,
  };
}

export async function getDailyUsage(userId: string) {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_usage')
    .select('view_count, write_count')
    .eq('user_id', userId)
    .eq('usage_date', today)
    .maybeSingle();
  
  if (error) {
    console.error("Error fetching daily usage:", error);
    // If error, assume 0 to not block user, but log it
    return { view_count: 0, write_count: 0 };
  }

  return {
    view_count: data?.view_count ?? 0,
    write_count: data?.write_count ?? 0,
  };
}

/**
 * Checks if the user can view a post. Throws error if limit reached.
 */
export async function checkViewLimit(userId: string) {
  const plan = await getUserPlan(userId);
  
  // Uncomment to bypass limit for top tier if limit is -1 or very large
  // if (plan.daily_view_limit < 0) return true;

  const usage = await getDailyUsage(userId);

  if (usage.view_count >= plan.daily_view_limit) {
    throw new Error(`일일 열람 한도를 초과했습니다. (오늘: ${usage.view_count}/${plan.daily_view_limit}회)`);
  }

  return true;
}

/**
 * Increments the daily view count.
 * Safe to call even if row doesn't exist (handleupsert).
 */
export async function incrementViewCount(userId: string) {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];

  // Ideally this should be an RPC for atomicity.
  // For now: Fetch -> Increment -> Upsert
  
  const { data: usage } = await supabase
    .from('daily_usage')
    .select('view_count')
    .eq('user_id', userId)
    .eq('usage_date', today)
    .maybeSingle();

  const currentCount = usage?.view_count ?? 0;

  const { error } = await supabase
    .from('daily_usage')
    .upsert({
      user_id: userId,
      usage_date: today,
      view_count: currentCount + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id, usage_date' });

  if (error) {
    console.error("Failed to increment view count:", error);
  }
}

/**
 * Checks if the user can write a new post. Throws error if limit reached.
 */
export async function checkWriteLimit(userId: string) {
  const plan = await getUserPlan(userId);
  const usage = await getDailyUsage(userId);

  if (usage.write_count >= plan.daily_write_limit) {
    throw new Error(`일일 글쓰기 한도를 초과했습니다. (오늘: ${usage.write_count}/${plan.daily_write_limit}회)`);
  }

  return true;
}

/**
 * Increments the daily write count.
 */
export async function incrementWriteCount(userId: string) {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: usage } = await supabase
    .from('daily_usage')
    .select('write_count, view_count') // Need view_count to preserve it on upsert? No, upsert patches? Supabase upsert requires full row or handles partial?
    // WARNING: 'upsert' replaces the row unless we ignore duplicates, but we want to update.
    // If we only provide partial data with upsert, it might default other columns if valid, or we need the full object.
    // Actually, SQL `INSERT ... ON CONFLICT DO UPDATE` is what we want.
    // Supabase .upsert() acts as `INSERT ON CONFLICT UPDATE` by default.
    // But if we omit `view_count`, it might set it to default (0) if it's a new INSERT, but correct for UPDATE?
    // Wait, if it's an UPDATE, Supabase/PostgREST upsert might NOT merge partial data blindly if it's structurally the entire row payload.
    // To be safe, we should read both counts and upsert both.
    .eq('user_id', userId)
    .eq('usage_date', today)
    .maybeSingle();

  const currentWrite = usage?.write_count ?? 0;
  const currentView = usage?.view_count ?? 0; // Preserve view count

  const { error } = await supabase
    .from('daily_usage')
    .upsert({
      user_id: userId,
      usage_date: today,
      write_count: currentWrite + 1,
      view_count: currentView,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id, usage_date' });

  if (error) {
    console.error("Failed to increment write count:", error);
  }
}

/**
 * Checks if the user has a high enough level to view the content.
 */
export async function checkAccessLevel(userId: string, requiredLevel: number) {
  if (requiredLevel <= 0) return true; // Public

  const plan = await getUserPlan(userId);
  
  if (plan.access_max_level < requiredLevel) {
     throw new Error(`이 글을 읽으려면 레벨 ${requiredLevel} 이상이 필요합니다. (현재 가능: ${plan.access_max_level}등급)`);
  }
  
  return true;
}
