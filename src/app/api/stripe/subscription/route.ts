import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * GET /api/stripe/subscription
 * 현재 사용자의 구독 정보 조회
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("*, plans(*)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[SUBSCRIPTION] Error fetching subscription:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!subscription) {
      return NextResponse.json({ subscription: null });
    }

    // Get additional info from Stripe
    let stripeDetails: {
      status: string;
      cancel_at_period_end: boolean;
      current_period_end: number;
      pause_collection: { behavior: string } | null;
    } | null = null;

    if (subscription.stripe_subscription_id) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id
        ) as any;
        stripeDetails = {
          status: stripeSubscription.status,
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          current_period_end: stripeSubscription.current_period_end,
          pause_collection: stripeSubscription.pause_collection,
        };
      } catch (err) {
        console.error("[SUBSCRIPTION] Error fetching from Stripe:", err);
      }
    }

    return NextResponse.json({
      subscription: {
        ...subscription,
        stripe_details: stripeDetails,
      },
    });
  } catch (error: any) {
    console.error("[SUBSCRIPTION]", error);
    return NextResponse.json(
      { error: error?.message || "Internal Error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/stripe/subscription
 * 구독 관리 (일시정지, 재개, 취소)
 */
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action } = await req.json();

    if (!action || !["pause", "resume", "cancel", "reactivate"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Use: pause, resume, cancel, reactivate" },
        { status: 400 }
      );
    }

    // Get user's subscription
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["active", "paused", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    const stripeSubId = subscription.stripe_subscription_id;
    if (!stripeSubId) {
      return NextResponse.json(
        { error: "Subscription not linked to Stripe" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let result;

    switch (action) {
      case "pause":
        // Pause subscription (billing will be paused)
        result = await stripe.subscriptions.update(stripeSubId, {
          pause_collection: {
            behavior: "mark_uncollectible", // or "keep_as_draft" or "void"
          },
        });

        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "paused",
            paused_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        return NextResponse.json({
          ok: true,
          message: "구독이 일시정지되었습니다.",
          subscription: { status: "paused" },
        });

      case "resume":
        // Resume paused subscription
        result = await stripe.subscriptions.update(stripeSubId, {
          pause_collection: null,
        });

        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "active",
            paused_at: null,
          })
          .eq("id", subscription.id);

        return NextResponse.json({
          ok: true,
          message: "구독이 재개되었습니다.",
          subscription: { status: "active" },
        });

      case "cancel":
        // Cancel at period end (user can still use until period ends)
        result = await stripe.subscriptions.update(stripeSubId, {
          cancel_at_period_end: true,
        });

        await supabaseAdmin
          .from("subscriptions")
          .update({
            cancel_at_period_end: true,
            canceled_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        return NextResponse.json({
          ok: true,
          message: "구독이 다음 결제일에 취소됩니다.",
          subscription: {
            status: subscription.status,
            cancel_at_period_end: true,
          },
        });

      case "reactivate":
        // Reactivate a subscription that was set to cancel
        result = await stripe.subscriptions.update(stripeSubId, {
          cancel_at_period_end: false,
        });

        await supabaseAdmin
          .from("subscriptions")
          .update({
            cancel_at_period_end: false,
            canceled_at: null,
          })
          .eq("id", subscription.id);

        return NextResponse.json({
          ok: true,
          message: "구독 취소가 철회되었습니다.",
          subscription: {
            status: subscription.status,
            cancel_at_period_end: false,
          },
        });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[SUBSCRIPTION]", error);
    return NextResponse.json(
      { error: error?.message || "Internal Error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stripe/subscription
 * 구독 즉시 취소 (환불 없음)
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's subscription
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["active", "paused", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    const stripeSubId = subscription.stripe_subscription_id;
    if (!stripeSubId) {
      return NextResponse.json(
        { error: "Subscription not linked to Stripe" },
        { status: 400 }
      );
    }

    // Cancel immediately
    await stripe.subscriptions.cancel(stripeSubId);

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    // Reset user level
    await supabaseAdmin
      .from("profiles")
      .update({ user_level: 1 })
      .eq("id", user.id);

    return NextResponse.json({
      ok: true,
      message: "구독이 즉시 취소되었습니다.",
    });
  } catch (error: any) {
    console.error("[SUBSCRIPTION]", error);
    return NextResponse.json(
      { error: error?.message || "Internal Error" },
      { status: 500 }
    );
  }
}

