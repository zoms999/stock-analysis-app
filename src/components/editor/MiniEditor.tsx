"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LineChart, Image as ImageIcon, Send, Loader2, X } from "lucide-react";
import { ChartInsertModal } from "@/components/posts/ChartInsertModal";
import { createPost } from "@/lib/api/posts";
import { toast } from "sonner";
import type { Time } from "lightweight-charts";

interface InsertedChart {
  id: string;
  symbol: string;
  interval: string;
  chartStyle: "candle" | "line";
  imageUrl: string;
  predictionPoints: Array<{ time: Time; value: number }>;
}

interface MiniEditorProps {
  /** 현재 보고 있는 심볼 (있으면 기본값으로 사용) */
  defaultSymbol?: string;
  /** 작성 완료 후 콜백 */
  onSuccess?: () => void;
}

export function MiniEditor({ defaultSymbol, onSuccess }: MiniEditorProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [attachedChart, setAttachedChart] = useState<InsertedChart | null>(null);
  const [showChartModal, setShowChartModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChartInsert = useCallback((chart: InsertedChart) => {
    setAttachedChart(chart);
    setShowChartModal(false);
    toast.success(`${chart.symbol} 차트가 첨부되었습니다.`);
  }, []);

  const handleRemoveChart = useCallback(() => {
    setAttachedChart(null);
  }, []);

  const handleSubmit = async () => {
    if (!content.trim() && !attachedChart) {
      toast.error("내용을 입력하거나 차트를 첨부해주세요.");
      return;
    }

    try {
      setIsSubmitting(true);

      let chartImageUrl = "";
      let chartConfig = {};
      let tickerSymbol = "GENERAL";

      if (attachedChart) {
        tickerSymbol = attachedChart.symbol;
        chartConfig = {
          interval: attachedChart.interval,
          prediction_points: attachedChart.predictionPoints,
          chart_style: attachedChart.chartStyle,
        };

        // Upload chart image
        if (attachedChart.imageUrl) {
          try {
            const supabase = (await import("@/lib/supabase/client")).createClient();
            const response = await fetch(attachedChart.imageUrl);
            const blob = await response.blob();
            const fileName = `chart_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('charts')
              .upload(fileName, blob, {
                contentType: 'image/png',
                cacheControl: '3600',
              });

            if (!uploadError && uploadData) {
              const { data: { publicUrl } } = supabase.storage
                .from('charts')
                .getPublicUrl(uploadData.path);
              chartImageUrl = publicUrl;
            }
          } catch (err) {
            console.error("Chart upload error:", err);
          }
        }
      }

      await createPost({
        title: attachedChart ? `${attachedChart.symbol} 차트 분석` : "차트 분석",
        content: content.trim(),
        ticker_symbol: tickerSymbol,
        chart_config: chartConfig,
        chart_image_url: chartImageUrl,
      });

      toast.success("분석이 등록되었습니다.");
      setContent("");
      setAttachedChart(null);
      onSuccess?.();
      router.refresh();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error instanceof Error ? error.message : "등록에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="bg-secondary/30 px-4 py-2 flex items-center justify-between border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            빠른 차트 분석
          </span>
          <div className="flex space-x-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6" 
              title="차트 첨부"
              onClick={() => setShowChartModal(true)}
            >
              <LineChart className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Attached Chart Preview */}
        {attachedChart && (
          <div className="p-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="w-20 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
                {attachedChart.imageUrl ? (
                  <img
                    src={attachedChart.imageUrl}
                    alt={attachedChart.symbol}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <LineChart className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{attachedChart.symbol}</div>
                <div className="text-xs text-muted-foreground">
                  {attachedChart.interval === "D" && "일봉"}
                  {attachedChart.interval === "W" && "주봉"}
                  {attachedChart.interval === "M" && "월봉"}
                  {attachedChart.interval === "Y" && "연봉"}
                  {attachedChart.interval === "60" && "60분봉"}
                  {attachedChart.interval === "1" && "1분봉"}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={handleRemoveChart}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="p-4">
          <textarea 
            className="w-full bg-transparent text-sm min-h-[100px] resize-none focus:outline-none placeholder:text-muted-foreground/50" 
            placeholder="현재 차트에 대한 관점을 공유해주세요..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isSubmitting}
          />
          <div className="flex justify-between items-center mt-2">
            <div className="text-xs text-muted-foreground">
              {attachedChart && <span className="text-green-500">✓ 차트 첨부됨</span>}
            </div>
            <Button 
              size="sm" 
              className="gap-1.5 bg-blue-600 hover:bg-blue-700"
              onClick={handleSubmit}
              disabled={isSubmitting || (!content.trim() && !attachedChart)}
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {isSubmitting ? "등록 중..." : "분석글 등록"}
            </Button>
          </div>
        </div>
      </div>

      <ChartInsertModal
        isOpen={showChartModal}
        onClose={() => setShowChartModal(false)}
        onInsert={handleChartInsert}
      />
    </>
  );
}
