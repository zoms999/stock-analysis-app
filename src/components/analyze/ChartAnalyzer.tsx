"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
import { fetchTwelveDataCandles, subscribeTwelveDataPrices } from "@/lib/api/twelvedata";
import { Button } from "@/components/ui/button";

interface ChartAnalyzerProps {
    symbol: string;
    interval: string; // "Y" | "M" | "W" | "D" | "60" | "1"
    chartStyle?: "candle" | "line";
    onPointsChange?: (points: PredictionPoint[]) => void;
    onDataLoaded?: (data: CandlestickData[]) => void;
    onChartCapture?: (imageDataUrl: string) => void;
    minDate?: Date;
    maxDate?: Date;
    maxPoints?: number;
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
    onDataLoaded,
    onChartCapture,
    minDate,
    maxDate,
    maxPoints,
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



    const areaGlowSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const predictionSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const predictionGlowSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const predictionSegmentSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
    const predictionGlowSegmentSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
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
    const [showPointsPanel, setShowPointsPanel] = useState(false);
    // ✅ 차트 생성 완료 상태를 관리하여 데이터 페치 런타임 보장
    const [isChartReady, setIsChartReady] = useState(false);

    const isMobileRef = useRef(false);
    const [isNarrowScreen, setIsNarrowScreen] = useState(false);
    
    useEffect(() => {
        if (typeof window === "undefined") return;
        const mq = window.matchMedia("(max-width: 900px)");
        const update = () => {
            isMobileRef.current = mq.matches;
            setIsNarrowScreen(mq.matches);
        };
        update();
        if ("addEventListener" in mq) {
            mq.addEventListener("change", update);
            return () => mq.removeEventListener("change", update);
        }
        // @ts-expect-error - Safari 구버전 호환
        mq.addListener?.(update);
        // @ts-expect-error - Safari 구버전 호환
        return () => mq.removeListener?.(update);
    }, []);

    // Notify parent when points change, but avoid loop
    useEffect(() => {
        if (onPointsChange) {
            onPointsChange(points);
        }
    }, [points, onPointsChange]);


    // --- [HTML Overlay Logic] ---
    const [overlayMarkers, setOverlayMarkers] = useState<{ id: string; x: number; y: number; time: Time; value: number }[]>([]);

    const updateOverlayPositions = useCallback(() => {
        const chart = chartRef.current;
        const ySeries =
            predictionSegmentSeriesRef.current[0] ||
            predictionSeriesRef.current ||
            areaSeriesRef.current ||
            candlestickSeriesRef.current;

        if (!chart || !ySeries || points.length === 0) {
            setOverlayMarkers((prev) => (prev.length === 0 ? prev : []));
            return;
        }

        const newMarkers = points.map((p) => {
            const timeScale = chart.timeScale();
            const x = timeScale.timeToCoordinate(p.time);
            const y = ySeries.priceToCoordinate(p.value);

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

    useEffect(() => {
        updateOverlayPositions();
        const chart = chartRef.current;
        if (!chart) return;
        const handleChartUpdate = () => requestAnimationFrame(updateOverlayPositions);
        chart.timeScale().subscribeVisibleLogicalRangeChange(handleChartUpdate);
        chart.timeScale().subscribeSizeChange(handleChartUpdate);
        return () => {
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleChartUpdate);
            chart.timeScale().unsubscribeSizeChange(handleChartUpdate);
        };
    }, [points, updateOverlayPositions, isChartReady]);

    // --- [Future Range UI] ---
    const [futureMode, setFutureMode] = useState<"1m" | "3m" | "custom">("1m");
    const [customDays, setCustomDays] = useState<number>(30);

    const baseCandleDataRef = useRef<CandlestickData[]>([]);
    const baseAreaDataRef = useRef<{ time: Time; value: number }[]>([]);
    const baseVolumeDataRef = useRef<HistogramData[]>([]);

    const intervalRef = useRef(interval);
    const dataCountRef = useRef(dataCount);
    const lastCandleRef = useRef(lastCandle);
    const chartStyleRef = useRef(chartStyle);
    const futureBarsRef = useRef(0);

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
        if (itv === "M") return 2592000;
        if (itv === "Y") return 31536000;
        return 86400;
    };

    const getFutureSeconds = () => {
        if (futureMode === "1m") return 30 * 24 * 60 * 60;
        if (futureMode === "3m") return 90 * 24 * 60 * 60;
        const days = Math.max(1, Math.min(365, Number.isFinite(customDays) ? customDays : 30));
        return days * 24 * 60 * 60;
    };

    const getFutureBars = (itv: string, futureSeconds: number) => {
        const step = getIntervalSeconds(itv);
        const oneWeekSeconds = 7 * 24 * 60 * 60;
        let targetSeconds = futureSeconds;
        if (itv === "1") targetSeconds = Math.min(targetSeconds, oneWeekSeconds);
        return Math.ceil(targetSeconds / step);
    };

    const snapTime = (t: number, step: number) => Math.round(t / step) * step;
    const clampFutureTime = (t: number, maxT: number) => Math.min(t, maxT);

    const timeToTs = useCallback(
        (t: Time) => (typeof t === "string" ? new Date(t).getTime() : (t as number) * 1000),
        []
    );
    const compareTime = useCallback((a: Time, b: Time) => timeToTs(a) - timeToTs(b), [timeToTs]);

    const formatPointTime = useCallback((t: Time) => {
        if (typeof t === "string") {
            const d = new Date(t);
            if (!Number.isFinite(d.getTime())) return t;
            return d.toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            });
        }
        const d = new Date((t as number) * 1000);
        const isIntraday = ["1", "60"].includes(intervalRef.current);
        if (isIntraday) {
            return d.toLocaleString("ko-KR", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            });
        }
        return d.toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
    }, []);

    const formatPointTimeLabel = useCallback((t: Time) => {
        const isIntraday = ["1", "60"].includes(intervalRef.current);
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
    }, []);

    const formattedPoints = useMemo(() => {
        const unique = new Map<string, PredictionPoint>();
        points.forEach((p) => {
            const key = typeof p.time === "string" ? p.time : String(p.time);
            unique.set(key, p);
        });
        return Array.from(unique.values()).sort((a, b) => compareTime(a.time, b.time));
    }, [points, compareTime]);

    // ✅ [변경됨] 날짜 간격을 좁게 설정 (촘촘하게)
    const getTargetBarSpacingPx = (itv: string) => {
        switch (itv) {
            case "1": return 2;
            case "60": return 2;
            // ✅ 일봉: 데스크톱 2px / 모바일 3px (반으로 줄여서 더 촘촘하게)
            case "D": return isMobileRef.current ? 3 : 2; 
            case "W": return 3;
            case "M": return 5;
            case "Y": return 7;
            default: return 2;
        }
    };

    const buildMonthStartTime = useCallback((sample: Time): Time => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        if (typeof sample === "string") {
            const mm = String(m + 1).padStart(2, "0");
            return `${y}-${mm}-01` as Time;
        }
        return Math.floor(Date.UTC(y, m, 1) / 1000) as Time;
    }, []);

    const buildFutureRange = (lastTime: Time, lastValue: number, itv: string, bars: number) => {
        const step = getIntervalSeconds(itv);
        const arr: { time: Time; value: number }[] = [{ time: lastTime, value: lastValue }];
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
                let daysToAdd = i;
                if (itv === 'W') daysToAdd = i * 7;
                if (itv === 'M') daysToAdd = i * 30;
                if (itv === 'D') daysToAdd = i;
                const nextDate = addDays(lastTime, daysToAdd);
                arr.push({ time: nextDate as Time, value: lastValue });
            } else {
                arr.push({ time: ((lastTime as number) + step * i) as Time, value: lastValue });
            }
        }
        return arr;
    };

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

    const clearPredictionSegments = useCallback(() => {
        const chart = chartRef.current;
        if (!chart) return;
        predictionSegmentSeriesRef.current.forEach((s) => chart.removeSeries(s));
        predictionGlowSegmentSeriesRef.current.forEach((s) => chart.removeSeries(s));
        predictionSegmentSeriesRef.current = [];
        predictionGlowSegmentSeriesRef.current = [];
    }, []);

    const hexToRgba = (hex: string, a: number) => {
        const h = hex.replace("#", "");
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${a})`;
    };

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

    const addPredictionSegmentSeries = useCallback((color: string) => {
        const chart = chartRef.current;
        if (!chart) return { seg: null as ISeriesApi<"Line"> | null, glow: null as ISeriesApi<"Line"> | null };
        const glow = chart.addSeries(LineSeries, {
            color: hexToRgba(color, 0.35),
            lineWidth: 4,
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
        predictionGlowSegmentSeriesRef.current.push(glow);
        predictionSegmentSeriesRef.current.push(seg);
        return { seg, glow };
    }, []);

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
                    // ✅ 세로 그리드가 더 잘 보이도록 대비/투명도 상향
                    color: isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(209, 213, 219, 0.45)",
                    style: 0,
                    visible: true,
                },
                horzLines: { visible: false },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 30,
                borderColor: isDark ? "#2a2a2a" : "#E5E7EB",
                barSpacing: 4, // 기본값도 좁게 설정
                minBarSpacing: 0.5,
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
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: false,
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
            wickVisible: interval === "1" || interval === "60" ? false : true,
            visible: chartStyle === "candle",
        });

        const areaGlowSeries = chart.addSeries(AreaSeries, {
            topColor: "rgba(0, 217, 255, 0)",
            bottomColor: "rgba(0, 0, 0, 0)",
            lineColor: "rgba(0, 217, 255, 0.3)",
            lineWidth: 4,
            visible: chartStyle === "line",
        });

        const areaSeries = chart.addSeries(AreaSeries, {
            topColor: "rgba(0, 217, 255, 0.1)",
            bottomColor: "rgba(0, 0, 0, 0)",
            lineColor: "#00D9FF",
            lineWidth: 4,
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

        const predictionSeries = chart.addSeries(LineSeries, {
            color: "#f59e0b",
            lineWidth: 3,
            lineStyle: 0,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
        });

        const predictionGlowSeries = chart.addSeries(LineSeries, {
            color: "rgba(245, 158, 11, 0.4)",
            lineWidth: 4,
            lineStyle: 0,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
        });

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
        areaGlowSeriesRef.current = areaGlowSeries as ISeriesApi<"Area">;
        volumeSeriesRef.current = volumeSeries as ISeriesApi<"Histogram">;
        predictionSeriesRef.current = predictionSeries as ISeriesApi<"Line">;
        predictionGlowSeriesRef.current = predictionGlowSeries as ISeriesApi<"Line">;
        rangeSeriesRef.current = rangeSeries as ISeriesApi<"Line">;
        chartRef.current = chart;
        setIsChartReady(true);

        const handleResize = () => {
            if (!chartContainerRef.current || !chartRef.current) return;
            chart.applyOptions({
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight
            });
            const spacing = getTargetBarSpacingPx(intervalRef.current);
            chartRef.current.timeScale().applyOptions({
                barSpacing: spacing,
                minBarSpacing: 0.5,
            });
        };
        window.addEventListener("resize", handleResize);

        // Tooltip & Click Listeners...
        chart.subscribeCrosshairMove((param: MouseEventParams) => {
            if (!param.time || !param.seriesData || param.seriesData.size === 0) {
                setHoveredPrice(null);
                return;
            }
            const candleData = param.seriesData.get(candlestickSeries) as CandlestickData | undefined;
            const areaData = param.seriesData.get(areaSeries) as { value: number } | undefined;
            const volumeData = param.seriesData.get(volumeSeries) as { value: number } | undefined;

            const hoverTimeLabel = (() => {
                const t = param.time as Time;
                if (typeof t === "string") {
                    const d = new Date(t);
                    return Number.isFinite(d.getTime()) ? d.toLocaleDateString("ko-KR") : t;
                }
                return new Date((t as number) * 1000).toLocaleDateString("ko-KR");
            })();

            if (chartStyleRef.current === "candle" && candleData) {
                setHoveredPrice({
                    time: hoverTimeLabel,
                    open: candleData.open,
                    high: candleData.high,
                    low: candleData.low,
                    close: candleData.close,
                    volume: volumeData?.value,
                });
            } else if (chartStyleRef.current === "line" && areaData) {
                setHoveredPrice({
                    time: hoverTimeLabel,
                    open: areaData.value,
                    high: areaData.value,
                    low: areaData.value,
                    close: areaData.value,
                    volume: volumeData?.value,
                });
            }
        });

        chart.subscribeClick((param: MouseEventParams) => {
            if (!param.point) return;
            const itv = intervalRef.current;
            const count = dataCountRef.current;
            const last = lastCandleRef.current;
            let time: Time | undefined = param.time;

            if (!time && count > 0 && last) {
                const logical = chart.timeScale().coordinateToLogical(param.point.x);
                if (logical !== null) {
                    const lastIndex = count - 1;
                    if (logical > lastIndex) {
                        const step = getIntervalSeconds(itv);
                        const diffBars = Math.max(1, Math.round(logical - lastIndex));
                        const addDays = (dateStr: string, days: number) => {
                            const d = new Date(dateStr);
                            if (!Number.isFinite(d.getTime())) return dateStr;
                            d.setDate(d.getDate() + days);
                            const year = d.getFullYear();
                            const month = String(d.getMonth() + 1).padStart(2, "0");
                            const day = String(d.getDate()).padStart(2, "0");
                            return `${year}-${month}-${day}`;
                        };

                        // ✅ 일봉(D)/주봉(W)/월봉(M)/연봉(Y)처럼 날짜 문자열(time="YYYY-MM-DD") 기반일 때도
                        //    미래 영역 클릭으로 예측 포인트를 정상 생성
                        if (typeof last.time === "string") {
                            let daysToAdd = diffBars;
                            if (itv === "W") daysToAdd = diffBars * 7;
                            if (itv === "M") daysToAdd = diffBars * 30;
                            if (itv === "Y") daysToAdd = diffBars * 365;
                            const nextDate = addDays(last.time, daysToAdd);
                            time = nextDate as Time;
                        } else {
                            const lastTime = last.time as number;
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
            }

            if (!time) return;

            // ✅ Date Constraint Check
            const timeVal = typeof time === 'string' ? new Date(time).getTime() : (time as number) * 1000;
            if (minDate && timeVal < minDate.getTime()) {
                console.log("예측 불가: 시작일 이전", new Date(timeVal).toLocaleString());
                return;
            }
            if (maxDate && timeVal > maxDate.getTime()) {
                console.log("예측 불가: 종료일 이후", new Date(timeVal).toLocaleString());
                return;
            }

            const activeSeries = chartStyleRef.current === "line" ? areaSeries : candlestickSeries;
            const price = activeSeries.coordinateToPrice(param.point.y);
            if (price !== null && price !== undefined) {
                const newPoint = { time: time as Time, value: price };
                setPoints((prev) => {
                    const existsIndex = prev.findIndex((p) => compareTime(p.time, newPoint.time) === 0);
                    const next = [...prev];
                    if (existsIndex >= 0) {
                      next[existsIndex] = newPoint;
                    } else {
                        // ✅ Max Points Check
                        if (maxPoints && next.length >= maxPoints) {
                            console.log("Max points reached");
                            return prev; 
                        }
                        next.push(newPoint);
                    }
                    next.sort((a, b) => compareTime(a.time, b.time));
                    
                    return next;
                });
            }
        });

        return () => {
            window.removeEventListener("resize", handleResize);
            clearPredictionSegments();
            chart.remove();
            candlestickSeriesRef.current = null;
            areaSeriesRef.current = null;
            areaGlowSeriesRef.current = null;
            volumeSeriesRef.current = null;
            predictionSeriesRef.current = null;
            predictionGlowSeriesRef.current = null;
            rangeSeriesRef.current = null;
            chartRef.current = null;
            setIsChartReady(false);
        };
    }, [mounted, clearPredictionSegments, interval, minDate, maxDate]); // Added minDate, maxDate to deps

    useEffect(() => {
        const chart = chartRef.current;
        const candleSeries = candlestickSeriesRef.current;
        const areaSeries = areaSeriesRef.current;
        const areaGlowSeries = areaGlowSeriesRef.current;

        if (!chart || !candleSeries || !areaSeries) return;

        chart.applyOptions({
            layout: {
                background: { type: ColorType.Solid, color: isDark ? "#06080f" : "#ffffff" },
                textColor: isDark ? "#6366f1" : "#4B5563",
            },
            grid: {
                // ✅ 테마 변경 시에도 세로 그리드가 흐려지지 않도록 동일하게 상향
                vertLines: { color: isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(209, 213, 219, 0.45)" },
                horzLines: { visible: false },
            },
            timeScale: { borderColor: isDark ? "#2a2a2a" : "#E5E7EB" },
            rightPriceScale: { borderColor: isDark ? "#2a2a2a" : "#E5E7EB" },
            crosshair: {
                vertLine: { color: isDark ? "#9CA3AF" : "#6B7280", labelBackgroundColor: isDark ? "#374151" : "#E5E7EB" },
                horzLine: { color: isDark ? "#9CA3AF" : "#6B7280", labelBackgroundColor: isDark ? "#374151" : "#E5E7EB" },
            },
        });
        candleSeries.applyOptions({ visible: chartStyle === "candle" });
        areaSeries.applyOptions({ visible: chartStyle === "line" });
        areaGlowSeries?.applyOptions({ visible: chartStyle === "line" });
    }, [isDark, chartStyle]);

    // 2) Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            if (!isChartReady || !candlestickSeriesRef.current || !areaSeriesRef.current || !volumeSeriesRef.current || !mounted) return;

            setLoading(true);
            setError(null);

            try {
                let dataInterval = "1d";
                if (interval === "Y") dataInterval = "1mo";
                if (interval === "M") dataInterval = "1mo";
                if (interval === "W") dataInterval = "1wk";
                if (interval === "D") dataInterval = "1d";
                if (interval === "60") dataInterval = "1h";
                if (interval === "1") dataInterval = "1m";

                const data = (await fetchTwelveDataCandles(symbol, dataInterval)) as CandleDataWithVolume[];

                if (!data || data.length === 0) {
                    setError(`데이터를 불러올 수 없습니다.`);
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
                const areaData = data.map((d) => ({ time: d.time, value: d.close }));
                const volumeData: HistogramData[] = data
                    .filter((d) => d.volume !== undefined)
                    .map((d) => ({
                        time: d.time,
                        value: d.volume!,
                        color: d.close >= d.open ? "#ef444480" : "#3b82f680",
                    }));

                baseCandleDataRef.current = candleData;
                baseAreaDataRef.current = areaData;
                baseVolumeDataRef.current = volumeData;

                candlestickSeriesRef.current.setData(candleData);
                areaSeriesRef.current.setData(areaData);
                areaGlowSeriesRef.current?.setData(areaData);
                volumeSeriesRef.current.setData(volumeData);

                if (onDataLoaded) {
                    onDataLoaded(candleData);
                }

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
                setPoints([]);

                const futureSeconds = getFutureSeconds();
                const futureBars = getFutureBars(interval, futureSeconds);
                const lastReal = candleData[candleData.length - 1];
                const lastRealTime = lastReal.time;
                const lastRealClose = lastReal.close;

                const rangeData = buildFutureRange(lastRealTime, lastRealClose, interval, futureBars);
                rangeSeriesRef.current?.setData(rangeData);
                futureBarsRef.current = futureBars;

                if (chartRef.current && chartContainerRef.current) {
                    const isIntraday = ["60", "1"].includes(interval);
                    // ✅ BarSpacing(간격)을 여기서 강제 설정 (좁게)
                    const spacing = getTargetBarSpacingPx(interval);
                    // ✅ 요청사항: 일봉(D) 최초 로딩 시 "오늘~한달 전" + "미래 한달(기본 1개월 모드)"까지 보이도록 우측 여백 확보
                    const rightOffset = interval === "D" ? futureBars : futureBars;
                    
                    chartRef.current.applyOptions({
                        timeScale: {
                            timeVisible: isIntraday,
                            secondsVisible: false,
                            borderColor: "#D1D5DB",
                            rightOffset,
                            barSpacing: spacing, // 촘촘한 간격 적용
                            minBarSpacing: 0.1, // 줌아웃 시 아주 촘촘하게
                            tickMarkFormatter: (t: number | string, tickMarkType: TickMarkType) => {
                                const date = typeof t === 'string' ? new Date(t) : new Date((t as number) * 1000);
                                const year = date.getFullYear();
                                const month = (date.getMonth() + 1).toString().padStart(2, "0");
                                const day = date.getDate().toString().padStart(2, "0");

                                // ✅ 일봉/모바일 등에서 강제로 MM.DD 형식 우선
                                if (interval === "D") return `${month}.${day}`;
                                
                                if (tickMarkType === TickMarkType.DayOfMonth) return `${month}.${day}`;
                                if (tickMarkType === TickMarkType.Month) return `${year}.${month}`;
                                if (tickMarkType === TickMarkType.Year) return year.toString();
                                if (isIntraday) {
                                    return date.toLocaleTimeString("ko-KR", {
                                        hour12: false, hour: "2-digit", minute: "2-digit",
                                    });
                                }
                                return "";
                            },
                        },
                    });

                    // ✅ [핵심] 일봉(D)일 경우: "이번 달 1일 ~ 오늘" 범위를 정확히 계산하여 가시 영역 설정
                    if (interval === "D") {
                        // ✅ 요청사항: "오늘 ~ 한달 전(달력 기준 30일)" 범위만 보이도록
                        const pad2 = (n: number) => String(n).padStart(2, "0");
                        const toYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

                        const cutoff = new Date();
                        cutoff.setDate(cutoff.getDate() - 30);
                        const cutoffYmd = toYmd(cutoff);

                        const lastIndex = candleData.length - 1;
                        // Twelve Data 일봉은 보통 "YYYY-MM-DD" 문자열 time을 사용하므로, 문자열 비교로도 안전합니다.
                        const fromIndex = (() => {
                            for (let i = 0; i < candleData.length; i++) {
                                const t = candleData[i]?.time;
                                if (typeof t === "string") {
                                    if (t >= cutoffYmd) return i;
                                } else if (typeof t === "number") {
                                    const ymd = toYmd(new Date(t * 1000));
                                    if (ymd >= cutoffYmd) return i;
                                }
                            }
                            return 0;
                        })();

                        // ✅ 미래 영역(오른쪽)은 futureBars(기본 1개월 모드면 30일) 만큼 확보
                        chartRef.current.timeScale().setVisibleLogicalRange({ from: fromIndex, to: lastIndex + futureBars });
                    } else {
                        // 기존 로직 유지 (다른 시간대)
                        const width = chartContainerRef.current.clientWidth;
                        const autoBars = Math.floor(width / spacing);
                        const total = autoBars; 
                        const to = data.length + futureBars; 
                        const from = to - total; 
                        chartRef.current.timeScale().setVisibleLogicalRange({ from, to });
                    }
                }
                setTimeout(() => captureChart(), 500);
            } catch (e) {
                console.error("Failed to fetch data", e);
                setError("차트 데이터를 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // ✅ 실시간 가격 스트리밍: currentPrice만 갱신(차트 시리즈 보정은 최소화)
        const sub = subscribeTwelveDataPrices([symbol], (msg) => {
            const p = Number(msg.price);
            if (!Number.isFinite(p)) return;
            setCurrentPrice(p);
        });

        return () => sub.close();
    }, [symbol, interval, mounted, futureMode, customDays, captureChart, buildMonthStartTime, compareTime, isChartReady]);

    // Re-apply future range logic...
    useEffect(() => {
        if (!chartRef.current || !rangeSeriesRef.current || !baseCandleDataRef.current.length) return;
        const baseC = baseCandleDataRef.current;
        const itv = intervalRef.current;
        const futureSeconds = getFutureSeconds();
        const futureBars = getFutureBars(itv, futureSeconds);
        const lastReal = baseC[baseC.length - 1];
        const rangeData = buildFutureRange(lastReal.time, lastReal.close, itv, futureBars);
        rangeSeriesRef.current.setData(rangeData);
        futureBarsRef.current = futureBars;

        // ✅ 요청사항: 일봉(D)에서도 미래 한달(기본 1개월 모드) 영역이 보이도록 우측 여백 확보
        chartRef.current.applyOptions({ timeScale: { rightOffset: futureBars } });

        // 유지 로직 (범위 재조정 안함, 사용자가 보고 있던 줌 상태 존중하되 우측 여백만 확보)
    }, [futureMode, customDays]);

    // Update Prediction Line...
    useEffect(() => {
        onPointsChange?.(points);
        const chart = chartRef.current;
        if (!chart) return;
        predictionSeriesRef.current?.setData([]);
        predictionGlowSeriesRef.current?.setData([]);
        clearPredictionSegments();

        // ✅ 예측 포인트만 사용 (lastCandle 연결은 시각적으로만, 라인은 예측 포인트 간에만 그림)
        if (points.length === 0) {
            requestAnimationFrame(() => requestAnimationFrame(updateOverlayPositions));
            return;
        }

        // ✅ 예측 포인트들을 정렬
        const unique = new Map<Time, number>();
        points.forEach((d) => unique.set(d.time, d.value));
        const sorted = Array.from(unique.entries())
            .map(([t, v]) => ({ time: t, value: v }))
            .sort((a, b) => compareTime(a.time, b.time));

        // ✅ lastCandle에서 첫 예측 포인트까지 연결선 (1개 세그먼트)
        if (lastCandle && sorted.length > 0) {
            if (compareTime(sorted[0].time, lastCandle.time) !== 0) {
                const { seg, glow } = addPredictionSegmentSeries("#22c55e");
                seg?.setData([lastCandle, sorted[0]]);
                glow?.setData([lastCandle, sorted[0]]);
            }
        }

        // ✅ 예측 포인트 간 세그먼트만 그리기 (마지막 이후로는 라인 없음)
        if (sorted.length < 2) {
            requestAnimationFrame(() => requestAnimationFrame(updateOverlayPositions));
            return;
        }

        const startColor = "#22c55e"; 
        const endColor = "#f97316";   
        const segCount = sorted.length - 1;

        for (let i = 0; i < segCount; i++) {
            const t = segCount === 1 ? 1 : i / (segCount - 1);
            const color = lerpColor(startColor, endColor, t);
            const { seg, glow } = addPredictionSegmentSeries(color);
            seg?.setData([sorted[i], sorted[i + 1]]);
            glow?.setData([sorted[i], sorted[i + 1]]);
        }
        requestAnimationFrame(() => updateOverlayPositions());
    }, [points, lastCandle, onPointsChange, clearPredictionSegments, addPredictionSegmentSeries, updateOverlayPositions]);

    const handleRemovePoint = (time: Time) => setPoints(prev => prev.filter(p => compareTime(p.time, time) !== 0));
    const handleClearPoints = () => setPoints([]);

    if (!mounted) return <div className="relative w-full h-full bg-background" />;

    return (
        <div className="relative w-full h-full bg-white dark:bg-[#1a1a1a]">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 z-10">
                    <span className="text-gray-700 dark:text-gray-300 animate-pulse">차트 로딩 중...</span>
                </div>
            )}
            {error && !loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-[#1a1a1a] z-10">
                    <div className="text-red-500 text-lg font-semibold">⚠️ {error}</div>
                </div>
            )}
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
            {hoveredPrice && (
                <div className="absolute top-20 left-4 z-20 bg-white/95 dark:bg-gray-900/95 text-gray-900 dark:text-white backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg text-sm border border-gray-200 dark:border-gray-700">
                    <div className="font-semibold mb-2 text-gray-700 dark:text-gray-300">{hoveredPrice.time}</div>
                    <div className="space-y-1">
                        <div className="flex justify-between gap-6">
                            <span className="text-gray-600 dark:text-gray-400">종가:</span>
                            <span className="font-medium">{hoveredPrice.close.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
            )}
            <div ref={chartContainerRef} className="w-full h-full relative" />
            {overlayMarkers.map((marker, idx) => (
                <div
                    key={marker.id}
                    className="absolute z-30 transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                    style={{ left: marker.x, top: marker.y, display: (marker.x < 0 || marker.y < 0) ? 'none' : 'flex' }}
                    onClick={(e) => { e.stopPropagation(); handleRemovePoint(marker.time); }}
                >
                    <div className="relative flex items-center justify-center">
                        <div className={`absolute left-1/2 -translate-x-1/2 pointer-events-none ${idx % 2 === 0 ? "-top-10" : "top-6"}`}>
                            <div className="rounded-md bg-black/70 text-white text-[11px] px-2 py-1 whitespace-nowrap shadow-lg border border-white/10 opacity-80 transition-opacity group-hover:opacity-100">
                                <div className="font-semibold">{formatPointTimeLabel(marker.time)}</div>
                                <div className="opacity-95">{marker.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}</div>
                            </div>
                        </div>
                        <div className="absolute w-6 h-6 bg-orange-500/40 rounded-full animate-pulse blur-sm" />
                        <div className="relative w-3 h-3 rounded-full bg-gradient-to-br from-yellow-300 to-orange-600 border border-white/50 shadow-[0_0_10px_rgba(251,146,60,0.8)] transition-transform group-hover:scale-125 flex items-center justify-center">
                            <span className="text-[8px] text-white opacity-0 group-hover:opacity-100 font-bold">✕</span>
                        </div>
                    </div>
                </div>
            ))}
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
                <div className="flex items-center bg-white/95 dark:bg-gray-950/80 border border-gray-200 dark:border-white/10 rounded-lg p-1 shadow-md">
                    <Button variant="ghost" size="sm" className={`h-7 px-2 text-xs ${futureMode === "1m" ? "bg-blue-600 text-white" : ""}`} onClick={() => setFutureMode("1m")}>1개월</Button>
                    <Button variant="ghost" size="sm" className={`h-7 px-2 text-xs ${futureMode === "3m" ? "bg-blue-600 text-white" : ""}`} onClick={() => setFutureMode("3m")}>3개월</Button>
                    <Button variant="ghost" size="sm" className={`h-7 px-2 text-xs ${futureMode === "custom" ? "bg-blue-600 text-white" : ""}`} onClick={() => setFutureMode("custom")}>직접</Button>
                </div>
                {futureMode === "custom" && (
                    <div className="flex items-center bg-white/95 dark:bg-gray-950/80 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 shadow-md">
                        <input type="number" min={1} max={365} value={customDays} onChange={(e) => setCustomDays(parseInt(e.target.value || "30", 10))} className="w-16 bg-transparent text-sm outline-none text-gray-900 dark:text-white" placeholder="일" />
                    </div>
                )}
            </div>
            {points.length > 0 && (
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                    <Button onClick={() => setShowPointsPanel((v) => !v)} variant="outline" size="sm">포인트 ({points.length})</Button>
                    <Button onClick={handleClearPoints} variant="outline" size="sm">초기화</Button>
                </div>
            )}
            {showPointsPanel && points.length > 0 && (
                <div className="absolute top-16 right-4 z-30 w-[280px] max-h-[55vh] overflow-auto rounded-xl border border-gray-200 bg-white/95 backdrop-blur-sm shadow-xl dark:border-white/10 dark:bg-gray-950/80">
                    <div className="flex items-center justify-between px-3 py-2 border-b">
                        <div className="text-sm font-semibold">예측 포인트</div>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setShowPointsPanel(false)}>닫기</Button>
                    </div>
                    <div className="p-2 space-y-2">
                        {formattedPoints.map((p) => (
                            <div key={`${p.time}-${p.value}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-gray-100 dark:hover:bg-white/10">
                                <div>
                                    <div className="text-xs font-medium">{formatPointTime(p.time)}</div>
                                    <div className="text-xs text-gray-600 dark:text-gray-300">{p.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}</div>
                                </div>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-600" onClick={() => handleRemovePoint(p.time)}>삭제</Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}