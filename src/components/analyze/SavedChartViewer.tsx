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

    // ✅ Helper to get consistent timestamp in ms
    const getTs = (t: Time) => (typeof t === 'string' ? new Date(t).getTime() : (t as number) * 1000);

    // ✅ startColor -> endColor 로 "구간별" 색을 만들어줌 (step-gradient)
    const lerpColor = (c1: string, c2: string, t: number) => {
        const a = c1.replace("#", "");
        const b = c2.replace("#", "");
        const r1 = parseInt(a.slice(0, 2), 16), g1 = parseInt(a.slice(2, 4), 16), b1 = parseInt(a.slice(4, 6), 16);
        const r2 = parseInt(b.slice(0, 2), 16), g2 = parseInt(b.slice(2, 4), 16), b2 = parseInt(b.slice(4, 6), 16);

        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const bb = Math.round(b1 + (b2 - b1) * t);

        return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
    };

    const hexToRgba = (hex: string, a: number) => {
        const h = hex.replace("#", "");
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${a})`;
    };

    const [viewStyle, setViewStyle] = useState<ViewStyle>(defaultStyle || chartStyle);

    // chart refs
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
    const areaGlowSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

    const predSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const predGlowSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    // ✅ Segmented prediction lines (each segment = its own LineSeries)
    const predSegmentSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
    const predGlowSegmentSeriesRef = useRef<ISeriesApi<"Line">[]>([]);

    // ✅ invisible range extender (no visual impact)
    const rangeSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- [HTML Overlay Markers: prediction points] ---
    const [overlayMarkers, setOverlayMarkers] = useState<
        { id: string; x: number; y: number; time: Time; value: number }[]
    >([]);
    const markerPointsRef = useRef<Array<{ time: Time; value: number }>>([]);

    // base(real) data cache
    const baseCandleRef = useRef<CandlestickData[]>([]);
    const baseAreaRef = useRef<{ time: Time; value: number }[]>([]);
    const baseVolumeRef = useRef<HistogramData[]>([]);
    const lastRealRef = useRef<{ time: Time; close: number } | null>(null);

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

    const formatPointTimeLabel = useCallback((t: Time) => {
        const isIntraday = ["1", "60"].includes(interval);

        if (typeof t === "string") {
            const d = new Date(t);
            if (!Number.isFinite(d.getTime())) return t;
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            return `${mm}.${dd}`;
        }

        const d = new Date((t as number) * 1000);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        if (isIntraday) {
            const hh = String(d.getHours()).padStart(2, "0");
            const mi = String(d.getMinutes()).padStart(2, "0");
            return `${mm}.${dd} ${hh}:${mi}`;
        }
        return `${mm}.${dd}`;
    }, [interval]);

    const updateOverlayPositions = useCallback(() => {
        const chart = chartRef.current;
        if (!chart) {
            setOverlayMarkers([]);
            return;
        }

        const points = markerPointsRef.current;
        if (!points.length) {
            setOverlayMarkers([]);
            return;
        }

        // 좌표계에 사용할 series (prediction segment 우선)
        const ySeries =
            predSegmentSeriesRef.current[0] ||
            predSeriesRef.current ||
            areaSeriesRef.current ||
            candleSeriesRef.current;

        if (!ySeries) {
            setOverlayMarkers([]);
            return;
        }

        const timeScale = chart.timeScale();
        const newMarkers = points.map((p) => {
            const x = timeScale.timeToCoordinate(p.time);
            const y = ySeries.priceToCoordinate(p.value);
            return {
                id: `${String(p.time)}-${p.value}`,
                x: x ?? -1000,
                y: y ?? -1000,
                time: p.time,
                value: p.value,
            };
        });

        setOverlayMarkers(newMarkers);
    }, []);

    const clearPredictionSegments = useCallback(() => {
        const chart = chartRef.current;
        if (!chart) return;

        predSegmentSeriesRef.current.forEach((s) => chart.removeSeries(s));
        predGlowSegmentSeriesRef.current.forEach((s) => chart.removeSeries(s));
        predSegmentSeriesRef.current = [];
        predGlowSegmentSeriesRef.current = [];
    }, []);

    const addPredictionSegmentSeries = useCallback((color: string) => {
        const chart = chartRef.current;
        if (!chart) return { seg: null as any, glow: null as any };

        // glow 먼저 (뒤에 깔림)
        const glow = chart.addSeries(LineSeries, {
            color: hexToRgba(color, 0.35),
            lineWidth: 10 as any,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
        }) as ISeriesApi<"Line">;

        const seg = chart.addSeries(LineSeries, {
            color,
            lineWidth: 3,
            lineStyle: 0,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
        }) as ISeriesApi<"Line">;

        predGlowSegmentSeriesRef.current.push(glow);
        predSegmentSeriesRef.current.push(seg);

        return { seg, glow };
    }, []);

    // 미래 여백: 예측점이 미래면 그만큼 rightOffset 확보
    const computeFutureBarsFromPrediction = useCallback(() => {
        const last = lastRealRef.current;
        if (!last) return 20;

        const lastTime = last.time;
        const step = getIntervalSeconds(interval);

        let maxPred = lastTime;
        for (const p of predictionPoints || []) {
            let t = p.time;
            // If we are compared against string time, we might need conversion or just rely on value check?
            // Actually comparing string "2024..." > "2024..." works generally for ISO format.
            // But p.time might be number (timestamp) while lastTime is string.
            if (typeof t === 'number' && typeof lastTime === 'string') {
                 // Convert timestamp p.time to string for comparison?
                 // Or just assume mixed types won't happen often if we sync them. 
                 // For safety:
                 const d = new Date(t * 1000);
                 const year = d.getFullYear();
                 const month = String(d.getMonth() + 1).padStart(2, '0');
                 const day = String(d.getDate()).padStart(2, '0');
                 t = `${year}-${month}-${day}`;
            }
            
            if (t > maxPred) maxPred = t as any;
        }

        if (maxPred <= lastTime) return 20;

        let diffSeconds = 0;
        if (typeof maxPred === 'string' && typeof lastTime === 'string') {
             diffSeconds = (new Date(maxPred).getTime() - new Date(lastTime).getTime()) / 1000;
        } else {
             diffSeconds = (maxPred as number) - (lastTime as number);
        }
        const needBars = Math.ceil(diffSeconds / step) + 5;
        return Math.max(20, needBars);
    }, [predictionPoints, interval]);

    const buildRangeData = (lastTime: Time, lastValue: number, itv: string, bars: number) => {
        const step = getIntervalSeconds(itv);
        const arr: { time: Time; value: number }[] = [{ time: lastTime, value: lastValue }];
        
        // Helper to add days to YYYY-MM-DD
        const addDays = (dateStr: string, days: number) => {
            const d = new Date(dateStr);
            d.setDate(d.getDate() + days);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        for (let i = 1; i <= bars; i++) {
             if (typeof lastTime === 'string') {
                // For daily/weekly/monthly intervals, use date string arithmetic
                // Determine days to add based on interval
                let daysToAdd = i; 
                if (itv === 'W' || itv === '1wk') daysToAdd = i * 7;
                if (itv === 'M' || itv === '1mo') daysToAdd = i * 30; // Approx
                if (itv === 'D' || itv === '1d') daysToAdd = i; // Daily
                
                const nextDate = addDays(lastTime, daysToAdd);
                arr.push({ time: nextDate as Time, value: lastValue });
             } else {
                // For intraday intervals (numeric timestamps), add seconds
                arr.push({ time: ((lastTime as number) + step * i) as Time, value: lastValue });
             }
        }
        return arr;
    };


    // ✅ 핵심: 차트가 재생성되었을 때 “base 데이터”를 새 시리즈에 다시 주입
    const applyBaseDataToSeries = useCallback(() => {
        const candle = candleSeriesRef.current;
        const area = areaSeriesRef.current;
        const areaGlow = areaGlowSeriesRef.current;
        const vol = volumeSeriesRef.current;
        const chart = chartRef.current;

        if (!candle || !area || !areaGlow || !vol || !chart) return;

        const baseC = baseCandleRef.current;
        const baseA = baseAreaRef.current;
        const baseV = baseVolumeRef.current;

        if (!baseC.length || !baseA.length) return;

        candle.setData(baseC);
        area.setData(baseA);
        areaGlow.setData(baseA);
        vol.setData(baseV);

        // visible switch
        candle.applyOptions({ visible: viewStyle === "candle" });
        area.applyOptions({ visible: viewStyle === "line" });
        areaGlow.applyOptions({ visible: viewStyle === "line" });

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
        areaGlowSeriesRef.current = null;
        volumeSeriesRef.current = null;
        predSeriesRef.current = null;
        predGlowSeriesRef.current = null;
        predSegmentSeriesRef.current = [];
        predGlowSegmentSeriesRef.current = [];
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

        // ✅ 파란색 실측 라인 광채 (뒤에 배치)
        const areaGlow = chart.addSeries(AreaSeries, {
            topColor: "rgba(41, 98, 255, 0)",
            bottomColor: "rgba(0, 0, 0, 0)",
            lineColor: "rgba(41, 98, 255, 0.3)", // 반투명한 파란색
            lineWidth: 8 as any,                      // 아주 두껍게
            visible: viewStyle === "line",
        });

        // ✅ 파란색 실측 메인 라인
        const area = chart.addSeries(AreaSeries, {
            topColor: "rgba(41, 98, 255, 0.1)", // 위쪽은 아주 살짝 투명하게 채움
            bottomColor: "rgba(0, 0, 0, 0)",
            lineColor: "#2962FF",               // 메인 파란색
            lineWidth: 4 as any,                       // 2 -> 4로 두껍게 변경
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
            lineWidth: 3,
            lineStyle: 0,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
            visible: true,
        });

        const predGlow = chart.addSeries(LineSeries, {
            color: "rgba(245, 158, 11, 0.4)",
            lineWidth: 10 as any,
            lineStyle: 0,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
            visible: true,
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
        areaGlowSeriesRef.current = areaGlow;
        areaSeriesRef.current = area;
        volumeSeriesRef.current = vol;
        predSeriesRef.current = pred;
        predGlowSeriesRef.current = predGlow;
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
            clearPredictionSegments();
            chart.remove();
            chartRef.current = null;
        };
    }, [isDark, viewStyle, interval, applyBaseDataToSeries, clearPredictionSegments]);

    // 2) Fetch data (only when symbol/interval changes)
    useEffect(() => {
        const run = async () => {
            if (!chartRef.current || !candleSeriesRef.current || !areaSeriesRef.current || !areaGlowSeriesRef.current || !volumeSeriesRef.current) return;

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
                lastRealRef.current = { time: last.time, close: last.close };

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

    // 3) Prediction line inject (Segmented Gradient)
    const updatePredictionSeries = useCallback(() => {
        const chart = chartRef.current;
        if (!chart) return;

        // Old clear
        predSeriesRef.current?.setData([]);
        predGlowSeriesRef.current?.setData([]);

        // New clear
        clearPredictionSegments();

        if (predictionPoints && predictionPoints.length > 0) {
            let dataToShow = [...predictionPoints];
            
            // Connect to last real point if available
            let lastRealPoint = null;
            if (lastRealRef.current) {
                const lastReal = { time: lastRealRef.current.time, value: lastRealRef.current.close };
                lastRealPoint = lastReal;

                // Diff check (using getTs)
                const firstPred = dataToShow[0];
                const t1 = getTs(firstPred.time);
                const t2 = getTs(lastReal.time);
                if (t1 !== t2) {
                   dataToShow = [lastReal, ...dataToShow];
                }
            }

            // Sort first
            const sortedRaw = dataToShow.sort((a, b) => getTs(a.time) - getTs(b.time));

            // ✅ Normalize types! (Must be all string OR all number)
            // Use lastReal type as reference if exists, else first point
            const refTime = lastRealPoint ? lastRealPoint.time : sortedRaw[0]?.time;
            const useString = typeof refTime === 'string';

            const normalized = sortedRaw
                .map(p => {
                    const ms = getTs(p.time);
                    if (isNaN(ms)) return null; // Filter invalid

                    let newTime: Time;
                    
                    if (useString) {
                        // Convert to YYYY-MM-DD
                        const d = new Date(ms);
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        newTime = `${y}-${m}-${day}` as Time;
                    } else {
                        // Convert to UTCTimestamp (seconds)
                        newTime = Math.floor(ms / 1000) as Time;
                    }
                    return { time: newTime, value: p.value };
                })
                .filter((p): p is { time: Time; value: number } => p !== null);

            // ✅ Deduplicate! (Keep last occurrence for same time)
            const uniqueMap = new Map<string | number, number>();
            normalized.forEach(p => uniqueMap.set(p.time as string | number, p.value));

            const sorted = Array.from(uniqueMap.entries())
                .map(([t, v]) => ({ time: t as Time, value: v }))
                .sort((a, b) => getTs(a.time) - getTs(b.time));

            // ✅ Overlay marker points: predictionPoints만 (lastReal 연결점 제외)
            // normalized에는 lastReal이 섞일 수 있으니, predictionPoints만 따로 normalize/dedupe하여 사용
            const predOnlySorted = (() => {
                const predOnlyRaw = [...predictionPoints].sort((a, b) => getTs(a.time) - getTs(b.time));
                const refT = lastRealRef.current ? lastRealRef.current.time : predOnlyRaw[0]?.time;
                const useStr = typeof refT === "string";
                const predOnlyNorm = predOnlyRaw
                    .map((p) => {
                        const ms = getTs(p.time);
                        if (isNaN(ms)) return null;
                        let newTime: Time;
                        if (useStr) {
                            const d = new Date(ms);
                            const y = d.getFullYear();
                            const m = String(d.getMonth() + 1).padStart(2, "0");
                            const day = String(d.getDate()).padStart(2, "0");
                            newTime = `${y}-${m}-${day}` as Time;
                        } else {
                            newTime = Math.floor(ms / 1000) as Time;
                        }
                        return { time: newTime, value: p.value };
                    })
                    .filter((p): p is { time: Time; value: number } => p !== null);

                const map = new Map<string | number, number>();
                predOnlyNorm.forEach((p) => map.set(p.time as any, p.value));
                return Array.from(map.entries())
                    .map(([t, v]) => ({ time: t as Time, value: v }))
                    .sort((a, b) => getTs(a.time) - getTs(b.time));
            })();

            markerPointsRef.current = predOnlySorted;
            // 좌표 업데이트는 다음 프레임에 (시리즈 setData 후 좌표계 안정화)
            requestAnimationFrame(updateOverlayPositions);
            
            if (sorted.length >= 2) {
                 // ✅ 구간별 컬러: 왼쪽(초록) -> 오른쪽(주황) step-gradient
                const startColor = "#22c55e"; // green
                const endColor = "#f97316";   // orange
                const segCount = sorted.length - 1;

                for (let i = 0; i < segCount; i++) {
                    const t = segCount === 1 ? 1 : i / (segCount - 1);
                    const color = lerpColor(startColor, endColor, t);

                    const { seg, glow } = addPredictionSegmentSeries(color);
                    seg?.setData([sorted[i], sorted[i + 1]]);
                    glow?.setData([sorted[i], sorted[i + 1]]);
                }
            }

        }
        
        // Update range for future
        applyBaseDataToSeries();

    }, [predictionPoints, applyBaseDataToSeries, clearPredictionSegments, addPredictionSegmentSeries]);

    useEffect(() => {
        updatePredictionSeries();
    }, [updatePredictionSeries]);

    // overlay sync with chart interactions
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        updateOverlayPositions();
        const handle = () => requestAnimationFrame(updateOverlayPositions);
        chart.timeScale().subscribeVisibleLogicalRangeChange(handle);
        chart.timeScale().subscribeSizeChange(handle);

        return () => {
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(handle);
            chart.timeScale().unsubscribeSizeChange(handle);
        };
    }, [updateOverlayPositions]);

    // Update prediction when base data loaded (to connect line)
    useEffect(() => {
        if (!loading && lastRealRef.current) {
            updatePredictionSeries();
        }
    }, [loading, updatePredictionSeries]);

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

            {/* ✅ Prediction Points Overlay Markers (항상 라벨 표시) */}
            {overlayMarkers.map((m) => (
                <div
                    key={m.id}
                    className="absolute z-30 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{
                        left: m.x,
                        top: m.y,
                        display: m.x < 0 || m.y < 0 ? "none" : "flex",
                    }}
                    title={`${formatPointTimeLabel(m.time)} / ${m.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`}
                >
                    <div className="relative flex items-center justify-center">
                        {/* 라벨 */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                            <div className="rounded-md bg-black/70 text-white text-[11px] px-2 py-1 whitespace-nowrap shadow-lg border border-white/10 opacity-85">
                                <div className="font-semibold">{formatPointTimeLabel(m.time)}</div>
                                <div className="opacity-95">
                                    {m.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* 점 */}
                        <div className="absolute w-6 h-6 bg-orange-500/30 rounded-full blur-sm" />
                        <div className="relative w-3 h-3 rounded-full bg-gradient-to-br from-yellow-300 to-orange-600 border border-white/50 shadow-[0_0_10px_rgba(251,146,60,0.8)]" />
                    </div>
                </div>
            ))}
        </div>
    );
}
