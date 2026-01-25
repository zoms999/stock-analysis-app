"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { toast } from "sonner";

export function UpdateHistoryButton() {
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/cron/update-history?days=5", {
        method: "GET",
      });
      const data = await response.json();

      if (response.ok) {
        setLastSync(new Date());
        // data.data might contain { updated: number, failed: number }
        const updatedCount = data.data?.updated || 0;
        toast.success(`과거 데이터 업데이트 완료: ${updatedCount}개`);
      } else {
        throw new Error(data.message || "Failed to update history");
      }
    } catch (error) {
      console.error("History update failed:", error);
      toast.error("업데이트 실패: 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button 
        onClick={handleUpdate} 
        disabled={loading}
        variant="outline"
        size="sm"
        className="gap-2 border-primary/20 hover:bg-primary/5"
      >
        <History className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "업데이트 중..." : "5일 종가 업데이트"}
      </Button>
      {lastSync && (
        <span className="text-xs text-muted-foreground hidden sm:inline-block">
          마지막: {lastSync.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
