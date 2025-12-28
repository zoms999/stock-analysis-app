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
    const areaGlowSeriesRef = useRef<ISeriesApi<"Area"> | null>(null); // 파란색 라인 광채용 추가
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const predictionSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const predictionGlowSeriesRef = useRef<ISeriesApi<"Line"> | null>(null); // Lightsaber glow effect
    // ✅ Segmented prediction lines (each segment = its own LineSeries)
    const predictionSegmentSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
    const predictionGlowSegmentSeriesRef = useRef<ISeriesApi<"Line">[]>([]);

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
    const [showPointsPanel, setShowPointsPanel] = useState(false);

    // ✅ 모바일/좁은 화면 여부 (tick/spacing 등 UX 분기용)
    // 단순 640px 기준만 쓰면 태블릿/모바일 가로 등에서 누락될 수 있어, 900px까지를 "좁은 화면"으로 봅니다.
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
        // addEventListener 지원 브라우저 우선
        if ("addEventListener" in mq) {
            mq.addEventListener("change", update);
            return () => mq.removeEventListener("change", update);
        }
        // 구형 Safari 대응
        // @ts-expect-error - Safari 구버전 matchMedia는 addListener/removeListener만 지원
        mq.addListener?.(update);
        // @ts-expect-error - Safari 구버전 matchMedia는 addListener/removeListener만 지원
        return () => mq.removeListener?.(update);
    }, []);

    // --- [HTML Overlay Logic] ---
    const [overlayMarkers, setOverlayMarkers] = useState<{ id: string; x: number; y: number; time: Time; value: number }[]>([]);

    const updateOverlayPositions = useCallback(() => {
        const chart = chartRef.current;

        // ✅ 세그먼트가 있으면 그 중 하나로 좌표계 사용
        const ySeries =
            predictionSegmentSeriesRef.current[0] ||
            predictionSeriesRef.current ||
            areaSeriesRef.current ||
            candlestickSeriesRef.current;

        if (!chart || !ySeries || points.length === 0) {
            setOverlayMarkers([]);
            return;
        }

        const newMarkers = points.map((p) => {
            const timeScale = chart.timeScale();
            // timeToCoordinate gives X (allows undefined if off-screen, but we handle that)
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

    // ✅ 모바일 최적화: 기본 표시 구간을 짧게 잡아 tick이 "월"이 아니라 "일"로 내려오게 함
    // - 사용자 조작을 방해하지 않도록 최초 1회만 적용
    const mobileInitRef = useRef(false);
    useEffect(() => {
        if (!mounted) return;
        if (!isNarrowScreen) return;
        if (mobileInitRef.current) return;

        // 일봉에서 "일별"로 보이게 하려면 과거 구간을 너무 길게 잡으면 월 tick으로 뭉칩니다.
        // 기본값: 최근 14일 + 미래는 기존 UI 그대로 사용(오프셋/예측 공간)
        if (interval === "D") {
            setFutureMode("custom");
            setCustomDays(14);
        }

        mobileInitRef.current = true;
    }, [mounted, isNarrowScreen, interval]);

    // Keep base (real) data for re-apply when future range changes (no refetch)
    const baseCandleDataRef = useRef<CandlestickData[]>([]);
    const baseAreaDataRef = useRef<{ time: Time; value: number }[]>([]);
    const baseVolumeDataRef = useRef<HistogramData[]>([]);

    // --- [Refs for Event Access] ---
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

    // ✅ Time 타입 안전 비교 유틸 (string/number 모두 처리)
    const timeToTs = useCallback(
        (t: Time) => (typeof t === "string" ? new Date(t).getTime() : (t as number) * 1000),
        []
    );
    const compareTime = useCallback((a: Time, b: Time) => timeToTs(a) - timeToTs(b), [timeToTs]);

    const formatPointTime = useCallback((t: Time) => {
        // YYYY-MM-DD(string) or unix seconds(number)
        if (typeof t === "string") {
            // 문자열 날짜는 그대로 가독성 높게 사용
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

    const formattedPoints = useMemo(() => {
        // UI 패널용: 항상 time 정렬 + 중복 제거
        const unique = new Map<string, PredictionPoint>();
        points.forEach((p) => {
            const key = typeof p.time === "string" ? p.time : String(p.time);
            unique.set(key, p);
        });
        return Array.from(unique.values()).sort((a, b) => compareTime(a.time, b.time));
    }, [points, compareTime]);

    // ✅ interval별 목표 픽셀 간격 (작을수록 촘촘)
    const getTargetBarSpacingPx = (itv: string) => {
        switch (itv) {
            case "1": return 2;   // 1분봉: 매우 촘촘하게 (3 -> 2)
            case "60": return 3;   // 60분봉 (4 -> 3)
            // ✅ 모바일(좁은 화면)에서 일봉은 spacing을 키워서 tick이 월 단위로 뭉치지 않게 유도
            case "D": return isMobileRef.current ? 12 : 4;   // 일봉 (모바일: 더 넓게)
            case "W": return 6;   // 주봉 (10 -> 6)
            case "M": return 10;  // 월봉 (14 -> 10)
            case "Y": return 14;  // 연봉 (18 -> 14)
            default: return 4;
        }
    };

    // ✅ 컨테이너 폭 기반으로 desiredBars 자동 계산
    const calcDesiredBars = (itv: string, containerWidth: number) => {
        const targetPx = getTargetBarSpacingPx(itv);

        // 좌측 가격박스/여백/우측 스케일 등 보정 (120 -> 100으로 축소)
        const usable = Math.max(200, containerWidth - 100);

        // 한 화면에 보여줄 봉 개수
        const bars = Math.floor(usable / targetPx);

        // interval별 최소/최대 가드 (Max 값 대폭 상향)
        const minMax: Record<string, [number, number]> = {
            "1": [120, 1000], // 1분봉 최대 1000개
            "60": [80, 600],   // 60분봉 최대 600개
            "D": [60, 365],   // ✅ 일봉: 90 -> 365 (1년치 한눈에)
            "W": [40, 200],   // 주봉
            "M": [24, 120],   // 월봉
            "Y": [24, 100],   // 연봉
        };

        // ✅ 모바일(좁은 화면) + 일봉은 한 화면에 너무 많은 봉을 넣지 않게 제한(일 단위 tick을 유도)
        const [min, max] =
            (isMobileRef.current && itv === "D")
                ? ([14, 40] as [number, number])
                : (minMax[itv] ?? [40, 300]);
        return Math.max(min, Math.min(max, bars));
    };

    // ✅ futureMode에 맞춰 히스토리 바 수 계산 (일봉 전용)
    const getHistoryBars = (itv: string) => {
        if (itv !== "D") return null; // 일봉이 아니면 자동 계산 사용

        // ✅ 모바일에서는 "일별" 가독성을 위해 기본 과거 범위를 줄임
        if (isMobileRef.current) {
            if (futureMode === "1m") return 30;   // 모바일 1개월: 과거 30일
            if (futureMode === "3m") return 60;   // 모바일 3개월: 과거 60일 (너무 길면 월로 뭉침)
            // custom: customDays * 2 (상한 90)
            return Math.max(14, Math.min(90, customDays * 2));
        }

        if (futureMode === "1m") return 60;  // 1개월: 과거 60일
        if (futureMode === "3m") return 120; // 3개월: 과거 120일

        // custom: customDays * 2 (상한 180)
        return Math.max(30, Math.min(180, customDays * 2));
    };

    // Dummy range points for rangeSeries (time range extension)
    const buildFutureRange = (lastTime: Time, lastValue: number, itv: string, bars: number) => {
        const step = getIntervalSeconds(itv);
        const arr: { time: Time; value: number }[] = [{ time: lastTime, value: lastValue }];

        // Helper to add days to YYYY-MM-DD string
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
                let daysToAdd = i;
                if (itv === 'W' || itv === '1wk') daysToAdd = i * 7;
                if (itv === 'M' || itv === '1mo') daysToAdd = i * 30;
                if (itv === 'D' || itv === '1d') daysToAdd = i;

                const nextDate = addDays(lastTime, daysToAdd);
                arr.push({ time: nextDate as Time, value: lastValue });
            } else {
                // For intraday intervals (numeric timestamps), add seconds
                arr.push({ time: ((lastTime as number) + step * i) as Time, value: lastValue });
            }
        }
        return arr;
    };

    // ✅ Catmull-Rom Spline 알고리즘으로 부드러운 곱선 데이터 생성
    const getInterpolatedData = (points: PredictionPoint[], granularity: number = 20): PredictionPoint[] => {
        if (points.length < 2) return points;

        // Map으로 중복 제거 (time을 키로 사용)
        const dataMap = new Map<string | number, number>();

        // 점들을 시간순 정렬
        const sorted = [...points].sort((a, b) =>
            (typeof a.time === 'string' ? new Date(a.time).getTime() : a.time as number) -
            (typeof b.time === 'string' ? new Date(b.time).getTime() : b.time as number)
        );

        // spline 로직
        for (let i = 0; i < sorted.length - 1; i++) {
            const p0 = sorted[Math.max(0, i - 1)];
            const p1 = sorted[i];
            const p2 = sorted[i + 1];
            const p3 = sorted[Math.min(sorted.length - 1, i + 2)];

            const t1 = typeof p1.time === 'string' ? new Date(p1.time).getTime() / 1000 : p1.time as number;
            const t2 = typeof p2.time === 'string' ? new Date(p2.time).getTime() / 1000 : p2.time as number;
            const step = (t2 - t1) / granularity;

            for (let t = 0; t < granularity; t++) {
                const timeOffset = step * t;
                const x = t / granularity; // 0~1 사이 비율

                // Catmull-Rom interpolation
                const value = 0.5 * (
                    (2 * p1.value) +
                    (-p0.value + p2.value) * x +
                    (2 * p0.value - 5 * p1.value + 4 * p2.value - p3.value) * x * x +
                    (-p0.value + 3 * p1.value - 3 * p2.value + p3.value) * x * x * x
                );

                // 시간 복원 (Daily인 경우 문자열, Intraday인 경우 timestamp)
                let newTime: Time;
                if (typeof p1.time === 'string') {
                    const d = new Date((t1 + timeOffset) * 1000);
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    newTime = `${year}-${month}-${day}` as Time;
                } else {
                    newTime = (t1 + timeOffset) as Time;
                }

                // Map에 저장 (중복 자동 제거)
                dataMap.set(newTime as string | number, value);
            }
        }

        // 마지막 점 추가
        const lastPoint = sorted[sorted.length - 1];
        dataMap.set(lastPoint.time as string | number, lastPoint.value);

        // ✅ [Fix] 원본 포인트들의 값은 절대 변하지 않도록 강제 덮어쓰기
        // (interpolation 과정에서 같은 날짜/시간에 대해 근사값이 들어가는 것을 방지)
        sorted.forEach(p => {
            dataMap.set(p.time as string | number, p.value);
        });

        // Map을 배열로 변환하고 시간순 정렬
        const result = Array.from(dataMap.entries())
            .sort((a, b) => {
                const timeA = typeof a[0] === 'string' ? new Date(a[0]).getTime() : a[0];
                const timeB = typeof b[0] === 'string' ? new Date(b[0]).getTime() : b[0];
                return timeA - timeB;
            })
            .map(([time, value]) => ({ time: time as Time, value }));

        return result;
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

    const addPredictionSegmentSeries = useCallback((color: string) => {
        const chart = chartRef.current;
        if (!chart) return { seg: null as ISeriesApi<"Line"> | null, glow: null as ISeriesApi<"Line"> | null };

        // glow 먼저 (뒤에 깔림)
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
            lineStyle: 0, // Solid line
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
                barSpacing: 4,      // ✅ 6 -> 4로 변경
                minBarSpacing: 0.5, // ✅ 2 -> 0.5로 축소 (더 촘촘하게)
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

        // ✅ 파란색 실측 라인 광채 (뒤에 배치)
        const areaGlowSeries = chart.addSeries(AreaSeries, {
            topColor: "rgba(41, 98, 255, 0)",
            bottomColor: "rgba(0, 0, 0, 0)",
            lineColor: "rgba(41, 98, 255, 0.3)", // 반투명한 파란색
            lineWidth: 4,                      // (타입 허용 범위) 최대 두께
            visible: chartStyle === "line",
        });

        // ✅ 파란색 실측 메인 라인
        const areaSeries = chart.addSeries(AreaSeries, {
            topColor: "rgba(41, 98, 255, 0.1)", // 위쪽은 아주 살짝 투명하게 채움
            bottomColor: "rgba(0, 0, 0, 0)",
            lineColor: "#2962FF",               // 메인 파란색
            lineWidth: 4,                       // 2 -> 4로 두껍게 변경
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

        // ✅ Prediction series (Main Line)
        const predictionSeries = chart.addSeries(LineSeries, {
            color: "#f59e0b",
            lineWidth: 3,
            lineStyle: 0,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
        });

        // ✅ Glow effect series (Blurry wide line behind)
        const predictionGlowSeries = chart.addSeries(LineSeries, {
            color: "rgba(245, 158, 11, 0.4)",
            lineWidth: 4,
            lineStyle: 0,
            crosshairMarkerVisible: false,
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
        areaGlowSeriesRef.current = areaGlowSeries as ISeriesApi<"Area">;
        volumeSeriesRef.current = volumeSeries as ISeriesApi<"Histogram">;
        predictionSeriesRef.current = predictionSeries as ISeriesApi<"Line">;
        predictionGlowSeriesRef.current = predictionGlowSeries as ISeriesApi<"Line">;
        rangeSeriesRef.current = rangeSeries as ISeriesApi<"Line">;

        chartRef.current = chart;

        const handleResize = () => {
            if (!chartContainerRef.current || !chartRef.current) return;

            chart.applyOptions({
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight
            });

            // ✅ 폭 바뀌었으면 desiredBars 다시 계산해서 range 재적용
            const width = chartContainerRef.current.clientWidth;
            const itv = intervalRef.current;
            const desiredBars = calcDesiredBars(itv, width);

            const count = dataCountRef.current;
            const futureBars = futureBarsRef.current;

            // barSpacing 재강제
            const spacing = getTargetBarSpacingPx(itv);
            chartRef.current.timeScale().applyOptions({
                barSpacing: spacing,
                minBarSpacing: 0.5, // ✅ 리사이즈 후에도 촘촘한 줄아웃 유지
            });

            // range 재적용
            if (count > 0) {
                // ✅ 화면에 들어갈 수 있는 개수(autoBars)를 우선 사용
                const historyBars = Math.max(getHistoryBars(itv) || 0, desiredBars);

                const total = historyBars + futureBars;
                const to = (count - 1) + futureBars;
                const from = to - total; // ✅ 음수 허용 (촘촘함 극대화)
                chartRef.current.timeScale().setVisibleLogicalRange({ from, to });
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
                    // ✅ 안전한 time 비교 (string/number 모두 처리)
                    const existsIndex = prev.findIndex((p) => compareTime(p.time, newPoint.time) === 0);
                    const next = [...prev];

                    if (existsIndex >= 0) next[existsIndex] = newPoint;
                    else next.push(newPoint);

                    // ✅ 안전한 정렬
                    next.sort((a, b) => compareTime(a.time, b.time));
                    return next;
                });
            }
        });

        return () => {
            window.removeEventListener("resize", handleResize);
            clearPredictionSegments(); // ✅ 추가
            chart.remove();

            candlestickSeriesRef.current = null;
            areaSeriesRef.current = null;
            areaGlowSeriesRef.current = null;
            volumeSeriesRef.current = null;
            predictionSeriesRef.current = null;
            predictionGlowSeriesRef.current = null;
            rangeSeriesRef.current = null;
            chartRef.current = null;
        };
    }, [mounted, clearPredictionSegments]);

    // Update chart theme/style without recreating
    useEffect(() => {
        const chart = chartRef.current;
        const candleSeries = candlestickSeriesRef.current;
        const areaSeries = areaSeriesRef.current;
        const areaGlowSeries = areaGlowSeriesRef.current;

        if (!chart || !candleSeries || !areaSeries) return;

        // Update layout colors
        chart.applyOptions({
            layout: {
                background: { type: ColorType.Solid, color: isDark ? "#06080f" : "#ffffff" },
                textColor: isDark ? "#6366f1" : "#4B5563",
            },
            grid: {
                vertLines: {
                    color: isDark ? "rgba(99, 102, 241, 0.05)" : "rgba(209, 213, 219, 0.3)",
                },
                horzLines: {
                    visible: false,
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
        areaGlowSeries?.applyOptions({ visible: chartStyle === "line" });
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
                areaGlowSeriesRef.current?.setData(areaData);
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
                const lastRealTime = lastReal.time; // Keep as Time (can be string or number)
                const lastRealClose = lastReal.close;

                const rangeData = buildFutureRange(lastRealTime, lastRealClose, interval, futureBars);
                rangeSeriesRef.current?.setData(rangeData);

                // ✅ futureBars를 ref에 저장 (resize에서 사용)
                futureBarsRef.current = futureBars;

                // Apply timeScale options (rightOffset matches chosen future range)
                if (chartRef.current && chartContainerRef.current) {
                    const isIntraday = ["60", "1"].includes(interval);

                    // ✅ 1) barSpacing도 interval별로 강제
                    const spacing = getTargetBarSpacingPx(interval);
                    chartRef.current.applyOptions({
                        timeScale: {
                            timeVisible: isIntraday,
                            secondsVisible: false,
                            borderColor: "#D1D5DB",
                            rightOffset: futureBars,
                            barSpacing: spacing,
                            minBarSpacing: Math.max(2, Math.floor(spacing * 0.5)),
                            tickMarkFormatter: (t: number | string, tickMarkType: TickMarkType) => {
                                // Handle both string dates (YYYY-MM-DD) and numeric timestamps
                                const date = typeof t === 'string' ? new Date(t) : new Date((t as number) * 1000);
                                const year = date.getFullYear();
                                const month = (date.getMonth() + 1).toString().padStart(2, "0");
                                const day = date.getDate().toString().padStart(2, "0");

                                // ✅ 모바일 + 일봉(D)에서는 월/년으로 뭉치지 말고 항상 "일" 단위로 표기
                                // (tickMarkType이 Month/Year로 들어와도 강제로 일 표기)
                                if (isMobileRef.current && intervalRef.current === "D") {
                                    return `${month}.${day}`;
                                }

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

                    // ✅ 2) 화면 폭에 맞춰 desiredBars 자동 계산 (일봉은 futureMode 기반)
                    const width = chartContainerRef.current.clientWidth;
                    const autoBars = calcDesiredBars(interval, width);
                    // ✅ 둘 중 더 큰 값을 사용하여 화면을 꽉 채움
                    const historyBars = Math.max(getHistoryBars(interval) || 0, autoBars);

                    // ✅ 3) 미래 영역 포함해서 visible range 고정 (음수 허용으로 촘촘함 극대화)
                    const total = historyBars + futureBars;
                    const to = (data.length - 1) + futureBars;
                    const from = to - total; // ✅ Math.max(0) 제거 → 음수 허용

                    chartRef.current.timeScale().setVisibleLogicalRange({ from, to });
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
        const lastTime = lastReal.time; // Keep as Time (can be string or number)
        const lastClose = lastReal.close;

        const rangeData = buildFutureRange(lastTime, lastClose, itv, futureBars);
        rangeSeriesRef.current.setData(rangeData);

        // ✅ futureBarsRef 갱신
        futureBarsRef.current = futureBars;

        chartRef.current.applyOptions({
            timeScale: { rightOffset: futureBars },
        });

        // ✅ visibleLogicalRange 재적용 (futureMode 변경 시에도 간격 유지)
        if (chartContainerRef.current) {
            const width = chartContainerRef.current.clientWidth;
            const autoBars = calcDesiredBars(itv, width);
            // ✅ 여기서도 max 값을 사용하여 화면 밀도 유지
            const historyBars = Math.max(getHistoryBars(itv) || 0, autoBars);

            const count = baseC.length;
            const to = (count - 1) + futureBars;
            const total = historyBars + futureBars;
            const from = to - total; // ✅ 음수 허용

            chartRef.current.timeScale().setVisibleLogicalRange({ from, to });
        }
    }, [futureMode, customDays]);

    // 3) Update Prediction Line + Markers
    useEffect(() => {
        onPointsChange?.(points);

        const chart = chartRef.current;
        if (!chart) return;

        // 단색 시리즈는 여기서는 안 쓰게 만들거라서 비움
        predictionSeriesRef.current?.setData([]);
        predictionGlowSeriesRef.current?.setData([]);

        // ✅ 세그먼트 시리즈 정리
        clearPredictionSegments();

        let dataToShow = [...points];

        // lastCandle 연결
        if (lastCandle && points.length > 0) {
            if (compareTime(points[0].time, lastCandle.time) !== 0) {
                dataToShow = [lastCandle, ...points];
            }
        }

        // 유니크 + 정렬
        const unique = new Map<Time, number>();
        dataToShow.forEach((d) => unique.set(d.time, d.value));
        const sorted = Array.from(unique.entries())
            .map(([t, v]) => ({ time: t, value: v }))
            .sort((a, b) => compareTime(a.time, b.time));

        if (sorted.length < 2) {
            requestAnimationFrame(() => requestAnimationFrame(updateOverlayPositions));
            return;
        }

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

        // ✅ 오버레이 위치 갱신 (오토스케일 이후)
        requestAnimationFrame(() => {
            updateOverlayPositions();
        });

    }, [points, lastCandle, onPointsChange, clearPredictionSegments, addPredictionSegmentSeries, updateOverlayPositions]);

    const handleRemovePoint = (time: Time) => {
        setPoints(prev => prev.filter(p => compareTime(p.time, time) !== 0));
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
                        display: (marker.x < 0 || marker.y < 0) ? 'none' : 'flex'
                    }}
                    title={`${formatPointTime(marker.time)} / ${marker.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePoint(marker.time);
                    }}
                >
                    {/* ✅ 이미지 스타일의 네온 포인트 마커 */}
                    <div className="relative flex items-center justify-center">
                        {/* ✅ 날짜/값 툴팁 (PC: hover, 모바일: title/패널로 보완) */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block pointer-events-none">
                            <div className="rounded-md bg-black/80 text-white text-[11px] px-2 py-1 whitespace-nowrap shadow-lg border border-white/10">
                                <div className="font-semibold">{formatPointTime(marker.time)}</div>
                                <div className="opacity-90">
                                    {marker.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* 외곽 광채 */}
                        <div className="absolute w-6 h-6 bg-orange-500/40 rounded-full animate-pulse blur-sm" />
                        {/* 메인 포인트 */}
                        <div className="relative w-3 h-3 rounded-full bg-gradient-to-br from-yellow-300 to-orange-600 border border-white/50 shadow-[0_0_10px_rgba(251,146,60,0.8)] transition-transform group-hover:scale-125 flex items-center justify-center">
                            <span className="text-[8px] text-white opacity-0 group-hover:opacity-100 font-bold">✕</span>
                        </div>
                    </div>

                    {/* 가이드 라인 스타일 개선 */}
                    <div className="absolute top-[10px] h-[1000px] w-[1px] bg-gradient-to-b from-orange-400/50 to-transparent border-l border-dashed border-orange-400/30 pointer-events-none hidden group-hover:block z-[-1]" />
                </div>
            ))}

            {/* Future Range Controls */}
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
                <div className="flex items-center bg-white/95 dark:bg-gray-950/80 border border-gray-200 dark:border-white/10 rounded-lg p-1 shadow-md">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 px-2 rounded-md text-xs font-medium transition-colors ${futureMode === "1m"
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
                        className={`h-7 px-2 rounded-md text-xs font-medium transition-colors ${futureMode === "3m"
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
                        className={`h-7 px-2 rounded-md text-xs font-medium transition-colors ${futureMode === "custom"
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
                            aria-label="직접 기간(일) 입력"
                            title="직접 기간(일) 입력"
                            placeholder="일"
                            className="w-16 bg-transparent text-sm outline-none text-gray-900 dark:text-white"
                        />
                    </div>
                )}
            </div>

            {/* Clear prediction points */}
            {points.length > 0 && (
                <div className="absolute top-4 right-4 z-20">
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => setShowPointsPanel((v) => !v)}
                            variant="outline"
                            size="sm"
                            className="shadow-md bg-white hover:bg-gray-50 text-gray-900 border-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white dark:border-gray-600"
                        >
                            포인트 ({points.length})
                        </Button>
                        <Button
                            onClick={handleClearPoints}
                            variant="outline"
                            size="sm"
                            className="shadow-md bg-white hover:bg-gray-50 text-gray-900 border-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white dark:border-gray-600"
                        >
                            예측 초기화 ({points.length})
                        </Button>
                    </div>
                </div>
            )}

            {/* ✅ Prediction Points Panel (가독성 개선) */}
            {showPointsPanel && points.length > 0 && (
                <div className="absolute top-16 right-4 z-30 w-[280px] max-h-[55vh] overflow-auto rounded-xl border border-gray-200 bg-white/95 backdrop-blur-sm shadow-xl dark:border-white/10 dark:bg-gray-950/80">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-white/10">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">예측 포인트</div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setShowPointsPanel(false)}
                            >
                                닫기
                            </Button>
                        </div>
                    </div>

                    <div className="p-2 space-y-2">
                        {formattedPoints.map((p) => (
                            <div
                                key={`${p.time}-${p.value}`}
                                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-gray-100 dark:hover:bg-white/10"
                            >
                                <div className="min-w-0">
                                    <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                        {formatPointTime(p.time)}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-300">
                                        {p.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
                                    onClick={() => handleRemovePoint(p.time)}
                                >
                                    삭제
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
