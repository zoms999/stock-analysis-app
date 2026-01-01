import type { SupabaseClient } from "@supabase/supabase-js"

type AccrueInput = {
  supabaseAdmin: SupabaseClient
  payerId: string
  paymentAmount: number
  stripeSubscriptionId?: string | null
  stripeCheckoutSessionId?: string | null
  commissionRate?: number // percent
}

/**
 * 유치회원(결제자)이 유료 구독을 시작했을 때 파트너 정산 레코드를 생성합니다.
 *
 * 우선 DB RPC(`create_referral_settlement`)를 호출하고,
 * - 함수가 없거나/권한 문제 등으로 실패하면
 * - 서버에서 직접 `partner_settlements`를 insert 하는 fallback을 수행합니다.
 *
 * ⚠ 중복 방지는 DB의 unique index(추천: stripe_subscription_id unique)에 의존하는 것이 가장 안전합니다.
 * (repo의 `sql/partner_referral_settlement.sql` 참고)
 */
export async function accrueReferralSettlement(input: AccrueInput) {
  const {
    supabaseAdmin,
    payerId,
    paymentAmount,
    stripeSubscriptionId = null,
    stripeCheckoutSessionId = null,
    commissionRate = 10,
  } = input

  if (!payerId) return { ok: false, skipped: true as const, reason: "NO_PAYER" }
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return { ok: false, skipped: true as const, reason: "NO_PAYMENT_AMOUNT" }
  }

  // 1) Try DB function first (best: includes security definer + unique index)
  try {
    const { error } = await supabaseAdmin.rpc("create_referral_settlement", {
      payer_id: payerId,
      payment_amount: paymentAmount,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_checkout_session_id: stripeCheckoutSessionId,
      commission_rate: commissionRate,
    })

    if (!error) {
      return { ok: true as const, via: "rpc" as const }
    }

    // If RPC fails, continue to fallback (log upstream)
    // eslint-disable-next-line no-console
    console.error("[REFERRAL_SETTLEMENT] RPC failed, fallback to manual insert:", error)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[REFERRAL_SETTLEMENT] RPC threw, fallback to manual insert:", e)
  }

  // 2) Manual fallback
  // 2.1) 중복 체크(컬럼이 있을 때만)
  if (stripeSubscriptionId) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("partner_settlements")
      .select("id")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .limit(1)
      .maybeSingle()

    if (!existingError && existing?.id) {
      return { ok: true as const, via: "manual" as const, deduped: true as const }
    }
  }

  // 2.2) payer -> referred_by
  const { data: payerProfile, error: payerErr } = await supabaseAdmin
    .from("profiles")
    .select("referred_by")
    .eq("id", payerId)
    .maybeSingle()

  if (payerErr) {
    return { ok: false as const, error: payerErr.message }
  }

  const partnerId = (payerProfile as any)?.referred_by as string | null | undefined
  if (!partnerId) {
    return { ok: false, skipped: true as const, reason: "NO_REFERRER" }
  }

  // 2.3) partner is_partner check
  const { data: partnerProfile, error: partnerErr } = await supabaseAdmin
    .from("profiles")
    .select("is_partner")
    .eq("id", partnerId)
    .maybeSingle()

  if (partnerErr) {
    return { ok: false as const, error: partnerErr.message }
  }

  const isPartner = (partnerProfile as any)?.is_partner === true
  if (!isPartner) {
    return { ok: false, skipped: true as const, reason: "REFERRER_NOT_PARTNER" }
  }

  const settlementAmount = Math.floor(paymentAmount * (commissionRate / 100))
  if (!Number.isFinite(settlementAmount) || settlementAmount <= 0) {
    return { ok: false, skipped: true as const, reason: "SETTLEMENT_ZERO" }
  }

  // 2.4) insert settlement
  // (컬럼이 없을 수 있어 1차로 stripe 컬럼 포함 insert → 실패하면 stripe 컬럼 없이 재시도)
  const baseRow = {
    partner_id: partnerId,
    source_user_id: payerId,
    payment_amount: paymentAmount,
    commission_rate: commissionRate,
    settlement_amount: settlementAmount,
    is_paid: false,
  }

  const rowWithStripe = {
    ...baseRow,
    stripe_subscription_id: stripeSubscriptionId,
    stripe_checkout_session_id: stripeCheckoutSessionId,
  }

  const { error: insertError } = await supabaseAdmin
    .from("partner_settlements")
    .insert(rowWithStripe as any)

  if (!insertError) {
    return { ok: true as const, via: "manual" as const }
  }

  // fallback: stripe 컬럼이 없을 수 있음
  const { error: insertError2 } = await supabaseAdmin
    .from("partner_settlements")
    .insert(baseRow as any)

  if (insertError2) {
    return { ok: false as const, error: insertError2.message }
  }

  return { ok: true as const, via: "manual" as const }
}








