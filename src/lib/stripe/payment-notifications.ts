/**
 * Payment Notification Utilities
 * 결제 관련 알림 처리
 */

import { createClient } from "@supabase/supabase-js";

interface PaymentNotificationData {
  userId: string;
  subscriptionId: string;
  type: "payment_failed" | "payment_succeeded" | "subscription_canceled" | "refund_processed";
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * 결제 알림을 point_transactions 테이블에 기록
 * (실제 이메일 발송은 추후 구현 가능)
 */
export async function createPaymentNotification(data: PaymentNotificationData) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.from("point_transactions").insert({
    user_id: data.userId,
    amount: 0,
    reason: data.message,
    type: "ADMIN",
    metadata: {
      notification_type: data.type,
      subscription_id: data.subscriptionId,
      ...data.metadata,
    },
  });

  if (error) {
    console.error("[NOTIFICATION] Failed to create notification:", error);
    return { ok: false, error };
  }

  return { ok: true };
}

/**
 * 결제 실패 시 알림 생성
 */
export async function notifyPaymentFailed(
  userId: string,
  subscriptionId: string,
  attemptCount: number
) {
  let message: string;

  if (attemptCount === 1) {
    message = "구독 결제가 실패했습니다. 카드 정보를 확인해주세요.";
  } else if (attemptCount === 2) {
    message = `구독 결제가 ${attemptCount}회 실패했습니다. 다른 결제 수단을 등록해주세요.`;
  } else {
    message = `구독 결제가 ${attemptCount}회 실패했습니다. 서비스 이용이 제한될 수 있습니다.`;
  }

  return createPaymentNotification({
    userId,
    subscriptionId,
    type: "payment_failed",
    message,
    metadata: { attempt_count: attemptCount },
  });
}

/**
 * 구독 취소 알림 생성
 */
export async function notifySubscriptionCanceled(
  userId: string,
  subscriptionId: string,
  endDate: string
) {
  return createPaymentNotification({
    userId,
    subscriptionId,
    type: "subscription_canceled",
    message: `구독이 취소되었습니다. ${new Date(endDate).toLocaleDateString("ko-KR")}까지 서비스를 이용하실 수 있습니다.`,
    metadata: { end_date: endDate },
  });
}

/**
 * 환불 완료 알림 생성
 */
export async function notifyRefundProcessed(
  userId: string,
  subscriptionId: string,
  amount: number,
  currency: string
) {
  return createPaymentNotification({
    userId,
    subscriptionId,
    type: "refund_processed",
    message: `${amount.toLocaleString()} ${currency.toUpperCase()} 환불이 완료되었습니다.`,
    metadata: { refund_amount: amount, currency },
  });
}

/**
 * Stripe Customer Portal 세션 생성
 * 사용자가 결제 수단을 직접 업데이트할 수 있는 포털 링크
 */
export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
) {
  const { stripe } = await import("./client");

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return { ok: true, url: session.url };
  } catch (error: any) {
    console.error("[PORTAL] Failed to create portal session:", error);
    return { ok: false, error: error.message };
  }
}

/**
 * 결제 재시도 안내 메시지 생성
 */
export function getRetryGuidanceMessage(attemptCount: number): string {
  if (attemptCount <= 1) {
    return "결제가 실패했습니다. 카드 한도, 잔액, 유효기간을 확인해주세요.";
  } else if (attemptCount === 2) {
    return "결제가 다시 실패했습니다. 다른 카드를 등록하시거나 카드사에 문의해주세요.";
  } else {
    return "결제가 여러 번 실패했습니다. 고객센터에 문의하시거나 새로운 결제 수단을 등록해주세요.";
  }
}


