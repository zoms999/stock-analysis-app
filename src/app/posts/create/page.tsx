"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { 
  ArrowLeft, 
  Save, 
  LineChart, 
  Image as ImageIcon,
  X,
  Search,
  Loader2,
  BarChart2
} from "lucide-react";
import { createPost } from "@/lib/api/posts";
import { toast } from "sonner";
import { LimitPopup } from "@/components/subscription/LimitPopup";
import { ChartInsertModal } from "@/components/posts/ChartInsertModal";
import { RichPostEditor } from "@/components/posts/RichPostEditor";
import type { Time } from "lightweight-charts";

interface InsertedChart {
  id: string;
  symbol: string;
  interval: string;
  chartStyle: "candle" | "line";
  imageUrl: string;
  predictionPoints: Array<{ time: Time; value: number }>;
}

export default function CreatePostPage() {
  const router = useRouter();
  
  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [insertedCharts, setInsertedCharts] = useState<InsertedChart[]>([]);
  
  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [showLimitPopup, setShowLimitPopup] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);

  // Handle chart insertion from modal
  const handleChartInsert = useCallback((chart: InsertedChart) => {
    setInsertedCharts(prev => [...prev, chart]);
    setShowChartModal(false);
    toast.success(`${chart.symbol} 차트가 추가되었습니다.`);
  }, []);

  // Remove inserted chart
  const handleRemoveChart = useCallback((chartId: string) => {
    setInsertedCharts(prev => prev.filter(c => c.id !== chartId));
  }, []);

  // Helper: Upload chart image to Supabase Storage
  const uploadChartImage = async (
    supabase: Awaited<ReturnType<typeof import("@/lib/supabase/client").createClient>>,
    imageUrl: string
  ): Promise<string | null> => {
    if (!imageUrl) return null;
    
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const fileName = `chart_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('charts')
        .upload(fileName, blob, {
          contentType: 'image/png',
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error("Chart upload error:", uploadError);
        return null;
      }

      if (uploadData) {
        const { data: { publicUrl } } = supabase.storage
          .from('charts')
          .getPublicUrl(uploadData.path);
        return publicUrl;
      }
    } catch (err) {
      console.error("Chart image upload error:", err);
    }
    return null;
  };

  // Save post
  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("제목을 입력해주세요.");
      return;
    }
    if (!content.trim() && insertedCharts.length === 0) {
      toast.error("내용을 입력하거나 차트를 추가해주세요.");
      return;
    }

    try {
      setIsSaving(true);

      // Upload chart images to Supabase Storage
      const supabase = (await import("@/lib/supabase/client")).createClient();
      let primaryChartImageUrl = "";
      let primarySymbol = "";
      let primaryChartConfig = {};

      if (insertedCharts.length > 0) {
        const firstChart = insertedCharts[0];
        primarySymbol = firstChart.symbol;
        primaryChartConfig = {
          interval: firstChart.interval,
          prediction_points: firstChart.predictionPoints,
          chart_style: firstChart.chartStyle,
        };

        // Upload first chart image
        const uploadedUrl = await uploadChartImage(supabase, firstChart.imageUrl);
        if (uploadedUrl) {
          primaryChartImageUrl = uploadedUrl;
        }
      }

      // Build content with embedded chart references
      let finalContent = content;
      
      // Upload and add chart references for additional charts
      if (insertedCharts.length > 1) {
        const additionalCharts = insertedCharts.slice(1);
        const chartRefs: string[] = [];
        
        for (let idx = 0; idx < additionalCharts.length; idx++) {
          const chart = additionalCharts[idx];
          // Upload each additional chart image to Storage
          const uploadedUrl = await uploadChartImage(supabase, chart.imageUrl);
          
          if (uploadedUrl) {
            chartRefs.push(
              `\n\n---\n### 추가 차트 ${idx + 2}: ${chart.symbol}\n![${chart.symbol} 차트](${uploadedUrl})`
            );
          } else {
            // Fallback: just mention the chart without image if upload failed
            chartRefs.push(
              `\n\n---\n### 추가 차트 ${idx + 2}: ${chart.symbol}\n*(차트 이미지 업로드 실패)*`
            );
          }
        }
        
        finalContent += chartRefs.join('');
      }

      await createPost({
        title: title.trim(),
        content: finalContent,
        ticker_symbol: primarySymbol || "GENERAL",
        chart_config: primaryChartConfig,
        chart_image_url: primaryChartImageUrl,
      });

      toast.success("게시글이 저장되었습니다.");
      router.push("/posts");
    } catch (error: any) {
      console.error("Save error:", error);
      if (error?.code === "LIMIT_REACHED" || error?.message?.includes("한도를 초과")) {
        setShowLimitPopup(true);
      } else {
        toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl py-6 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">새 글 작성</h1>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "저장 중..." : "게시하기"}
          </Button>
        </div>

        {/* Title Input */}
        <div>
          <Input
            placeholder="제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-semibold h-14 bg-card border-border"
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 p-2 bg-card rounded-lg border border-border">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setShowChartModal(true)}
          >
            <LineChart className="h-4 w-4" />
            차트 추가
          </Button>
          <div className="h-6 w-px bg-border" />
          <span className="text-xs text-muted-foreground">
            차트를 추가하여 분석 게시글을 작성하세요
          </span>
        </div>

        {/* Inserted Charts Preview */}
        {insertedCharts.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              첨부된 차트 ({insertedCharts.length}개)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insertedCharts.map((chart, index) => (
                <Card key={chart.id} className="relative overflow-hidden">
                  <button
                    onClick={() => handleRemoveChart(chart.id)}
                    className="absolute top-2 right-2 z-10 p-1 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                  <div className="aspect-video bg-muted">
                    {chart.imageUrl ? (
                      <img
                        src={chart.imageUrl}
                        alt={`${chart.symbol} 차트`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BarChart2 className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{chart.symbol}</span>
                      <span className="text-xs text-muted-foreground">
                        {chart.interval === "D" && "일봉"}
                        {chart.interval === "W" && "주봉"}
                        {chart.interval === "M" && "월봉"}
                        {chart.interval === "Y" && "연봉"}
                        {chart.interval === "60" && "60분봉"}
                        {chart.interval === "1" && "1분봉"}
                      </span>
                    </div>
                    {index === 0 && (
                      <span className="text-xs text-blue-500">대표 차트</span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Content Editor */}
        <RichPostEditor
          content={content}
          onChange={setContent}
          placeholder="분석 내용을 작성해주세요..."
        />

        {/* Bottom Action Bar */}
        <div className="flex justify-between items-center pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {insertedCharts.length > 0 && (
              <span>✓ 차트 {insertedCharts.length}개 첨부됨</span>
            )}
          </div>
          <Button
            size="lg"
            className="gap-2 font-semibold px-10 bg-blue-600 hover:bg-blue-700"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="h-4 w-4" />
            {isSaving ? "저장 중..." : "게시하기"}
          </Button>
        </div>
      </div>

      {/* Chart Insert Modal */}
      <ChartInsertModal
        isOpen={showChartModal}
        onClose={() => setShowChartModal(false)}
        onInsert={handleChartInsert}
      />

      {/* Limit Popup */}
      <LimitPopup
        isOpen={showLimitPopup}
        onClose={() => setShowLimitPopup(false)}
        type="WRITE"
        onSuccess={() => {
          toast.success("포인트가 사용되었습니다. 다시 저장을 눌러주세요.");
          setShowLimitPopup(false);
        }}
      />
    </div>
  );
}

