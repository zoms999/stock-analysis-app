import { createClient } from "@/lib/supabase/client";

export interface DailyStat {
  date: string;
  count: number;
}

export interface RevenueStat {
  date: string;
  amount: number;
}

/**
 * Get daily user registration count for the last N days
 */
export async function getDailyUserGrowth(days = 30): Promise<DailyStat[]> {
    const supabase = createClient();
    
    // In a real app, we might have a separate 'stats_daily' table pre-aggregated via triggers/cron.
    // For now, we'll query profiles. created_at. 
    // Note: This is expensive if we have 1M+ users. Ideally use created_at index.
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const { data, error } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Failed to fetch user growth", error);
        return [];
    }

    // Aggregate by date
    const statsMap = new Map<string, number>();
    
    // Initialize all dates with 0
    for(let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        statsMap.set(d.toISOString().split('T')[0], 0);
    }

    data?.forEach(profile => {
        const dateStr = new Date(profile.created_at).toISOString().split('T')[0];
        statsMap.set(dateStr, (statsMap.get(dateStr) || 0) + 1);
    });

    return Array.from(statsMap.entries()).map(([date, count]) => ({ date, count }));
}

/**
 * Get daily revenue stats for the last N days
 */
export async function getDailyRevenue(days = 30): Promise<RevenueStat[]> {
    const supabase = createClient();
    
    // Query partner_settlements or subscription tables.
    // Assuming 'partner_settlements' created_at corresponds to when revenue was recognized for partner.
    // Or we could query a hypothetical 'payments' table.
    
    // Let's use partner_settlements as a proxy for platform activity/revenue that we track explicitly
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const { data, error } = await supabase
        .from('partner_settlements')
        .select('created_at, settlement_amount')
        .gte('created_at', startDate.toISOString());

    if (error) {
        console.error("Failed to fetch revenue stats", error);
        return [];
    }

    const statsMap = new Map<string, number>();
     // Initialize all dates with 0
     for(let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        statsMap.set(d.toISOString().split('T')[0], 0);
    }

    data?.forEach(item => {
        const dateStr = new Date(item.created_at).toISOString().split('T')[0];
        statsMap.set(dateStr, (statsMap.get(dateStr) || 0) + item.settlement_amount);
    });

    return Array.from(statsMap.entries()).map(([date, amount]) => ({ date, amount }));
}
