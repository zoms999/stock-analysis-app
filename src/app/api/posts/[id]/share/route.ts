import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHARE_REWARD = {
  additionalViews: 1,
  points: 10,
};

function getTodayYmdUtc() {
  return new Date().toISOString().slice(0, 10);
}

function safePlatform(v: unknown) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  return s.slice(0, 32);
}

async function insertPointTransaction(params: {
  // ✅ supabase-js 버전별 제네릭 타입 차이로 인한 빌드 오류를 피하기 위해 넓은 타입 사용
  supabaseAdmin: SupabaseClient<any, any, any, any, any>;
  userId: string;
  amount: number;
  platform: string;
  postId: string;
}) {
  const { supabaseAdmin, userId, amount, platform, postId } = params;

  // 스키마가 환경별로 달라질 수 있어(legacy/변경) 2단계로 안전 삽입합니다.
  const metadata = {
    action: "share_reward",
    post_id: postId,
    platform,
    additional_views: SHARE_REWARD.additionalViews,
    points: amount,
  };

  // 1) description/transaction_type 기반(일부 환경)
  const { error: e1 } = await supabaseAdmin.from("point_transactions").insert({
    user_id: userId,
    amount,
    description: "SNS 공유 보상",
    transaction_type: "REWARD",
    metadata,
  } as any);

  if (!e1) return { ok: true as const, via: "description" as const };

  // 2) reason/type 기반(기본 스키마)
  const { error: e2 } = await supabaseAdmin.from("point_transactions").insert({
    user_id: userId,
    amount,
    reason: "SNS 공유 보상",
    type: "EARN",
    metadata,
  } as any);

  if (e2) return { ok: false as const, error: e2.message, raw: { e1: e1.message, e2: e2.message } };
  return { ok: true as const, via: "reason" as const };
}

async function hasRewardedToday(params: {
  // ✅ supabase-js 버전별 제네릭 타입 차이로 인한 빌드 오류를 피하기 위해 넓은 타입 사용
  supabaseAdmin: SupabaseClient<any, any, any, any, any>;
  userId: string;
  postId: string;
  platform: string;
  todayYmdUtc: string;
}) {
  const { supabaseAdmin, userId, postId, platform, todayYmdUtc } = params;
  const fromIso = `${todayYmdUtc}T00:00:00.000Z`;

  // metadata 기반 중복 방지(가능한 경우)
  const { data, error } = await supabaseAdmin
    .from("point_transactions")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", fromIso)
    .contains("metadata", { action: "share_reward", post_id: postId, platform })
    .limit(1);

  if (!error && data && data.length > 0) return true;
  return false;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: postId } = await ctx.params;
  const platform = safePlatform(await req.json().catch(() => ({})).then((b) => (b as any)?.platform));

  // 1) 로그인 확인(쿠키 세션 기반)
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  // 2) Admin client (service role)로 보상 지급 (RLS 우회/권한 안정화)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: "SERVER_MISCONFIGURED" }, { status: 500 });
  }

  const supabaseAdmin = createSupabaseAdminClient(supabaseUrl, serviceKey);
  const today = getTodayYmdUtc();

  // 3) 중복 방지: 같은 게시글은 하루 1회만 보상
  const already = await hasRewardedToday({
    supabaseAdmin,
    userId,
    postId,
    platform,
    todayYmdUtc: today,
  });

  if (already) {
    return NextResponse.json({
      ok: true,
      alreadyRewarded: true,
      reward: SHARE_REWARD,
    });
  }

  // 4) 추가 열람권 +1 (daily_usage.additional_view_count)
  try {
    const { data: row, error: selErr } = await supabaseAdmin
      .from("daily_usage")
      .select("additional_view_count, view_count, write_count, additional_write_count")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .maybeSingle();

    if (selErr) throw selErr;

    if (!row) {
      const { error: insErr } = await supabaseAdmin.from("daily_usage").insert({
        user_id: userId,
        usage_date: today,
        view_count: 0,
        write_count: 0,
        additional_view_count: SHARE_REWARD.additionalViews,
        additional_write_count: 0,
      } as any);
      if (insErr) throw insErr;
    } else {
      const next = (row as any).additional_view_count ?? 0;
      const { error: updErr } = await supabaseAdmin
        .from("daily_usage")
        .update({ additional_view_count: Number(next) + SHARE_REWARD.additionalViews } as any)
        .eq("user_id", userId)
        .eq("usage_date", today);
      if (updErr) throw updErr;
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "FAILED_TO_GRANT_VIEW", message: String(e?.message ?? e) },
      { status: 500 }
    );
  }

  // 5) 포인트 +N (profiles.point_balance + point_transactions 기록)
  if (SHARE_REWARD.points > 0) {
    try {
      const { data: profile, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("point_balance")
        .eq("id", userId)
        .maybeSingle();
      if (pErr) throw pErr;

      const current = Number((profile as any)?.point_balance ?? 0);
      const nextBalance = current + SHARE_REWARD.points;

      // updated_at 컬럼 유무가 환경별로 다를 수 있어 2단계 업데이트
      const { error: u1 } = await supabaseAdmin
        .from("profiles")
        .update({ point_balance: nextBalance, updated_at: new Date().toISOString() } as any)
        .eq("id", userId);

      if (u1) {
        const { error: u2 } = await supabaseAdmin
          .from("profiles")
          .update({ point_balance: nextBalance } as any)
          .eq("id", userId);
        if (u2) throw u2;
      }

      const tx = await insertPointTransaction({
        supabaseAdmin,
        userId,
        amount: SHARE_REWARD.points,
        platform,
        postId,
      });
      if (!tx.ok) {
        // 포인트 잔액은 올렸으니 트랜잭션 로그 실패는 치명적이지 않게 처리(로그만)
        // eslint-disable-next-line no-console
        console.error("[SHARE_REWARD] point transaction insert failed:", tx);
      }
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: "FAILED_TO_GRANT_POINTS", message: String(e?.message ?? e) },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    alreadyRewarded: false,
    reward: SHARE_REWARD,
  });
}


