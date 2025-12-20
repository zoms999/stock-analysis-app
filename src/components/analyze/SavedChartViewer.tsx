"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import {
    createChart,
    ColorType,
    IChartApi,
    ISeriesApi,
    Time,
    TickMarkType,
    CandlestickData,
    HistogramData,
    CandlestickSeries,
    HistogramSeries,
    LineSeries,
    AreaSeries,
} from "lightweight-charts";
import { fetchYahooCandles } from "@/lib/api/yahoo";

type ViewStyle = "candle" | "line";

interface SavedChartViewerProps {
    symbol: string;
    interval: string;
    predictionPoints?: Array<{ time: Time; value: number }>;
    chartStyle?: ViewStyle;
    defaultStyle?: ViewStyle; // ✅ 상세 기본 line
    showStyleToggle?: boolean;
}

interface CandleDataWithVolume extends CandlestickData {
    volume?: number;
}

export function SavedChartViewer({
    symbol,
    interval,
    predictionPoints = [],
    chartStyle = "candle",
    defaultStyle = "line",
    showStyleToggle = true,
}: SavedChartViewerProps) {
    const { theme, systemTheme } = useTheme();
    const currentTheme = theme === "system" ? systemTheme : theme;
    const isDark = currentTheme === "dark";

    const [viewStyle, setViewStyle] = useState<ViewStyle>(defaultStyle || chartStyle);

    // chart refs
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

    const predSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

    // ✅ invisible range extender (no visual impact)
    const rangeSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // base(real) data cache
    const baseCandleRef = useRef<CandlestickData[]>([]);
    const baseAreaRef = useRef<{ time: Time; value: number }[]>([]);
    const baseVolumeRef = useRef<HistogramData[]>([]);
    const lastRealRef = useRef<{ time: number; close: number } | null>(null);

    const getIntervalSeconds = (itv: string) => {
        if (itv === "1") return 60;
        if (itv === "60") return 3600;
        if (itv === "D") return 86400;
        if (itv === "W") return 604800;
        if (itv === "M") return 2592000;
        if (itv === "Y") return 31536000;
        return 86400;
    };

    const formatTick = (t: number | string, tickMarkType: TickMarkType) => {
        const date = typeof t === "string" ? new Date(t) : new Date(t * 1000);
        switch (tickMarkType) {
            case TickMarkType.Year:
                return date.getFullYear().toString();
            case TickMarkType.Month:
                return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
            case TickMarkType.DayOfMonth:
                return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
            case TickMarkType.Time:
            case TickMarkType.TimeWithSeconds:
                return date.toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit" });
            default:
                return date.toLocaleDateString();
        }
    };

    // 미래 여백: 예측점이 미래면 그만큼 rightOffset 확보
    const computeFutureBarsFromPrediction = useCallback(() => {
        const last = lastRealRef.current;
        if (!last) return 20;

        const lastTime = last.time;
        const step = getIntervalSeconds(interval);

        let maxPred = lastTime;
        for (const p of predictionPoints || []) {
            const t = p.time as number;
            if (t > maxPred) maxPred = t;
        }

        if (maxPred <= lastTime) return 20;

        const diffSeconds = maxPred - lastTime;
        const needBars = Math.ceil(diffSeconds / step) + 5;
        return Math.max(20, needBars);
    }, [predictionPoints, interval]);

    const buildRangeData = (lastTime: number, lastValue: number, itv: string, bars: number) => {
        const step = getIntervalSeconds(itv);
        const arr: { time: Time; value: number }[] = [{ time: lastTime as Time, value: lastValue }];
        for (let i = 1; i <= bars; i++) {
            arr.push({ time: (lastTime + step * i) as Time, value: lastValue });
        }
        return arr;
    };

    // ✅ 핵심: 차트가 재생성되었을 때 “base 데이터”를 새 시리즈에 다시 주입
    const applyBaseDataToSeries = useCallback(() => {
        const candle = candleSeriesRef.current;
        const area = areaSeriesRef.current;
        const vol = volumeSeriesRef.current;
        const chart = chartRef.current;

        if (!candle || !area || !vol || !chart) return;

        const baseC = baseCandleRef.current;
        const baseA = baseAreaRef.current;
        const baseV = baseVolumeRef.current;

        if (!baseC.length || !baseA.length) return;

        candle.setData(baseC);
        area.setData(baseA);
        vol.setData(baseV);

        // visible switch
        candle.applyOptions({ visible: viewStyle === "candle" });
        area.applyOptions({ visible: viewStyle === "line" });

        // rightOffset + rangeSeries
        if (lastRealRef.current && rangeSeriesRef.current) {
            const futureBars = computeFutureBarsFromPrediction();
            chart.applyOptions({ timeScale: { rightOffset: futureBars } });

            const rangeData = buildRangeData(lastRealRef.current.time, lastRealRef.current.close, interval, futureBars);
            rangeSeriesRef.current.setData(rangeData as any);
        }
    }, [viewStyle, interval, computeFutureBarsFromPrediction]);

    // 1) Init/Recreate chart (when theme or viewStyle changes)
    useEffect(() => {
        if (!chartContainerRef.current) return;

        // cleanup old chart
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }
        candleSeriesRef.current = null;
        areaSeriesRef.current = null;
        volumeSeriesRef.current = null;
        predSeriesRef.current = null;
        rangeSeriesRef.current = null;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: isDark ? "#0a0a0a" : "#ffffff" },
                textColor: isDark ? "#9CA3AF" : "#4B5563",
                fontSize: 12,
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            grid: {
                vertLines: { color: isDark ? "rgba(105,105,105,0.2)" : "rgba(209,213,219,0.3)", visible: true },
                horzLines: { color: isDark ? "rgba(105,105,105,0.2)" : "rgba(209,213,219,0.3)", visible: true },
            },
            timeScale: {
                visible: true,
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 20,
                borderColor: isDark ? "#2a2a2a" : "#E5E7EB",
            },
            rightPriceScale: {
                borderColor: isDark ? "#2a2a2a" : "#E5E7EB",
                scaleMargins: { top: 0.1, bottom: 0.2 },
            },
            crosshair: {
                mode: 0,
                vertLine: {
                    color: isDark ? "#9CA3AF" : "#6B7280",
                    width: 1,
                    style: 3,
                    labelBackgroundColor: isDark ? "#374151" : "#E5E7EB",
                },
                horzLine: {
                    color: isDark ? "#9CA3AF" : "#6B7280",
                    width: 1,
                    style: 3,
                    labelBackgroundColor: isDark ? "#374151" : "#E5E7EB",
                },
            },
        });

        const candle = chart.addSeries(CandlestickSeries, {
            upColor: "#ef4444",
            downColor: "#3b82f6",
            borderVisible: false,
            wickUpColor: "#ef4444",
            wickDownColor: "#3b82f6",
            borderUpColor: "#ef4444",
            borderDownColor: "#3b82f6",
            visible: viewStyle === "candle",
        });

        const area = chart.addSeries(AreaSeries, {
            topColor: "rgba(41, 98, 255, 0.35)",
            bottomColor: "rgba(41, 98, 255, 0.0)",
            lineColor: "#2962FF",
            lineWidth: 2,
            visible: viewStyle === "line",
        });

        const vol = chart.addSeries(HistogramSeries, {
            color: "#26a69a",
            priceFormat: { type: "volume" },
            priceScaleId: "volume",
        });
        vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

        const pred = chart.addSeries(LineSeries, {
            color: "#f59e0b",
            lineWidth: 2,
            lineStyle: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            priceLineVisible: false,
            lastValueVisible: false,
        });

        const range = chart.addSeries(LineSeries, {
            color: "rgba(0,0,0,0)",
            lineWidth: 1,
            lineStyle: 0,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
        });

        candleSeriesRef.current = candle;
        areaSeriesRef.current = area;
        volumeSeriesRef.current = vol;
        predSeriesRef.current = pred;
        rangeSeriesRef.current = range;
        chartRef.current = chart;

        // time formatter
        const isIntraday = ["60", "1"].includes(interval);
        chart.applyOptions({
            timeScale: {
                visible: true,
                timeVisible: isIntraday,
                secondsVisible: false,
                tickMarkFormatter: formatTick,
                borderColor: isDark ? "#2a2a2a" : "#E5E7EB",
            },
        });

        const handleResize = () => {
            if (!chartContainerRef.current) return;
            chart.applyOptions({ 
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight
            });
        };
        window.addEventListener("resize", handleResize);

        // ✅ 재생성 직후 base 데이터 즉시 주입 (이게 없으면 토글시 빈 차트)
        setTimeout(() => {
            applyBaseDataToSeries();
        }, 0);

        return () => {
            window.removeEventListener("resize", handleResize);
            chart.remove();
            chartRef.current = null;
        };
    }, [isDark, viewStyle, interval, applyBaseDataToSeries]);

    // 2) Fetch data (only when symbol/interval changes)
    useEffect(() => {
        const run = async () => {
            if (!chartRef.current || !candleSeriesRef.current || !areaSeriesRef.current || !volumeSeriesRef.current) return;

            setLoading(true);
            setError(null);

            try {
                let yahooInterval = "1d";
                if (interval === "Y") yahooInterval = "1mo";
                if (interval === "M") yahooInterval = "1mo";
                if (interval === "W") yahooInterval = "1wk";
                if (interval === "D") yahooInterval = "1d";
                if (interval === "60") yahooInterval = "1h";
                if (interval === "1") yahooInterval = "1m";

                const data = (await fetchYahooCandles(symbol, yahooInterval)) as CandleDataWithVolume[];

                if (!data || data.length === 0) {
                    setError("차트 데이터를 불러올 수 없습니다.");
                    baseCandleRef.current = [];
                    baseAreaRef.current = [];
                    baseVolumeRef.current = [];
                    lastRealRef.current = null;
                    return;
                }

                const candleData: CandlestickData[] = data.map((d) => ({
                    time: d.time,
                    open: d.open,
                    high: d.high,
                    low: d.low,
                    close: d.close,
                }));

                const areaData = data.map((d) => ({
                    time: d.time,
                    value: d.close,
                }));

                const volumeData: HistogramData[] = data
                    .filter((d) => d.volume !== undefined)
                    .map((d) => ({
                        time: d.time,
                        value: d.volume!,
                        color: d.close >= d.open ? "#ef444480" : "#3b82f680",
                    }));

                baseCandleRef.current = candleData;
                baseAreaRef.current = areaData;
                baseVolumeRef.current = volumeData;

                const last = candleData[candleData.length - 1];
                lastRealRef.current = { time: last.time as number, close: last.close };

                // ✅ 방금 로드한 base를 현재 시리즈에 반영
                applyBaseDataToSeries();

                chartRef.current.timeScale().fitContent();
            } catch (e) {
                console.error("[SavedChartViewer] fetch error:", e);
                setError("차트 데이터를 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [symbol, interval, applyBaseDataToSeries]);

    // 3) Prediction line inject (must re-run on viewStyle because chart recreated)
    useEffect(() => {
        const s = predSeriesRef.current;
        if (!s) return;

        if (predictionPoints && predictionPoints.length > 0) {
            s.setData(predictionPoints);

            const markers = predictionPoints.map((p, idx) => ({
                time: p.time,
                position: "inBar" as const,
                color: "#f59e0b",
                shape: "circle" as const,
                size: 4,
                text:
                    idx === predictionPoints.length - 1
                        ? `${p.value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}`
                        : undefined,
            }));

            const anySeries = s as unknown as { setMarkers?: (m: unknown[]) => void };
            if (typeof anySeries.setMarkers === "function") anySeries.setMarkers(markers);
        } else {
            s.setData([]);
            const anySeries = s as unknown as { setMarkers?: (m: unknown[]) => void };
            if (typeof anySeries.setMarkers === "function") anySeries.setMarkers([]);
        }

        // ✅ 예측이 미래면 여백/범위도 재조정
        applyBaseDataToSeries();
    }, [predictionPoints, viewStyle, symbol, interval, applyBaseDataToSeries]);

    const containerBg = useMemo(() => (isDark ? "bg-[#0a0a0a]" : "bg-white"), [isDark]);

    return (
        <div className={`relative w-full h-full ${containerBg} rounded-lg overflow-hidden`}>
            {showStyleToggle && (
                <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 rounded-md p-1 shadow">
                    <button
                        onClick={() => setViewStyle("line")}
                        className={`px-2 py-1 text-xs rounded ${viewStyle === "line" ? "bg-blue-600 text-white" : "text-gray-700 dark:text-gray-200"
                            }`}
                    >
                        라인
                    </button>
                    <button
                        onClick={() => setViewStyle("candle")}
                        className={`px-2 py-1 text-xs rounded ${viewStyle === "candle" ? "bg-blue-600 text-white" : "text-gray-700 dark:text-gray-200"
                            }`}
                    >
                        캔들
                    </button>
                </div>
            )}

            {loading && (
                <div className={`absolute inset-0 flex items-center justify-center ${isDark ? "bg-black/50" : "bg-white/50"} z-10`}>
                    <span className={`${isDark ? "text-gray-300" : "text-gray-700"} animate-pulse`}>차트 로딩 중...</span>
                </div>
            )}

            {error && !loading && (
                <div className={`absolute inset-0 flex flex-col items-center justify-center ${containerBg} z-10`}>
                    <div className="text-center space-y-4 p-8">
                        <div className="text-red-500 text-lg font-semibold">⚠️ {error}</div>
                    </div>
                </div>
            )}

            <div ref={chartContainerRef} className="w-full h-full" />
        </div>
    );
}
