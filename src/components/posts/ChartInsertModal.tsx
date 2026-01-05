"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Check, 
  BarChart2, 
  LineChart,
  Loader2,
  X
} from "lucide-react";
import { searchSymbol } from "@/lib/api/search";
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

interface ChartInsertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (chart: InsertedChart) => void;
}

// Lazy load ChartAnalyzer to avoid SSR issues
import dynamic from "next/dynamic";
const ChartAnalyzer = dynamic(
  () => import("@/components/analyze/ChartAnalyzer").then(mod => ({ default: mod.ChartAnalyzer })),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-muted/50">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
);

export function ChartInsertModal({ isOpen, onClose, onInsert }: ChartInsertModalProps) {
  const [symbol, setSymbol] = useState("BTC-USD");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [interval, setInterval] = useState("D");
  const [chartStyle, setChartStyle] = useState<"candle" | "line">("line");
  const [points, setPoints] = useState<Array<{ time: Time; value: number }>>([]);
  const [chartImageUrl, setChartImageUrl] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);

  const intervals = [
    { label: "년", value: "Y" },
    { label: "월", value: "M" },
    { label: "주", value: "W" },
    { label: "일", value: "D" },
    { label: "시", value: "60" },
    { label: "분", value: "1" },
  ];

  // Handle search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    const looksLikeTicker = /^[A-Za-z0-9.^=_-]{1,32}$/.test(q);

    try {
      setIsSearching(true);
      const resolved = await searchSymbol(q);
      
      if (resolved) {
        setSymbol(resolved.toUpperCase());
        setChartImageUrl(""); // Reset image when symbol changes
        return;
      }

      if (looksLikeTicker) {
        setSymbol(q.toUpperCase());
        setChartImageUrl("");
        toast.message("검색 결과가 없어 입력값으로 조회합니다.");
      } else {
        toast.error("종목을 찾을 수 없습니다.");
      }
    } catch (err) {
      console.error("Search error:", err);
      if (looksLikeTicker) {
        setSymbol(q.toUpperCase());
        setChartImageUrl("");
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Handle chart capture
  const handleChartCapture = useCallback((imageDataUrl: string) => {
    setChartImageUrl(imageDataUrl);
  }, []);

  // Handle points change
  const handlePointsChange = useCallback((newPoints: Array<{ time: Time; value: number }>) => {
    setPoints(newPoints);
  }, []);

  // Handle insert
  const handleInsert = () => {
    if (!chartImageUrl) {
      toast.error("차트 이미지가 캡처될 때까지 잠시 기다려주세요.");
      return;
    }

    const chart: InsertedChart = {
      id: `chart_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      symbol,
      interval,
      chartStyle,
      imageUrl: chartImageUrl,
      predictionPoints: points,
    };

    onInsert(chart);
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPoints([]);
      // Don't reset chartImageUrl here - let it be captured naturally
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-xl font-bold">차트 추가</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search & Controls */}
          <div className="px-6 py-4 border-b border-border space-y-4 shrink-0">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="종목/기업명 검색 (예: 삼성전자, Apple, BTC)"
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isSearching}
                />
              </div>
              <Button type="submit" disabled={isSearching}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "검색"}
              </Button>
            </form>

            {/* Controls Row */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{symbol}</span>
                <span className="text-sm text-muted-foreground">
                  {interval === "Y" && "연봉"}
                  {interval === "M" && "월봉"}
                  {interval === "W" && "주봉"}
                  {interval === "D" && "일봉"}
                  {interval === "60" && "60분봉"}
                  {interval === "1" && "1분봉"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Interval Tabs */}
                <Tabs value={interval} onValueChange={(v) => { setInterval(v); setChartImageUrl(""); }}>
                  <TabsList className="h-8">
                    {intervals.map((item) => (
                      <TabsTrigger
                        key={item.value}
                        value={item.value}
                        className="text-xs px-3 h-7"
                      >
                        {item.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                {/* Chart Style Toggle */}
                <div className="flex items-center bg-muted rounded-md p-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2 ${chartStyle === 'candle' ? 'bg-background shadow-sm' : ''}`}
                    onClick={() => { setChartStyle('candle'); setChartImageUrl(""); }}
                  >
                    <BarChart2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2 ${chartStyle === 'line' ? 'bg-background shadow-sm' : ''}`}
                    onClick={() => { setChartStyle('line'); setChartImageUrl(""); }}
                  >
                    <LineChart className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Area */}
          <div className="flex-1 p-4 overflow-hidden">
            <div className="h-full rounded-lg overflow-hidden border border-border">
              <ChartAnalyzer
                symbol={symbol}
                interval={interval}
                chartStyle={chartStyle}
                onPointsChange={handlePointsChange}
                onChartCapture={handleChartCapture}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
            <div className="text-sm text-muted-foreground">
              {chartImageUrl ? (
                <span className="text-green-500">✓ 차트 이미지 준비됨</span>
              ) : (
                <span>차트가 로드되면 자동으로 캡처됩니다</span>
              )}
              {points.length > 0 && (
                <span className="ml-4">예측 포인트: {points.length}개</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                취소
              </Button>
              <Button 
                onClick={handleInsert}
                disabled={!chartImageUrl}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Check className="h-4 w-4" />
                차트 추가
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}





