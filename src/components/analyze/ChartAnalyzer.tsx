"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import {
    createChart,
    ColorType,
    IChartApi,
    ISeriesApi,
    Time,
    TickMarkType,
    MouseEventParams,
    CandlestickData,
    HistogramData,
    CandlestickSeries,
    HistogramSeries,
    LineSeries,
    AreaSeries,
} from "lightweight-charts";
import { fetchYahooCandles } from "@/lib/api/yahoo";
import { Button } from "@/components/ui/button";

interface ChartAnalyzerProps {
    symbol: string;
    interval: string; // "Y" | "M" | "W" | "D" | "60" | "1"
    chartStyle?: "candle" | "line";
    onPointsChange?: (points: PredictionPoint[]) => void;
    onChartCapture?: (imageDataUrl: string) => void;
}

interface PredictionPoint {
    time: Time;
    value: number;
}

interface CandleDataWithVolume extends CandlestickData {
    volume?: number;
}

export function ChartAnalyzer({
    symbol,
    interval,
    chartStyle = "candle",
    onPointsChange,
    onChartCapture,
}: ChartAnalyzerProps) {
    const { theme, systemTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        setMounted(true);
        const currentTheme = theme === "system" ? systemTheme : theme;
        setIsDark(currentTheme === "dark");
    }, [theme, systemTheme]);

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const predictionSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

    // ✅ Invisible series that ONLY extends logical range (no visual impact)
    const rangeSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

    const [points, setPoints] = useState<PredictionPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [priceChange, setPriceChange] = useState<{ value: number; percent: number } | null>(null);
    const [hoveredPrice, setHoveredPrice] = useState<{
        time: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume?: number;
    } | null>(null);

    const [lastCandle, setLastCandle] = useState<{ time: Time; value: number } | null>(null);
    const [dataCount, setDataCount] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    // --- [HTML Overlay Logic] ---
    const [overlayMarkers, setOverlayMarkers] = useState<{ id: string; x: number; y: number; time: Time; value: number }[]>([]);

    const updateOverlayPositions = useCallback(() => {
        const chart = chartRef.current;
        const series = predictionSeriesRef.current;
        if (!chart || !series || points.length === 0) {
            setOverlayMarkers([]);
            return;
        }

        const newMarkers = points.map((p) => {
            const timeScale = chart.timeScale();
            // timeToCoordinate gives X (allows undefined if off-screen, but we handle that)
            const x = timeScale.timeToCoordinate(p.time); 
            const y = series.priceToCoordinate(p.value);

            return {
                id: `${p.time}-${p.value}`,
                x: x ?? -1000,
                y: y ?? -1000,
                time: p.time,
                value: p.value,
            };
        });

        setOverlayMarkers(newMarkers);
    }, [points]);

    // Update overlay when points change or chart moves
    useEffect(() => {
        updateOverlayPositions();
        
        const chart = chartRef.current;
        if (!chart) return;

        const handleChartUpdate = () => {
             // Use RAF to debounce/sync with render cycle
            requestAnimationFrame(updateOverlayPositions);
        };

        // Subscribe to events that change coordinate mapping
        chart.timeScale().subscribeVisibleLogicalRangeChange(handleChartUpdate);
        chart.timeScale().subscribeSizeChange(handleChartUpdate);

        return () => {
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleChartUpdate);
            chart.timeScale().unsubscribeSizeChange(handleChartUpdate);
        };
    }, [points, updateOverlayPositions]);

    // --- [Future Range UI] ---
    const [futureMode, setFutureMode] = useState<"1m" | "3m" | "custom">("1m");
    const [customDays, setCustomDays] = useState<number>(30);

    // Keep base (real) data for re-apply when future range changes (no refetch)
    const baseCandleDataRef = useRef<CandlestickData[]>([]);
    const baseAreaDataRef = useRef<{ time: Time; value: number }[]>([]);
    const baseVolumeDataRef = useRef<HistogramData[]>([]);

    // --- [Refs for Event Access] ---
    const intervalRef = useRef(interval);
    const dataCountRef = useRef(dataCount);
    const lastCandleRef = useRef(lastCandle);
    const chartStyleRef = useRef(chartStyle);

    useEffect(() => {
        intervalRef.current = interval;
        dataCountRef.current = dataCount;
        lastCandleRef.current = lastCandle;
        chartStyleRef.current = chartStyle;
    }, [interval, dataCount, lastCandle, chartStyle]);

    // --- [Helpers] ---
    const getIntervalSeconds = (itv: string) => {
        if (itv === "1") return 60;
        if (itv === "60") return 3600;
        if (itv === "D") return 86400;
        if (itv === "W") return 604800;
        if (itv === "M") return 2592000; // ~30 days
        if (itv === "Y") return 31536000; // ~365 days
        return 86400;
    };

    const getFutureSeconds = () => {
        if (futureMode === "1m") return 30 * 24 * 60 * 60;
        if (futureMode === "3m") return 90 * 24 * 60 * 60;
        const days = Math.max(1, Math.min(365, Number.isFinite(customDays) ? customDays : 30));
        return days * 24 * 60 * 60;
    };

    // Future bars based on chosen seconds (cap 1m interval for UX)
    const getFutureBars = (itv: string, futureSeconds: number) => {
        const step = getIntervalSeconds(itv);
        const oneWeekSeconds = 7 * 24 * 60 * 60;
        let targetSeconds = futureSeconds;

        // Cap 1m at 7 days to avoid too-wide blank space
        if (itv === "1") targetSeconds = Math.min(targetSeconds, oneWeekSeconds);

        return Math.ceil(targetSeconds / step);
    };

    const snapTime = (t: number, step: number) => Math.round(t / step) * step;
    const clampFutureTime = (t: number, maxT: number) => Math.min(t, maxT);

    // Dummy range points for rangeSeries (time range extension)
    const buildFutureRange = (lastTime: number, lastValue: number, itv: string, bars: number) => {
        const step = getIntervalSeconds(itv);
        // include start point + future points (>=2 points is safer for some versions)
        const arr: { time: Time; value: number }[] = [{ time: lastTime as Time, value: lastValue }];
        for (let i = 1; i <= bars; i++) {
            arr.push({ time: (lastTime + step * i) as Time, value: lastValue });
        }
        return arr;
    };

    // Capture chart as image
    const captureChart = useCallback(async () => {
        if (!chartContainerRef.current) return null;

        try {
            const html2canvas = (await import("html2canvas")).default;
            const canvas = await html2canvas(chartContainerRef.current, {
                backgroundColor: "#ffffff",
                scale: 2,
            });

            const imageDataUrl = canvas.toDataURL("image/png");
            onChartCapture?.(imageDataUrl);
            return imageDataUrl;
        } catch (e) {
            console.error("Failed to capture chart:", e);
            return null;
        }
    }, [onChartCapture]);

    // 1) Initialize Chart
    useEffect(() => {
        if (!chartContainerRef.current || !mounted) return;

        const chart = createChart(chartContainerRef.current, {
layout: {
  background: { type: ColorType.Solid, color: isDark ? "#0a0a0a" : "#ffffff" },
  textColor: isDark ? "#9CA3AF" : "#4B5563",
  fontSize: 12,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Segoe UI Symbol"',
},
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            grid: {
                vertLines: {
                    color: isDark ? "rgba(105, 105, 105, 0.2)" : "rgba(209, 213, 219, 0.3)",
                    style: 0,
                    visible: true,
                },
                horzLines: {
                    color: isDark ? "rgba(105, 105, 105, 0.2)" : "rgba(209, 213, 219, 0.3)",
                    style: 0,
                    visible: false,
                },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 30,
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

        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: "#ef4444",
            downColor: "#3b82f6",
            borderVisible: false,
            wickUpColor: "#ef4444",
            wickDownColor: "#3b82f6",
            borderUpColor: "#ef4444",
            borderDownColor: "#3b82f6",
            visible: chartStyle === "candle",
        });

        const areaSeries = chart.addSeries(AreaSeries, {
            topColor: "rgba(41, 98, 255, 0.4)",
            bottomColor: "rgba(41, 98, 255, 0.0)",
            lineColor: "#2962FF",
            lineWidth: 2,
            visible: chartStyle === "line",
        });

        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: "#26a69a",
            priceFormat: { type: "volume" },
            priceScaleId: "volume",
        });

        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        // ✅ Prediction series (orange dashed)
        const predictionSeries = chart.addSeries(LineSeries, {
            color: "#f59e0b",
            lineWidth: 2,
            lineStyle: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            priceLineVisible: false,
            lastValueVisible: false,
        });

        // ✅ Invisible range extender (NO visual impact)
        const rangeSeries = chart.addSeries(LineSeries, {
            color: "rgba(0,0,0,0)",
            lineWidth: 1,
            lineStyle: 0,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
        });

        candlestickSeriesRef.current = candlestickSeries as ISeriesApi<"Candlestick">;
        areaSeriesRef.current = areaSeries as ISeriesApi<"Area">;
        volumeSeriesRef.current = volumeSeries as ISeriesApi<"Histogram">;
        predictionSeriesRef.current = predictionSeries as ISeriesApi<"Line">;
        rangeSeriesRef.current = rangeSeries as ISeriesApi<"Line">;

        chartRef.current = chart;

        const handleResize = () => {
             if (chartContainerRef.current) {
                 chart.applyOptions({ 
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight
                });
             }
        };
        window.addEventListener("resize", handleResize);

        // Tooltip
        chart.subscribeCrosshairMove((param: MouseEventParams) => {
            if (!param.time || !param.seriesData || param.seriesData.size === 0) {
                setHoveredPrice(null);
                return;
            }

            const candleData = param.seriesData.get(candlestickSeries) as CandlestickData | undefined;
            const areaData = param.seriesData.get(areaSeries) as { value: number } | undefined;
            const volumeData = param.seriesData.get(volumeSeries) as { value: number } | undefined;

            if (chartStyleRef.current === "candle" && candleData) {
                setHoveredPrice({
                    time: new Date((param.time as number) * 1000).toLocaleDateString("ko-KR"),
                    open: candleData.open,
                    high: candleData.high,
                    low: candleData.low,
                    close: candleData.close,
                    volume: volumeData?.value,
                });
            } else if (chartStyleRef.current === "line" && areaData) {
                setHoveredPrice({
                    time: new Date((param.time as number) * 1000).toLocaleDateString("ko-KR"),
                    open: areaData.value,
                    high: areaData.value,
                    low: areaData.value,
                    close: areaData.value,
                    volume: volumeData?.value,
                });
            }
        });

        // ✅ Click handler (future supported)
        chart.subscribeClick((param: MouseEventParams) => {
            if (!param.point) return;

            const itv = intervalRef.current;
            const count = dataCountRef.current;
            const last = lastCandleRef.current;

            let time: Time | undefined = param.time;

            // Future empty space
            if (!time && count > 0 && last) {
                const logical = chart.timeScale().coordinateToLogical(param.point.x);

                if (logical !== null) {
                    const lastIndex = count - 1;

                    if (logical > lastIndex) {
                        const step = getIntervalSeconds(itv);
                        const lastTime = last.time as number;

                        const diffBars = Math.max(1, Math.round(logical - lastIndex));
                        let targetTime = lastTime + diffBars * step;

                        const now = Math.floor(Date.now() / 1000);
                        const maxFuture = now + getFutureSeconds();

                        targetTime = Math.max(targetTime, lastTime + step);
                        targetTime = clampFutureTime(targetTime, maxFuture);
                        targetTime = snapTime(targetTime, step);

                        if (targetTime <= lastTime) targetTime = lastTime + step;

                        time = targetTime as Time;
                    }
                }
            }

            if (!time) return;

            // Price from mouse Y
            const activeSeries = chartStyleRef.current === "line" ? areaSeries : candlestickSeries;
            const price = activeSeries.coordinateToPrice(param.point.y);

            if (price !== null && price !== undefined) {
                const newPoint = { time: time as Time, value: price };

                setPoints((prev) => {
                    const existsIndex = prev.findIndex((p) => (p.time as number) === (newPoint.time as number));
                    const next = [...prev];

                    if (existsIndex >= 0) next[existsIndex] = newPoint;
                    else next.push(newPoint);

                    next.sort((a, b) => (a.time as number) - (b.time as number));
                    return next;
                });
            }
        });

        return () => {
            window.removeEventListener("resize", handleResize);
            chart.remove();

            candlestickSeriesRef.current = null;
            areaSeriesRef.current = null;
            volumeSeriesRef.current = null;
            predictionSeriesRef.current = null;
            rangeSeriesRef.current = null;
            chartRef.current = null;
        };
    }, [mounted]);

    // Update chart theme/style without recreating
    useEffect(() => {
        const chart = chartRef.current;
        const candleSeries = candlestickSeriesRef.current;
        const areaSeries = areaSeriesRef.current;
        
        if (!chart || !candleSeries || !areaSeries) return;

        // Update layout colors
        chart.applyOptions({
            layout: {
                background: { type: ColorType.Solid, color: isDark ? "#0a0a0a" : "#ffffff" },
                textColor: isDark ? "#9CA3AF" : "#4B5563",
            },
            grid: {
                vertLines: {
                    color: isDark ? "rgba(105, 105, 105, 0.2)" : "rgba(209, 213, 219, 0.3)",
                },
                horzLines: {
                    color: isDark ? "rgba(105, 105, 105, 0.2)" : "rgba(209, 213, 219, 0.3)",
                },
            },
            timeScale: {
                borderColor: isDark ? "#2a2a2a" : "#E5E7EB",
            },
            rightPriceScale: {
                borderColor: isDark ? "#2a2a2a" : "#E5E7EB",
            },
            crosshair: {
                vertLine: {
                    color: isDark ? "#9CA3AF" : "#6B7280",
                    labelBackgroundColor: isDark ? "#374151" : "#E5E7EB",
                },
                horzLine: {
                    color: isDark ? "#9CA3AF" : "#6B7280",
                    labelBackgroundColor: isDark ? "#374151" : "#E5E7EB",
                },
            },
        });

        // Update series visibility based on chartStyle
        candleSeries.applyOptions({ visible: chartStyle === "candle" });
        areaSeries.applyOptions({ visible: chartStyle === "line" });
    }, [isDark, chartStyle]);

    // 2) Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            if (!candlestickSeriesRef.current || !areaSeriesRef.current || !volumeSeriesRef.current || !mounted) return;

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
                    setError(
                        `${interval === "1" ? "1분봉" : interval === "60" ? "60분봉" : ""} 데이터를 불러올 수 없습니다. 다른 시간대를 선택해주세요.`
                    );
                    setLoading(false);
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

                // Save base (real) data
                baseCandleDataRef.current = candleData;
                baseAreaDataRef.current = areaData;
                baseVolumeDataRef.current = volumeData;

                // Render REAL data ONLY (no dummy attached to visible series)
                candlestickSeriesRef.current.setData(candleData);
                areaSeriesRef.current.setData(areaData);
                volumeSeriesRef.current.setData(volumeData);

                // Price info
                const latest = data[data.length - 1];
                const previous = data[data.length - 2];
                setCurrentPrice(latest.close);
                if (previous) {
                    const change = latest.close - previous.close;
                    const changePercent = (change / previous.close) * 100;
                    setPriceChange({ value: change, percent: changePercent });
                }

                setLastCandle({ time: latest.time as Time, value: latest.close });
                setDataCount(data.length);

                // Reset prediction points on symbol/interval changes
                setPoints([]);

                // ✅ Extend logical time range with invisible range series
                const futureSeconds = getFutureSeconds();
                const futureBars = getFutureBars(interval, futureSeconds);

                const lastReal = candleData[candleData.length - 1];
                const lastRealTime = lastReal.time as number;
                const lastRealClose = lastReal.close;

                const rangeData = buildFutureRange(lastRealTime, lastRealClose, interval, futureBars);
                rangeSeriesRef.current?.setData(rangeData as any);

                // Apply timeScale options (rightOffset matches chosen future range)
                if (chartRef.current) {
                    const isIntraday = ["60", "1"].includes(interval);

                    chartRef.current.applyOptions({
                        timeScale: {
                            timeVisible: isIntraday,
                            secondsVisible: false,
                            borderColor: "#D1D5DB",
                            rightOffset: futureBars,
                            tickMarkFormatter: (t: number | string, tickMarkType: TickMarkType) => {
                                const date = new Date((t as number) * 1000);
                                const year = date.getFullYear();
                                const month = (date.getMonth() + 1).toString().padStart(2, "0");
                                const day = date.getDate().toString().padStart(2, "0");

                                switch (tickMarkType) {
                                    case TickMarkType.Year:
                                        return year.toString();
                                    case TickMarkType.Month:
                                        return `${year}.${month}`;
                                    case TickMarkType.DayOfMonth:
                                        return `${month}.${day}`;
                                    case TickMarkType.Time:
                                    case TickMarkType.TimeWithSeconds:
                                        return date.toLocaleTimeString("ko-KR", {
                                            hour12: false,
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        });
                                    default:
                                        return "";
                                }
                            },
                        },
                    });

                    chartRef.current.timeScale().fitContent();
                }

                setTimeout(() => {
                    captureChart();
                }, 500);
            } catch (e) {
                console.error("Failed to fetch data", e);
                const msg = e instanceof Error ? e.message : "차트 데이터를 불러오는데 실패했습니다.";
                setError(msg);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [symbol, interval, mounted, futureMode, customDays, captureChart]);

    // 2.5) Re-apply future range WITHOUT refetch (only updates invisible range + rightOffset)
    useEffect(() => {
        if (!chartRef.current) return;
        if (!rangeSeriesRef.current) return;

        const baseC = baseCandleDataRef.current;
        if (!baseC.length) return;

        const itv = intervalRef.current;
        const futureSeconds = getFutureSeconds();
        const futureBars = getFutureBars(itv, futureSeconds);

        const lastReal = baseC[baseC.length - 1];
        const lastTime = lastReal.time as number;
        const lastClose = lastReal.close;

        const rangeData = buildFutureRange(lastTime, lastClose, itv, futureBars);
        rangeSeriesRef.current.setData(rangeData as any);

        chartRef.current.applyOptions({
            timeScale: { rightOffset: futureBars },
        });
    }, [futureMode, customDays]);

    // 3) Update Prediction Line + Markers
    // 3) Update Prediction Line (Keep line, remove native markers)
    useEffect(() => {
        onPointsChange?.(points);

        const series = predictionSeriesRef.current;
        if (!series) return;

        let dataToShow = [...points];

        // Connect from last candle
        if (lastCandle && points.length > 0) {
            if (points[0].time !== lastCandle.time) {
                dataToShow = [lastCandle, ...points];
            }
        }

        // Ensure unique timestamps
        const unique = new Map<number, number>();
        dataToShow.forEach((d) => unique.set(d.time as number, d.value));

        const sorted = Array.from(unique.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([t, v]) => ({ time: t as Time, value: v }));

        if (sorted.length > 0) {
            series.setData(sorted);
            // Native markers removed
        } else {
            series.setData([]);
        }
    }, [points, onPointsChange, lastCandle]);

    const handleRemovePoint = (time: Time) => {
        setPoints(prev => prev.filter(p => p.time !== time));
    };

    const handleClearPoints = () => setPoints([]);

    // Prevent hydration mismatch
    if (!mounted) {
        return (
            <div className="relative w-full h-full bg-background">
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-muted-foreground animate-pulse">차트 로딩 중...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full bg-white dark:bg-[#1a1a1a]">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 z-10">
                    <span className="text-gray-700 dark:text-gray-300 animate-pulse">차트 로딩 중...</span>
                </div>
            )}

            {error && !loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-[#1a1a1a] z-10">
                    <div className="text-center space-y-4 p-8">
                        <div className="text-red-500 text-lg font-semibold">⚠️ {error}</div>
                        <div className="text-gray-600 dark:text-gray-400 text-sm">
                            {interval === "1" && "1분봉 데이터는 최근 7일만 제공됩니다."}
                            {interval === "60" && "60분봉 데이터는 최근 60일만 제공됩니다."}
                        </div>
                        <div className="text-gray-500 dark:text-gray-500 text-xs">일봉, 주봉, 월봉 데이터를 권장합니다.</div>
                    </div>
                </div>
            )}

            {/* Price Info */}
            {currentPrice !== null && priceChange && (
                <div className="absolute top-4 left-4 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-baseline gap-3">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                            {currentPrice.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
                        </span>
                        <span className={`text-sm font-semibold ${priceChange.value >= 0 ? "text-red-500" : "text-blue-500"}`}>
                            {priceChange.value >= 0 ? "+" : ""}
                            {priceChange.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} (
                            {priceChange.percent >= 0 ? "+" : ""}
                            {priceChange.percent.toFixed(2)}%)
                        </span>
                    </div>
                </div>
            )}

            {/* Hover Tooltip */}
            {hoveredPrice && (
                <div className="absolute top-20 left-4 z-20 bg-white/95 dark:bg-gray-900/95 text-gray-900 dark:text-white backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg text-sm border border-gray-200 dark:border-gray-700">
                    <div className="font-semibold mb-2 text-gray-700 dark:text-gray-300">{hoveredPrice.time}</div>
                    <div className="space-y-1">
                        <div className="flex justify-between gap-6">
                            <span className="text-gray-600 dark:text-gray-400">시가:</span>
                            <span className="font-medium">
                                {hoveredPrice.open.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between gap-6">
                            <span className="text-gray-600 dark:text-gray-400">고가:</span>
                            <span className="font-medium text-red-400">
                                {hoveredPrice.high.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between gap-6">
                            <span className="text-gray-600 dark:text-gray-400">저가:</span>
                            <span className="font-medium text-blue-400">
                                {hoveredPrice.low.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between gap-6">
                            <span className="text-gray-600 dark:text-gray-400">종가:</span>
                            <span className="font-medium">
                                {hoveredPrice.close.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        {hoveredPrice.volume !== undefined && (
                            <div className="flex justify-between gap-6 pt-1 border-t border-gray-200 dark:border-gray-700">
                                <span className="text-gray-600 dark:text-gray-400">거래량:</span>
                                <span className="font-medium">
                                    {hoveredPrice.volume.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div ref={chartContainerRef} className="w-full h-full relative" />

            {/* HTML Overlay Markers */}
            {overlayMarkers.map((marker) => (
                <div
                    key={marker.id}
                    className="absolute z-30 transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                    style={{
                        left: marker.x,
                        top: marker.y,
                        // Hide if outside visible bounds
                        display: (marker.x < 0 || marker.y < 0) ? 'none' : 'flex'
                    }}
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent chart click
                        handleRemovePoint(marker.time);
                    }}
                >
                    <div className="w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 shadow-sm border border-white flex items-center justify-center transition-all">
                        <span className="text-white font-bold text-xs select-none">✕</span>
                    </div>
                     {/* Tooltip on hover */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        삭제
                    </div>
                </div>
            ))}

            {/* Future Range Controls */}
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
                <div className="flex items-center bg-white/95 dark:bg-gray-950/80 border border-gray-200 dark:border-white/10 rounded-lg p-1 shadow-md">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 px-2 rounded-md text-xs font-medium transition-colors ${
                            futureMode === "1m"
                                ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                                : "text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-200 dark:hover:text-white dark:hover:bg-white/10"
                        }`}
                        onClick={() => setFutureMode("1m")}
                    >
                        1개월
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 px-2 rounded-md text-xs font-medium transition-colors ${
                            futureMode === "3m"
                                ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                                : "text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-200 dark:hover:text-white dark:hover:bg-white/10"
                        }`}
                        onClick={() => setFutureMode("3m")}
                    >
                        3개월
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 px-2 rounded-md text-xs font-medium transition-colors ${
                            futureMode === "custom"
                                ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                                : "text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-200 dark:hover:text-white dark:hover:bg-white/10"
                        }`}
                        onClick={() => setFutureMode("custom")}
                    >
                        직접
                    </Button>
                </div>

                {futureMode === "custom" && (
                    <div className="flex items-center bg-white/95 dark:bg-gray-950/80 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 shadow-md">
                        <span className="text-xs text-gray-600 dark:text-gray-300 mr-1">일</span>
                        <input
                            type="number"
                            min={1}
                            max={365}
                            value={customDays}
                            onChange={(e) => setCustomDays(parseInt(e.target.value || "30", 10))}
                            className="w-16 bg-transparent text-sm outline-none text-gray-900 dark:text-white"
                        />
                    </div>
                )}
            </div>

            {/* Clear prediction points */}
            {points.length > 0 && (
                <div className="absolute top-4 right-4 z-20">
                    <Button
                        onClick={handleClearPoints}
                        variant="outline"
                        size="sm"
                        className="shadow-md bg-white hover:bg-gray-50 text-gray-900 border-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white dark:border-gray-600"
                    >
                        예측 초기화 ({points.length})
                    </Button>
                </div>
            )}
        </div>
    );
}
