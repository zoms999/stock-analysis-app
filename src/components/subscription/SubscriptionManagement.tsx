"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Pause, 
  Play, 
  XCircle, 
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

interface SubscriptionManagementProps {
  subscription: {
    id: string;
    status: string;
    plan_id: number;
    current_period_end: string;
    cancel_at_period_end?: boolean;
    paused_at?: string | null;
    plans?: {
      name: string;
      price: number;
    };
  } | null;
  onUpdate?: () => void;
}

export function SubscriptionManagement({ subscription, onUpdate }: SubscriptionManagementProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: "pause" | "resume" | "cancel" | "reactivate") => {
    try {
      setLoading(action);

      const res = await fetch("/api/stripe/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "요청 처리에 실패했습니다.");
      }

      toast.success(data.message);
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.message || "오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  };

  const handleImmediateCancel = async () => {
    try {
      setLoading("immediate_cancel");

      const res = await fetch("/api/stripe/subscription", {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "취소 처리에 실패했습니다.");
      }

      toast.success(data.message);
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.message || "오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  };

  const handleManagePayment = async () => {
    try {
      setLoading("manage_payment");

      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ return_url: window.location.href }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "결제 관리 페이지를 열 수 없습니다.");
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    } catch (error: any) {
      toast.error(error.message || "오류가 발생했습니다.");
      setLoading(null);
    }
  };

  if (!subscription) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <p>활성화된 구독이 없습니다.</p>
        </div>
      </Card>
    );
  }

  const isPaused = subscription.status === "paused";
  const isCanceling = subscription.cancel_at_period_end;
  const isPastDue = subscription.status === "past_due";
  const isUnpaid = subscription.status === "unpaid";
  const periodEnd = new Date(subscription.current_period_end);
  const isActive = subscription.status === "active" && !isCanceling;
  const hasPaymentIssue = isPastDue || isUnpaid;

  return (
    <Card className="p-6 space-y-6">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">구독 관리</h3>
          <p className="text-sm text-muted-foreground">
            {subscription.plans?.name || "구독"} 플랜
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="flex items-center gap-1.5 text-sm text-green-500">
              <CheckCircle className="h-4 w-4" />
              활성
            </span>
          )}
          {isPaused && (
            <span className="flex items-center gap-1.5 text-sm text-yellow-500">
              <Pause className="h-4 w-4" />
              일시정지
            </span>
          )}
          {isCanceling && (
            <span className="flex items-center gap-1.5 text-sm text-orange-500">
              <Clock className="h-4 w-4" />
              취소 예정
            </span>
          )}
          {isPastDue && (
            <span className="flex items-center gap-1.5 text-sm text-red-500">
              <AlertTriangle className="h-4 w-4" />
              결제 실패
            </span>
          )}
          {isUnpaid && (
            <span className="flex items-center gap-1.5 text-sm text-red-500">
              <AlertTriangle className="h-4 w-4" />
              미결제
            </span>
          )}
        </div>
      </div>

      {/* Payment Issue Alert */}
      {hasPaymentIssue && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-500">결제 문제가 발생했습니다</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isPastDue 
                  ? "최근 결제가 실패했습니다. 결제 수단을 확인하고 업데이트해주세요."
                  : "결제가 완료되지 않았습니다. 새로운 결제 수단을 등록해주세요."}
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="mt-3 gap-2"
                onClick={handleManagePayment}
                disabled={loading !== null}
              >
                {loading === "manage_payment" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                결제 수단 업데이트
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Period Info */}
      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-sm">
          {isCanceling ? (
            <>
              <span className="text-orange-500 font-medium">
                {periodEnd.toLocaleDateString("ko-KR")}
              </span>
              에 구독이 종료됩니다.
            </>
          ) : (
            <>
              다음 결제일:{" "}
              <span className="font-medium">
                {periodEnd.toLocaleDateString("ko-KR")}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {/* Manage Payment Method */}
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleManagePayment}
          disabled={loading !== null}
        >
          {loading === "manage_payment" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          결제 수단 관리
          <ExternalLink className="h-3 w-3" />
        </Button>

        {/* Pause/Resume */}
        {isActive && !isPaused && (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => handleAction("pause")}
            disabled={loading !== null}
          >
            {loading === "pause" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
            일시정지
          </Button>
        )}

        {isPaused && (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => handleAction("resume")}
            disabled={loading !== null}
          >
            {loading === "resume" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            재개하기
          </Button>
        )}

        {/* Cancel/Reactivate */}
        {isActive && !isCanceling && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-2 text-orange-500 hover:text-orange-600">
                <XCircle className="h-4 w-4" />
                구독 취소
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>구독을 취소하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  구독을 취소하면 {periodEnd.toLocaleDateString("ko-KR")}까지 
                  서비스를 이용할 수 있으며, 이후 자동으로 무료 플랜으로 전환됩니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleAction("cancel")}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  구독 취소
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {isCanceling && (
          <Button
            variant="outline"
            className="gap-2 text-green-500 hover:text-green-600"
            onClick={() => handleAction("reactivate")}
            disabled={loading !== null}
          >
            {loading === "reactivate" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            취소 철회
          </Button>
        )}
      </div>

      {/* Immediate Cancel (Dangerous) */}
      {(isActive || isPaused) && (
        <div className="pt-4 border-t border-border">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <AlertTriangle className="h-4 w-4" />
                즉시 해지
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive">
                  즉시 해지하시겠습니까?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="text-destructive font-medium">주의:</span> 즉시 해지하면 
                  남은 구독 기간에 대한 환불이 제공되지 않으며, 바로 무료 플랜으로 전환됩니다.
                  <br /><br />
                  "구독 취소"를 선택하면 결제 기간 종료까지 서비스를 이용할 수 있습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleImmediateCancel}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {loading === "immediate_cancel" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  즉시 해지
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </Card>
  );
}

