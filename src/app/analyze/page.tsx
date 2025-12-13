"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Search, Save } from "lucide-react";
import { ChartAnalyzer } from "@/components/analyze/ChartAnalyzer";
import { createPost } from "@/lib/api/posts";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function AnalyzePage() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("BTC-USD");
  const [interval, setInterval] = useState("D"); // D, W, M, 60, 240, 1 etc.
  const [content, setContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [points, setPoints] = useState<any[]>([]); // Prediction points
  const [isSaving, setIsSaving] = useState(false);
  const [chartImageUrl, setChartImageUrl] = useState<string>("");
  const chartAnalyzerRef = useRef<any>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
        setSymbol(searchQuery.toUpperCase());
    }
  };

  const activeIntervals = [
      { label: "년", value: "Y" },
      { label: "월", value: "M" },
      { label: "주", value: "W" },
      { label: "일", value: "D" },
      { label: "시", value: "60" }, // 60 min
      { label: "분", value: "1" }, // 1 min
  ];

  const handleSave = async () => {
      if (!content.trim()) {
          toast.error("본문 내용을 입력해주세요.");
          return;
      }
      
      try {
          setIsSaving(true);
          
          // Upload chart image if available
          let uploadedImageUrl = "";
          if (chartImageUrl) {
              const supabase = (await import("@/lib/supabase/client")).createClient();
              
              // Convert data URL to blob
              const response = await fetch(chartImageUrl);
              const blob = await response.blob();
              
              // Upload to Supabase storage
              const fileName = `chart_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
              const { data: uploadData, error: uploadError } = await supabase.storage
                  .from('charts')
                  .upload(fileName, blob, {
                      contentType: 'image/png',
                      cacheControl: '3600',
                  });

              if (uploadError) {
                  console.error("Image upload error:", uploadError);
              } else if (uploadData) {
                  // Get public URL
                  const { data: { publicUrl } } = supabase.storage
                      .from('charts')
                      .getPublicUrl(uploadData.path);
                  uploadedImageUrl = publicUrl;
              }
          }
          
          await createPost({
            title: `${symbol} 차트 분석`, // Auto-title for now
            content: content,
            ticker_symbol: symbol,
            chart_config: {
                interval: interval,
                prediction_points: points,
            },
            chart_image_url: uploadedImageUrl,
          });
          
          toast.success("분석이 저장되었습니다.");
          router.push("/"); // Redirect to home/feed
      } catch (error: any) {
          console.error("Save error:", error);
          toast.error(error.message || "저장에 실패했습니다.");
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="container mx-auto max-w-5xl py-8 space-y-6">
      {/* 1. Search Bar */}
      <div className="flex justify-center">
        <form onSubmit={handleSearch} className="relative w-full max-w-lg">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="찾기 (Ctrl+K)" 
            className="pl-10 h-11 text-lg rounded-full bg-secondary/50 border-input/50 focus-visible:ring-primary/30"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      {/* 2. Interval Tabs */}
      <div className="flex justify-center">
        <Tabs defaultValue="D" onValueChange={setInterval} className="w-full max-w-md">
            <TabsList className="grid w-full grid-cols-6 bg-transparent h-auto p-0 gap-2">
                {activeIntervals.map((item) => (
                    <TabsTrigger 
                        key={item.value} 
                        value={item.value}
                        className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {item.label}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
      </div>

      {/* 3. Main Chart Area */}
      <Card className="p-1 border border-border shadow-sm overflow-hidden bg-card">
        <div className="p-4 border-b border-border/50 flex justify-between items-center">
            <h2 className="font-bold text-lg">{symbol} Price</h2>
            <div className="text-xs text-muted-foreground">
                {/* Additional Info could go here */}
            </div>
        </div>
        <div className="h-[500px] w-full relative">
            <ChartAnalyzer 
                symbol={symbol} 
                interval={interval} 
                onPointsChange={setPoints}
                onChartCapture={setChartImageUrl}
            />
        </div>
      </Card>

      {/* 4. Text Editor Area */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <Textarea 
                placeholder="본문내용 글쓰기" 
                className="min-h-[200px] text-lg border-none focus-visible:ring-0 resize-none p-4 bg-transparent"
                value={content}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
            />
        </div>
        
        <div className="flex justify-end">
            <Button size="lg" className="gap-2 font-bold px-8" onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4" />
                {isSaving ? "저장 중..." : "저장하기"}
            </Button>
        </div>
      </div>
    </div>
  );
}
