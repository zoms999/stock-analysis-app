import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe/client"
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server"
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js"
import Stripe from "stripe"

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

    // 기존 row가 있으면 update, 없으면 insert (unique 제약이 없어도 동작하도록)
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("stripe_subscription_id", subscriptionId)
      .limit(1)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    if (existing?.id) {
      const { error: updateError } = await supabaseAdmin
        .from("subscriptions")
        .update(subscriptionData)
        .eq("id", existing.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("subscriptions")
        .insert(subscriptionData)

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    // ===== Partner settlement accrual (자동 적립) =====
    // NOTE: DB에 `public.create_referral_settlement` 함수/컬럼이 아직 없다면 실패할 수 있으므로,
    // 구독 동기화는 성공시키고 로그만 남깁니다.
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

    if (paymentAmount && paymentAmount > 0) {
      const { error: settleError } = await supabaseAdmin.rpc("create_referral_settlement", {
        payer_id: user.id,
        payment_amount: paymentAmount,
        stripe_subscription_id: subscriptionId,
        stripe_checkout_session_id: session.id,
      })

      if (settleError) {
        console.error("[STRIPE_SYNC] create_referral_settlement failed:", settleError)
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



