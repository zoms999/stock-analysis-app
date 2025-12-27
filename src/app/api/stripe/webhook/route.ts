import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

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
        
        console.log('[WEBHOOK] Inserting subscription:', subscriptionData);
        
        const { data, error } = await supabase
            .from('subscriptions')
            .insert(subscriptionData)
            .select();
            
         if (error) {
             console.error('[WEBHOOK] Database error:', error);
             return new NextResponse('Database Error', { status: 500 });
         }
         
         console.log('[WEBHOOK] Subscription created:', data);
    } else {
      console.error('[WEBHOOK] Missing userId or planId');
    }
  }

  return new NextResponse(null, { status: 200 });
}
