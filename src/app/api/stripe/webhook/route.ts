import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { accrueReferralSettlement } from "@/lib/stripe/referral-settlement";

export async function POST(req: Request) {
  console.log('[WEBHOOK] Received request');
  
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("Stripe-Signature") as string;

  if (!signature) {
    console.error('[WEBHOOK] No signature found');
    return new NextResponse("No signature", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    console.log('[WEBHOOK] Event verified:', event.type);
  } catch (error: any) {
    console.error('[WEBHOOK] Signature verification failed:', error.message);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (event.type === "checkout.session.completed") {
    console.log('[WEBHOOK] Processing checkout.session.completed');
    
    const subscriptionId = session.subscription as string;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;
    
    console.log('[WEBHOOK] User ID:', userId, 'Plan ID:', planId);

    if (userId && planId) {
        const unixToIsoOrNull = (value: unknown) => {
          if (typeof value === "number" && Number.isFinite(value)) {
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

        const subscriptionData = {
            user_id: userId,
            plan_id: parseInt(planId), // Convert to integer
            stripe_subscription_id: subscriptionId,
            status: subscription.status,
            current_period_start: unixToIsoOrNull(subscription.current_period_start),
            current_period_end: unixToIsoOrNull(subscription.current_period_end),
        };
        
        console.log('[WEBHOOK] Upserting subscription:', subscriptionData);

        // idempotent upsert without relying on unique constraints
        const { data: existingSub, error: existingError } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('stripe_subscription_id', subscriptionId)
          .limit(1)
          .maybeSingle();

        if (existingError) {
          console.error('[WEBHOOK] Database error (select existing):', existingError);
          return new NextResponse('Database Error', { status: 500 });
        }

        if (existingSub?.id) {
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update(subscriptionData)
            .eq('id', existingSub.id);

          if (updateError) {
            console.error('[WEBHOOK] Database error (update):', updateError);
            return new NextResponse('Database Error', { status: 500 });
          }
        } else {
          const { error: insertError } = await supabase
            .from('subscriptions')
            .insert(subscriptionData);

          if (insertError) {
            console.error('[WEBHOOK] Database error (insert):', insertError);
            return new NextResponse('Database Error', { status: 500 });
          }
        }

        const ZERO_DECIMAL = new Set([
          "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf",
          "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
        ]);

        const currency = (session.currency || "").toLowerCase();
        const divisor = ZERO_DECIMAL.has(currency) ? 1 : 100;

        const amountSmallest =
          typeof session.amount_total === "number"
            ? session.amount_total
            : (subscription?.items?.data?.[0]?.price?.unit_amount ?? null);

        const paymentAmount =
          typeof amountSmallest === "number" && Number.isFinite(amountSmallest)
            ? amountSmallest / divisor
            : null;

        // ===== Partner settlement accrual (자동 적립) =====
        // RPC가 없거나 실패해도 서버에서 직접 insert 하는 fallback을 수행합니다.
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
    } else {
      console.error('[WEBHOOK] Missing userId or planId');
    }
  }

  return new NextResponse(null, { status: 200 });
}
