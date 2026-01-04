import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe/client"
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server"
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import { accrueReferralSettlement } from "@/lib/stripe/referral-settlement"

/**
 * 결제 성공 후(redirect) 웹훅이 누락되더라도 구독 정보를 DB에 동기화합니다.
 * - 클라이언트는 checkout session_id를 전달
 * - 서버는 로그인된 사용자와 session.metadata.userId를 대조
 * - subscriptions 테이블에 insert/update 수행
 */
export async function POST(req: Request) {
  try {
    const { sessionId } = (await req.json()) as { sessionId?: string }
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
    }

    // 현재 로그인 유저 확인 (쿠키 기반)
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const stripe = await getStripe();

    // Stripe session 조회
    const session = (await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    })) as Stripe.Checkout.Session & { subscription?: Stripe.Subscription }

    const metadataUserId = session.metadata?.userId
    const metadataPlanId = session.metadata?.planId

    if (!metadataUserId || metadataUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const subscriptionId = session.subscription
      ? typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id
      : null

    if (!subscriptionId) {
      return NextResponse.json({ error: "No subscription on session" }, { status: 400 })
    }

    const subscription =
      typeof session.subscription === "string"
        ? ((await stripe.subscriptions.retrieve(subscriptionId)) as any)
        : (session.subscription as any)

    const unixToIsoOrNull = (value: unknown) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        // Stripe는 seconds를 주지만, 혹시 ms가 들어오면 보정
        const ms = value > 1_000_000_000_000 ? value : value * 1000
        const d = new Date(ms)
        return Number.isNaN(d.getTime()) ? null : d.toISOString()
      }
      if (typeof value === "string" && value.trim().length > 0) {
        const n = Number(value)
        if (!Number.isFinite(n)) return null
        const ms = n > 1_000_000_000_000 ? n : n * 1000
        const d = new Date(ms)
        return Number.isNaN(d.getTime()) ? null : d.toISOString()
      }
      return null
    }

    // Admin client (Service Role)로 DB 반영
    const supabaseAdmin = createSupabaseAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const planIdInt = metadataPlanId ? Number.parseInt(metadataPlanId, 10) : null

    const subscriptionData = {
      user_id: user.id,
      plan_id: Number.isFinite(planIdInt as number) ? (planIdInt as number) : null,
      stripe_subscription_id: subscriptionId,
      status: subscription.status,
      current_period_start: unixToIsoOrNull(subscription.current_period_start),
      current_period_end: unixToIsoOrNull(subscription.current_period_end),
    }

    // 기존 구독 찾기: stripe_subscription_id 또는 user_id로
    const { data: existingByStripeId, error: existingByStripeError } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("stripe_subscription_id", subscriptionId)
      .limit(1)
      .maybeSingle()

    if (existingByStripeError) {
      return NextResponse.json({ error: existingByStripeError.message }, { status: 500 })
    }

    // user_id로 기존 구독 찾기 (unique 제약 때문에)
    const { data: existingByUserId, error: existingByUserError } = await supabaseAdmin
      .from("subscriptions")
      .select("id, stripe_subscription_id, status")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()

    if (existingByUserError && existingByUserError.code !== "PGRST116") {
      // PGRST116은 "no rows returned" 에러이므로 무시
      return NextResponse.json({ error: existingByUserError.message }, { status: 500 })
    }

    // 기존 구독이 있고, 다른 Stripe 구독 ID를 가지고 있다면 취소 처리
    if (existingByUserId && existingByUserId.stripe_subscription_id !== subscriptionId) {
      // 기존 구독을 canceled로 업데이트
      await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
        })
        .eq("id", existingByUserId.id)
    }

    // stripe_subscription_id로 찾은 기존 구독이 있으면 업데이트
    if (existingByStripeId?.id) {
      const { error: updateError } = await supabaseAdmin
        .from("subscriptions")
        .update(subscriptionData)
        .eq("id", existingByStripeId.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    } else {
      // 새로 insert (기존 user_id 구독은 이미 취소 처리됨)
      const { error: insertError } = await supabaseAdmin
        .from("subscriptions")
        .insert(subscriptionData)

      if (insertError) {
        // unique 제약 위반 시 기존 구독을 업데이트로 처리
        if (insertError.code === "23505" && insertError.message.includes("user_id")) {
          const { error: updateError } = await supabaseAdmin
            .from("subscriptions")
            .update(subscriptionData)
            .eq("user_id", user.id)

          if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 })
          }
        } else {
          return NextResponse.json({ error: insertError.message }, { status: 500 })
        }
      }
    }

    const ZERO_DECIMAL = new Set([
      "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf",
      "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
    ])
    const currency = (session.currency || "").toLowerCase()
    const divisor = ZERO_DECIMAL.has(currency) ? 1 : 100

    const amountSmallest =
      typeof session.amount_total === "number"
        ? session.amount_total
        : (subscription?.items?.data?.[0]?.price?.unit_amount ?? null)

    const paymentAmount =
      typeof amountSmallest === "number" && Number.isFinite(amountSmallest)
        ? amountSmallest / divisor
        : null

    // ===== Partner settlement accrual (자동 적립) =====
    // RPC가 없거나 실패해도 서버에서 직접 insert 하는 fallback을 수행합니다.
    if (paymentAmount && paymentAmount > 0) {
      const result = await accrueReferralSettlement({
        supabaseAdmin,
        payerId: user.id,
        paymentAmount,
        stripeSubscriptionId: subscriptionId,
        stripeCheckoutSessionId: session.id,
        commissionRate: 10,
      })

      if (!result.ok) {
        console.error("[STRIPE_SYNC] Partner settlement accrual failed:", result)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("[STRIPE_SYNC]", e)
    return NextResponse.json(
      { error: e?.message || "Internal Error" },
      { status: 500 }
    )
  }
}



