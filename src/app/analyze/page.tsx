"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Search, Save, BarChart2, LineChart } from "lucide-react";
import { ChartAnalyzer } from "@/components/analyze/ChartAnalyzer";
import { createPost } from "@/lib/api/posts";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Time } from "lightweight-charts";
import { LimitPopup } from "@/components/subscription/LimitPopup";

interface PredictionPoint {
    time: Time;
    value: number;
}

export default function AnalyzePage() {
    const router = useRouter();
    const [symbol, setSymbol] = useState("BTC-USD");
    const [interval, setInterval] = useState("D");
    const [chartStyle, setChartStyle] = useState<"candle" | "line">("line");
    const [content, setContent] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [points, setPoints] = useState<PredictionPoint[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [chartImageUrl, setChartImageUrl] = useState<string>("");

    const [showLimitPopup, setShowLimitPopup] = useState(false);

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
        { label: "시", value: "60" },
        { label: "분", value: "1" },
    ];

    const handleSave = async () => {
        if (!content.trim()) {
            toast.error("본문 내용을 입력해주세요.");
            return;
        }

        try {
            setIsSaving(true);

            let uploadedImageUrl = "";
            if (chartImageUrl) {
                const supabase = (await import("@/lib/supabase/client")).createClient();
                const response = await fetch(chartImageUrl);
                const blob = await response.blob();

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
                    const { data: { publicUrl } } = supabase.storage
                        .from('charts')
                        .getPublicUrl(uploadData.path);
                    uploadedImageUrl = publicUrl;
                }
            }

            await createPost({
                title: `${symbol} 차트 분석`,
                content: content,
                ticker_symbol: symbol,
                chart_config: {
                    interval: interval,
                    prediction_points: points,
                },
                chart_image_url: uploadedImageUrl,
            });

            toast.success("분석이 저장되었습니다.");
            router.push("/");
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
            <div className="container mx-auto max-w-6xl py-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-foreground">차트 분석</h1>
                </div>

                {/* 1. Search Bar */}
                <div className="space-y-2">
                    <div className="flex justify-center">
                        <form onSubmit={handleSearch} className="relative w-full max-w-2xl">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                placeholder="종목 검색 (예: BTC-USD, AAPL, TSLA)"
                                className="pl-12 h-12 text-base rounded-lg bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-blue-500 focus-visible:border-blue-500 shadow-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </form>
                    </div>
                    <div className="text-center text-xs text-muted-foreground">
                        💡 암호화폐: BTC-USD, ETH-USD | 미국 주식: AAPL, TSLA, GOOGL | 한국 주식: 005930.KS (삼성전자)
                    </div>
                </div>

                {/* 2. Intervals moved to Chart Header */}

                {/* 3. Main Chart Area */}
                <Card className="border border-border shadow-sm overflow-hidden bg-card">
                    <div className="px-4 py-2 border-b border-border flex flex-col sm:flex-row justify-between items-center bg-muted/30 gap-4">
                        <div className="flex items-center gap-3">
                            <h2 className="font-bold text-lg text-foreground">{symbol}</h2>
                            <span className="text-sm text-muted-foreground mr-2">
                                {interval === "Y" && "연봉"}
                                {interval === "M" && "월봉"}
                                {interval === "W" && "주봉"}
                                {interval === "D" && "일봉"}
                                {interval === "60" && "60분봉"}
                                {interval === "1" && "1분봉"}
                            </span>
                            {(interval === "1" || interval === "60") && (
                                <span className="text-xs text-amber-500 hidden sm:inline-block">
                                    ⚠️ {interval === "1" ? "최근 7일" : "최근 60일"}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Tabs value={interval} onValueChange={setInterval} className="w-full sm:w-auto">
                                <TabsList className="bg-background border border-border h-8 p-0.5">
                                    {activeIntervals.map((item) => (
                                        <TabsTrigger
                                            key={item.value}
                                            value={item.value}
                                            className="text-xs px-3 h-7 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-sm"
                                        >
                                            {item.label}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>

                            <div className="flex items-center bg-card border border-border rounded-lg p-0.5 h-8">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-7 px-2 rounded-sm ${chartStyle === 'candle' ? 'bg-blue-600 text-white hover:bg-blue-700 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
                                    onClick={() => setChartStyle('candle')}
                                >
                                    <BarChart2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-7 px-2 rounded-sm ${chartStyle === 'line' ? 'bg-blue-600 text-white hover:bg-blue-700 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
                                    onClick={() => setChartStyle('line')}
                                >
                                    <LineChart className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div className="h-[550px] w-full relative">
                        <ChartAnalyzer
                            symbol={symbol}
                            interval={interval}
                            chartStyle={chartStyle}
                            onPointsChange={setPoints}
                            onChartCapture={setChartImageUrl}
                        />
                    </div>
                </Card>

                {/* 4. Text Editor Area */}
                <div className="space-y-4">
                    <Card className="border border-border shadow-sm bg-card">
                        <div className="px-6 py-3 border-b border-border bg-muted/50">
                            <h3 className="font-semibold text-foreground">분석 내용</h3>
                        </div>
                        <div className="p-6">
                            <Textarea
                                placeholder="차트 분석 내용을 작성해주세요..."
                                className="min-h-[200px] text-base bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-blue-500 resize-none"
                                value={content}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
                            />
                        </div>
                    </Card>

                    <div className="flex justify-between items-center">
                        <div className="text-sm text-muted-foreground">
                            {chartImageUrl && "✓ 차트 이미지 캡처됨"}
                        </div>
                        <Button
                            size="lg"
                            className="gap-2 font-semibold px-10 bg-blue-600 hover:bg-blue-700"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            <Save className="h-4 w-4" />
                            {isSaving ? "저장 중..." : "분석 저장"}
                        </Button>
                    </div>
                </div>
            </div>

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
