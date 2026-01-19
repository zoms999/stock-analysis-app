"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";
import { toast } from "sonner"; // Assuming sonner is used, or alerts

export function SyncPriceButton() {
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const handleSync = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/cron/update-prices", {
        credentials: 'include'
      });
      const data = await response.json();

      if (response.ok) {
        setLastSync(new Date());
        toast.success(`가격 동기화 완료: ${data.data?.updated || 0}개 업데이트`);
        // Optional: Reload window or invalidate cache if needed
        // window.location.reload(); 
      } else {
        throw new Error(data.message || "Failed to sync");
      }
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error("동기화 실패: 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button 
        onClick={handleSync} 
        disabled={loading}
        variant="outline"
        size="sm"
        className="gap-2 border-primary/20 hover:bg-primary/5"
      >
        <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "동기화 중..." : "실시간 시세 동기화"}
      </Button>
      {lastSync && (
        <span className="text-xs text-muted-foreground hidden sm:inline-block">
          마지막: {lastSync.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
