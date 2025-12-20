import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers(); // Fix: await headers()
  const signature = headersList.get("Stripe-Signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (event.type === "checkout.session.completed") {
    const subscriptionId = session.subscription as string;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId; // Now available!

    if (userId && planId) {
        // Upsert subscription
        const { error } = await supabase
            .from('subscriptions')
            .upsert({
                user_id: userId,
                plan_id: planId, // UUID from metadata
                stripe_subscription_id: subscriptionId,
                status: subscription.status,
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' }); // Assuming one active sub per user or composite key? 
            // If composite (user_id, plan_id), then onConflict might differ. 
            // But usually 1 user = 1 active sub. Let's assume onConflict on user_id or unique constraint.
            // If multiple plans allowed, we'd need a unique constraint on (user_id, plan_id).
            // For now, let's assume one sub row per user or simple insert.
            
         if (error) {
             console.error('Error updating subscription:', error);
             return new NextResponse('Database Error', { status: 500 });
         }
    }
  }

  return new NextResponse(null, { status: 200 });
}
