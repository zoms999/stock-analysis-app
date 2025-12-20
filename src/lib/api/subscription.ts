import { createClient } from "@/lib/supabase/client";

// Re-export types if needed
export interface Plan { /* ... tied to DB now ... */ }

/**
 * Consumes a view count for the user.
 * Checks Access Level AND View Limit atomically via RPC.
 * Returns 'OK' if allowed, throws error otherwise.
 */
export async function consumeView(userId: string, requiredLevel: number) {
  const supabase = createClient();
  
  const { data: status, error } = await supabase.rpc('consume_view', {
    p_user_id: userId,
    p_required_level: requiredLevel
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

