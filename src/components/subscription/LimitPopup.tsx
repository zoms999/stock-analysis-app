import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getUserPoints } from "@/lib/api/points";
import { purchaseAdditionalView, purchaseAdditionalWrite } from "@/lib/api/subscription";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface LimitPopupProps {
  isOpen: boolean;
  onClose: () => void;
  type: "VIEW" | "WRITE";
  onSuccess: () => void; // Callback to retry the action (e.g., reload page or re-submit)
}

export function LimitPopup({ isOpen, onClose, type, onSuccess }: LimitPopupProps) {
  const router = useRouter();
  const [points, setPoints] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  // Load user points when popup opens
  useEffect(() => {
    if (isOpen) {
      loadPoints();
    }
  }, [isOpen]);

  const loadPoints = async () => {
    setLoading(true);
    try {
        // We need the user ID. Since this is a client component, we might expect it to be passed
        // or we fetch it. For simplicity, let's assume we can fetch it or points API handles current user session?
        // Wait, getUserPoints in api/points.ts takes userId.
        // We need to get the current user ID here.
        // Since getting auth user in client component is async, let's try to get it.
        // ACTUALLY: typically getUserPoints might need to be wrapped in a server action or API route 
        // if we want to secure it, but for now let's assume we fetch from our API wrapper which uses supabase client.
        
        // Let's get the user ID first
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            const balance = await getUserPoints(user.id);
            setPoints(balance);
        }
    } catch (e) {
      console.error("Failed to load points", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    setPurchaseLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      if (type === "VIEW") {
        await purchaseAdditionalView(user.id);
      } else {
        await purchaseAdditionalWrite(user.id);
      }

      // Success
      onSuccess();
      onClose();
    } catch (e: any) {
      alert(e.message || "구매에 실패했습니다.");
    } finally {
      setPurchaseLoading(false);
    }
  };

  const cost = type === "VIEW" ? 100 : 200;
  const title = type === "VIEW" ? "일일 열람 한도 초과" : "일일 글쓰기 한도 초과";
  const description = type === "VIEW" 
    ? `무료 회원은 하루 3회까지 열람할 수 있습니다.\n포인트를 사용하여 계속 보시겠습니까?`
    : `무료 회원은 하루 5회까지 글을 작성할 수 있습니다.\n포인트를 사용하여 계속 쓰시겠습니까?`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap pt-2">
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 py-4">
            <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/50">
                <span className="text-sm font-medium">보유 포인트</span>
                <span className="font-bold text-primary">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `${points?.toLocaleString() ?? 0} P`}
                </span>
            </div>
            
            <div className="text-sm text-center text-muted-foreground">
                추가 이용에는 <span className="font-bold text-foreground">{cost} P</span>가 필요합니다.
            </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => router.push("/subscription")}>
            구독하고 무제한 이용하기
          </Button>
          <Button onClick={handlePurchase} disabled={purchaseLoading || (points !== null && points < cost)}>
            {purchaseLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "포인트로 이용하기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
