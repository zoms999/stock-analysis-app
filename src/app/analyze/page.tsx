"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Search, Save, BarChart2, LineChart } from "lucide-react";
import { ChartAnalyzer } from "@/components/analyze/ChartAnalyzer";
import { createPost } from "@/lib/api/posts";
import { searchSymbol, type SearchResult } from "@/lib/api/search";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Time } from "lightweight-charts";
import { LimitPopup } from "@/components/subscription/LimitPopup";
import { getKoreanName } from "@/lib/constants/krx_names";

interface PredictionPoint {
    time: Time;
    value: number;
}

export default function AnalyzePage() {
    const router = useRouter();
    const [symbol, setSymbol] = useState<string | null>(null);
    const [symbolInfo, setSymbolInfo] = useState<SearchResult | null>(null);
    const [interval, setInterval] = useState("D");
    const [chartStyle, setChartStyle] = useState<"candle" | "line">("line");
    const [content, setContent] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [points, setPoints] = useState<PredictionPoint[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [chartImageUrl, setChartImageUrl] = useState<string>("");
    const krName = symbol ? getKoreanName(symbol) : null;

    const [showLimitPopup, setShowLimitPopup] = useState(false);

    // ✅ 모바일에서는 기본을 "일(일봉)"로 고정
    useEffect(() => {
        if (typeof window === "undefined") return;
        const isMobile = window.matchMedia("(max-width: 640px)").matches;
        if (isMobile) setInterval("D");
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const q = searchQuery.trim();
        if (!q) return;

        // 이미 티커처럼 보이는 입력(ASCII 위주)은 실패 시 폴백으로 사용
        const looksLikeTicker = /^[A-Za-z0-9.^=_-]{1,32}$/.test(q);

        try {
            setIsSearching(true);

            const resolved = await searchSymbol(q);
            if (resolved) {
                setSymbol(resolved.symbol.toUpperCase());
                setSymbolInfo(resolved);
                return;
            }

            if (looksLikeTicker) {
                // 검색이 실패해도 사용자가 티커를 직접 입력했을 가능성이 높으므로 그대로 시도
                setSymbol(q.toUpperCase());
                toast.message("검색 결과가 없어 입력값으로 조회합니다.");
            } else {
                toast.error("종목을 찾을 수 없습니다. 다른 키워드(회사명/종목명/티커)로 검색해보세요.");
            }
        } catch (err) {
            console.error("Search error:", err);
            if (looksLikeTicker) {
                setSymbol(q.toUpperCase());
                toast.message("검색에 실패해 입력값으로 조회합니다.");
            } else {
                toast.error("검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            }
        } finally {
            setIsSearching(false);
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
        if (!symbol) return;
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
                    country: (() => {
                        if (!symbolInfo) return "기타";
                        // 1. 코인 (Digital Currency)
                        if (symbolInfo.type === "Digital Currency" || symbolInfo.exchange?.includes("Binance") || symbolInfo.exchange?.includes("Coinbase")) {
                            return "코인";
                        }
                        // 2. 국가별
                        const c = symbolInfo.country?.toLowerCase();
                        if (c === "united states" || c === "usa") return "미국";
                        if (c === "south korea" || c === "korea") return "한국";
                        if (c === "japan") return "일본";
                        if (c === "china") return "중국";
                        
                        // 3. Fallback to raw country or '기타'
                        return symbolInfo.country || "기타";
                    })()
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
                                placeholder="종목/기업명 검색 (다국어 지원: 예: 삼성전자, トヨタ, Apple, BTC)"
                                className="pl-12 h-12 text-base rounded-lg bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-blue-500 focus-visible:border-blue-500 shadow-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                disabled={isSearching}
                            />
                        </form>
                    </div>
                    <div className="text-center text-xs text-muted-foreground">
                        💡 암호화폐: BTC-USD, ETH-USD | 미국 주식: AAPL, TSLA, GOOGL | 한국 주식: 005930.KS (삼성전자)
                    </div>
                </div>

                {!symbol ? (
                    <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground border-2 border-dashed rounded-lg">
                        <BarChart2 className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg font-medium">분석할 종목을 검색해주세요</p>
                        <p className="text-sm">종목명, 티커, 기업명으로 검색할 수 있습니다.</p>
                    </div>
                ) : (
                    <>
                        {/* 2. Intervals moved to Chart Header */}

                        {/* 3. Main Chart Area */}
                        {/* ✅ 테두리 없는(플랫) 스타일 */}
                        <Card className="border-0 shadow-none overflow-hidden bg-transparent">
                            <div className="px-4 py-2 flex flex-col sm:flex-row justify-between items-center bg-transparent gap-4">

                                <div className="flex items-center gap-3">
                                    <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
                                        {symbol}
                                        {krName && (
                                            <span className="text-base font-normal text-muted-foreground">
                                                ({krName})
                                            </span>
                                        )}
                                    </h2>
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
                                        <TabsList className="bg-background/60 border-0 h-8 p-0.5">
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

                                    <div className="flex items-center bg-background/60 border-0 rounded-lg p-0.5 h-8">
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
                            <div className="h-[550px] w-full relative rounded-xl overflow-hidden">
                                <ChartAnalyzer
                                    symbol={symbol}
                                    interval={interval}
                                    chartStyle={chartStyle}
                                    onPointsChange={setPoints}
                                    onChartCapture={setChartImageUrl}
                                />
                            </div>
                        </Card>
                    </>
                )}

                {/* 4. Text Editor Area */}
                <div className="space-y-4">
                    <Card className="border-0 shadow-none bg-transparent">
                        <div className="px-6 py-3 bg-transparent">
                            <h3 className="font-semibold text-foreground">분석 내용</h3>
                        </div>
                        <div className="p-6">
                            <Textarea
                                placeholder="차트 분석 내용을 작성해주세요..."
                                className="min-h-[400px] text-base bg-background/60 border-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-blue-500 resize-none"
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
