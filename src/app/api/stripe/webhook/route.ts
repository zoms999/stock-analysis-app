import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { accrueReferralSettlement } from "@/lib/stripe/referral-settlement";

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function unixToIsoOrNull(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const ms = n > 1_000_000_000_000 ? n : n * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf",
  "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

function getAmountInCurrency(amountSmallest: number | null, currency: string): number | null {
  if (typeof amountSmallest !== "number" || !Number.isFinite(amountSmallest)) return null;
  const divisor = ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase()) ? 1 : 100;
  return amountSmallest / divisor;
}

// ─────────────────────────────────────────────────────────────
// Event Handlers
// ─────────────────────────────────────────────────────────────

/**
 * checkout.session.completed - 결제 완료
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log("[WEBHOOK] Processing checkout.session.completed");

  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    console.log("[WEBHOOK] No subscription in session, skipping");
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
  const supabase = getSupabaseAdmin();

  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;

  console.log("[WEBHOOK] User ID:", userId, "Plan ID:", planId);

  if (!userId || !planId) {
    console.error("[WEBHOOK] Missing userId or planId");
    return;
  }

  const subscriptionData = {
    user_id: userId,
    plan_id: parseInt(planId),
    stripe_subscription_id: subscriptionId,
    status: subscription.status,
    current_period_start: unixToIsoOrNull(subscription.current_period_start),
    current_period_end: unixToIsoOrNull(subscription.current_period_end),
  };

  console.log("[WEBHOOK] Upserting subscription:", subscriptionData);

  // Idempotent upsert
  const { data: existingSub, error: existingError } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error("[WEBHOOK] Database error (select existing):", existingError);
    throw new Error("Database Error");
  }

  if (existingSub?.id) {
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update(subscriptionData)
      .eq("id", existingSub.id);

    if (updateError) {
      console.error("[WEBHOOK] Database error (update):", updateError);
      throw new Error("Database Error");
    }
  } else {
    const { error: insertError } = await supabase
      .from("subscriptions")
      .insert(subscriptionData);

    if (insertError) {
      console.error("[WEBHOOK] Database error (insert):", insertError);
      throw new Error("Database Error");
    }
  }

  // Partner settlement accrual
  const paymentAmount = getAmountInCurrency(
    session.amount_total,
    session.currency || ""
  );

  if (paymentAmount && paymentAmount > 0) {
    const result = await accrueReferralSettlement({
      supabaseAdmin: supabase as any,
      payerId: userId,
      paymentAmount,
      stripeSubscriptionId: subscriptionId,
      stripeCheckoutSessionId: session.id,
      commissionRate: 10,
    });

    if (!result.ok) {
      console.error("[WEBHOOK] Partner settlement accrual failed:", result);
    } else {
      console.log("[WEBHOOK] Partner settlement accrued:", result);
    }
  }
}

/**
 * customer.subscription.updated - 구독 상태 변경
 */
async function handleSubscriptionUpdated(subscription: any) {
  console.log("[WEBHOOK] Processing customer.subscription.updated");
  console.log("[WEBHOOK] Subscription status:", subscription.status);

  const supabase = getSupabaseAdmin();
  const subscriptionId = subscription.id;

  // Find existing subscription
  const { data: existingSub, error: findError } = await supabase
    .from("subscriptions")
    .select("id, user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .limit(1)
    .maybeSingle();

  if (findError) {
    console.error("[WEBHOOK] Error finding subscription:", findError);
    return;
  }

  if (!existingSub) {
    console.log("[WEBHOOK] Subscription not found in DB, skipping");
    return;
  }

  // Update subscription status
  const updateData: Record<string, unknown> = {
    status: subscription.status,
    current_period_start: unixToIsoOrNull(subscription.current_period_start),
    current_period_end: unixToIsoOrNull(subscription.current_period_end),
  };

  // Handle pause/resume
  if (subscription.pause_collection) {
    updateData.paused_at = new Date().toISOString();
  } else {
    updateData.paused_at = null;
  }

  // Handle cancellation
  if (subscription.cancel_at_period_end) {
    updateData.cancel_at_period_end = true;
    updateData.canceled_at = unixToIsoOrNull(subscription.canceled_at);
  } else {
    updateData.cancel_at_period_end = false;
    updateData.canceled_at = null;
  }

  const { error: updateError } = await supabase
    .from("subscriptions")
    .update(updateData)
    .eq("id", existingSub.id);

  if (updateError) {
    console.error("[WEBHOOK] Error updating subscription:", updateError);
  }

  // If subscription became past_due or unpaid, notify user (via point transaction log)
  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    console.log("[WEBHOOK] Subscription payment issue detected for user:", existingSub.user_id);
    
    // Log payment issue notification
    await supabase.from("point_transactions").insert({
      user_id: existingSub.user_id,
      amount: 0,
      reason: subscription.status === "past_due" 
        ? "구독 결제 실패 - 카드 정보를 확인해주세요" 
        : "구독 결제 미완료 - 결제 수단을 업데이트해주세요",
      type: "ADMIN",
      metadata: {
        event: "subscription_payment_issue",
        subscription_id: subscriptionId,
        status: subscription.status,
      },
    });
  }

  console.log("[WEBHOOK] Subscription updated successfully");
}

/**
 * customer.subscription.deleted - 구독 취소/만료
 */
async function handleSubscriptionDeleted(subscription: any) {
  console.log("[WEBHOOK] Processing customer.subscription.deleted");

  const supabase = getSupabaseAdmin();
  const subscriptionId = subscription.id;

  const { data: existingSub, error: findError } = await supabase
    .from("subscriptions")
    .select("id, user_id, plan_id")
    .eq("stripe_subscription_id", subscriptionId)
    .limit(1)
    .maybeSingle();

  if (findError || !existingSub) {
    console.log("[WEBHOOK] Subscription not found or error:", findError);
    return;
  }

  // Update subscription status to canceled
  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("id", existingSub.id);

  if (updateError) {
    console.error("[WEBHOOK] Error updating subscription:", updateError);
  }

  // Reset user level to free tier (level 1)
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ user_level: 1 })
    .eq("id", existingSub.user_id);

  if (profileError) {
    console.error("[WEBHOOK] Error resetting user level:", profileError);
  }

  console.log("[WEBHOOK] Subscription deleted, user downgraded to free tier");
}

/**
 * invoice.payment_failed - 결제 실패
 */
async function handleInvoicePaymentFailed(invoice: any) {
  console.log("[WEBHOOK] Processing invoice.payment_failed");

  const supabase = getSupabaseAdmin();
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    console.log("[WEBHOOK] No subscription in invoice, skipping");
    return;
  }

  // Find subscription
  const { data: existingSub, error: findError } = await supabase
    .from("subscriptions")
    .select("id, user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .limit(1)
    .maybeSingle();

  if (findError || !existingSub) {
    console.log("[WEBHOOK] Subscription not found:", findError);
    return;
  }

  // Update subscription status
  await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      last_payment_error: invoice.last_finalization_error?.message || "Payment failed",
    })
    .eq("id", existingSub.id);

  // Log notification for user
  await supabase.from("point_transactions").insert({
    user_id: existingSub.user_id,
    amount: 0,
    reason: `구독 결제 실패 (시도 ${invoice.attempt_count || 1}회) - 결제 수단을 확인해주세요`,
    type: "ADMIN",
    metadata: {
      event: "payment_failed",
      invoice_id: invoice.id,
      subscription_id: subscriptionId,
      attempt_count: invoice.attempt_count,
      amount: invoice.amount_due,
    },
  });

  console.log("[WEBHOOK] Payment failure recorded for user:", existingSub.user_id);
}

/**
 * invoice.payment_succeeded - 결제 성공 (갱신 포함)
 */
async function handleInvoicePaymentSucceeded(invoice: any) {
  console.log("[WEBHOOK] Processing invoice.payment_succeeded");

  const supabase = getSupabaseAdmin();
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    console.log("[WEBHOOK] No subscription in invoice, skipping");
    return;
  }

  // Find subscription
  const { data: existingSub, error: findError } = await supabase
    .from("subscriptions")
    .select("id, user_id, plan_id")
    .eq("stripe_subscription_id", subscriptionId)
    .limit(1)
    .maybeSingle();

  if (findError || !existingSub) {
    console.log("[WEBHOOK] Subscription not found:", findError);
    return;
  }

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;

  // Update subscription status
  await supabase
    .from("subscriptions")
    .update({
      status: subscription.status,
      current_period_start: unixToIsoOrNull(subscription.current_period_start),
      current_period_end: unixToIsoOrNull(subscription.current_period_end),
      last_payment_error: null, // Clear any previous error
    })
    .eq("id", existingSub.id);

  // For renewal payments (not first payment), accrue partner settlement
  if (invoice.billing_reason === "subscription_cycle") {
    const paymentAmount = getAmountInCurrency(
      invoice.amount_paid,
      invoice.currency || ""
    );

    if (paymentAmount && paymentAmount > 0) {
      const result = await accrueReferralSettlement({
        supabaseAdmin: supabase as any,
        payerId: existingSub.user_id,
        paymentAmount,
        stripeSubscriptionId: subscriptionId,
        stripeCheckoutSessionId: invoice.id,
        commissionRate: 10,
      });

      if (!result.ok) {
        console.error("[WEBHOOK] Partner settlement for renewal failed:", result);
      } else {
        console.log("[WEBHOOK] Partner settlement for renewal accrued:", result);
      }
    }
  }

  console.log("[WEBHOOK] Payment succeeded for subscription:", subscriptionId);
}

/**
 * charge.refunded - 환불 처리
 */
async function handleChargeRefunded(charge: any) {
  console.log("[WEBHOOK] Processing charge.refunded");

  const supabase = getSupabaseAdmin();

  // Get invoice from charge
  const invoiceId = charge.invoice as string;
  if (!invoiceId) {
    console.log("[WEBHOOK] No invoice in charge, skipping");
    return;
  }

  const invoice = await stripe.invoices.retrieve(invoiceId) as any;
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    console.log("[WEBHOOK] No subscription in invoice, skipping");
    return;
  }

  // Find subscription
  const { data: existingSub, error: findError } = await supabase
    .from("subscriptions")
    .select("id, user_id, plan_id")
    .eq("stripe_subscription_id", subscriptionId)
    .limit(1)
    .maybeSingle();

  if (findError || !existingSub) {
    console.log("[WEBHOOK] Subscription not found:", findError);
    return;
  }

  const refundAmount = getAmountInCurrency(charge.amount_refunded, charge.currency);

  // Log refund
  await supabase.from("point_transactions").insert({
    user_id: existingSub.user_id,
    amount: 0,
    reason: `구독 환불 처리됨 (${refundAmount?.toLocaleString() || charge.amount_refunded} ${charge.currency.toUpperCase()})`,
    type: "REFUND",
    metadata: {
      event: "charge_refunded",
      charge_id: charge.id,
      subscription_id: subscriptionId,
      refund_amount: refundAmount,
      currency: charge.currency,
    },
  });

  // If full refund, cancel subscription
  if (charge.refunded) {
    console.log("[WEBHOOK] Full refund detected, canceling subscription");

    // Cancel subscription in Stripe
    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch (err) {
      console.error("[WEBHOOK] Error canceling subscription in Stripe:", err);
    }

    // Update DB
    await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
      })
      .eq("id", existingSub.id);

    // Reset user level
    await supabase
      .from("profiles")
      .update({ user_level: 1 })
      .eq("id", existingSub.user_id);
  }

  console.log("[WEBHOOK] Refund processed for user:", existingSub.user_id);
}

// ─────────────────────────────────────────────────────────────
// Main Webhook Handler
// ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  console.log("[WEBHOOK] Received request");

  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("Stripe-Signature") as string;

  if (!signature) {
    console.error("[WEBHOOK] No signature found");
    return new NextResponse("No signature", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    console.log("[WEBHOOK] Event verified:", event.type);
  } catch (error: any) {
    console.error("[WEBHOOK] Signature verification failed:", error.message);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      // Checkout completed (first payment)
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      // Subscription status changes
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.paused":
        console.log("[WEBHOOK] Subscription paused");
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.resumed":
        console.log("[WEBHOOK] Subscription resumed");
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      // Invoice/Payment events
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      // Refund
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      default:
        console.log("[WEBHOOK] Unhandled event type:", event.type);
    }
  } catch (error: any) {
    console.error("[WEBHOOK] Error processing event:", error);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
