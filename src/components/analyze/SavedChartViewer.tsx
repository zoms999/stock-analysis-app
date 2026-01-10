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
    LogicalRange,
} from "lightweight-charts";
import { fetchTwelveDataCandles, subscribeTwelveDataPrices } from "@/lib/api/twelvedata";

type ViewStyle = "candle" | "line";

interface SavedChartViewerProps {
    symbol: string;
    interval: string;
    predictionPoints?: Array<{ time: Time; value: number }>;
    chartStyle?: ViewStyle;
    defaultStyle?: ViewStyle; // ✅ 상세 기본 line
    showStyleToggle?: boolean;
    // ✅ 카드(메인 리스트)에서는 "오늘(현재일)" 기준으로만 보여주기 위해 미래 확장/예측 오버레이를 끌 수 있음
    mode?: "detail" | "card";
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
    mode = "detail",
}: SavedChartViewerProps) {
    const { theme, systemTheme } = useTheme();
    const currentTheme = theme === "system" ? systemTheme : theme;
    const isDark = currentTheme === "dark";

    // ✅ Helper to get consistent timestamp in ms
    const getTs = useCallback((t: Time) => (typeof t === 'string' ? new Date(t).getTime() : (t as number) * 1000), []);

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
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

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

    // ✅ 차트가 재성성될 때(테마 변경 등) 기존 줌/스크롤 위치(LogicalRange)를 저장해두었다가 복구
    const savedRangeRef = useRef<LogicalRange | null>(null);
    const prevIntervalRef = useRef<string>(interval);

    const getIntervalSeconds = (itv: string) => {
        if (itv === "1") return 60;
        if (itv === "60") return 3600;
        if (itv === "D") return 86400;
        if (itv === "W") return 604800;
        if (itv === "M") return 2592000;
        if (itv === "Y") return 31536000;
        return 86400;
    };

    // ✅ 카드 모드: "오늘(마지막 캔들)" 기준으로 우측 끝을 맞추고 최근 N개만 노출
    const getCardWindowBars = useCallback((itv: string) => {
        switch (itv) {
            case "1": return 240;   // 1분봉: 최근 4시간
            case "60": return 240;  // 60분봉: 최근 10일
            case "D": return 45;    // 일봉: 최근 1.5개월
            case "W": return 52;    // 주봉: 최근 1년
            case "M": return 36;    // 월봉: 최근 3년
            case "Y": return 20;    // 연봉: 최근 20년(사실상 충분)
            default: return 45;
        }
    }, []);

    // ✅ 카드 모드: 미래 예측을 보여주되, 축이 멀리(2026 등) 밀리지 않도록 미래 여백을 강하게 제한
    const getCardFutureBarsCap = useCallback((itv: string) => {
        switch (itv) {
            case "1": return 120;  // 1분봉: 최대 2시간치 미래
            case "60": return 48;  // 60분봉: 최대 2일치 미래
            case "D": return 10;   // 일봉: 최대 10일치 미래 (카드에서 과도한 공백 방지)
            case "W": return 8;    // 주봉: 최대 8주
            case "M": return 6;    // 월봉: 최대 6개월
            case "Y": return 3;    // 연봉: 최대 3년
            default: return 10;
        }
    }, []);

    // ✅ 상세 모드: ChartAnalyzer처럼 촘촘한 날짜 간격을 위한 barSpacing
    const getTargetBarSpacingPx = useCallback((itv: string) => {
        switch (itv) {
            case "1": return 2;
            case "60": return 2;
            case "D": return 2;   // 일봉: 촘촘하게
            case "W": return 3;
            case "M": return 5;
            case "Y": return 7;
            default: return 2;
        }
    }, []);

    // ✅ 상세 모드: "이번 달 1일" Time 생성
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

    // ✅ 상세 모드: time 비교 유틸
    const compareTime = useCallback((a: Time, b: Time) => getTs(a) - getTs(b), [getTs]);

    const formatTick = (t: number | string, tickMarkType: TickMarkType, itv: string) => {
        const date = typeof t === "string" ? new Date(t) : new Date(t * 1000);
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const year = date.getFullYear();

        // ✅ 일봉(D)에서는 항상 MM.DD 형식으로 표시 (촘촘하게)
        if (itv === "D") {
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
            color: hexToRgba(color, mode === "card" ? 0.18 : 0.35),
            lineWidth: (mode === "card" ? 4 : 10) as any,
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
    }, [mode]);

    // 미래 여백: 예측점이 미래면 그만큼 rightOffset 확보
    const computeFutureBarsFromPrediction = useCallback(() => {
        const last = lastRealRef.current;
        // ✅ 예측이 없거나 계산 불가한 경우에도 최소 5bar 정도의 미래 여백만 확보 (너무 커지면 실측/예측이 좌측으로 밀림)
        if (!last) return 5;

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

        if (maxPred <= lastTime) return 5;

        let diffSeconds = 0;
        if (typeof maxPred === 'string' && typeof lastTime === 'string') {
             diffSeconds = (new Date(maxPred).getTime() - new Date(lastTime).getTime()) / 1000;
        } else {
             diffSeconds = (maxPred as number) - (lastTime as number);
        }
        const needBars = Math.ceil(diffSeconds / step) + 5;
        return Math.max(5, needBars);
    }, [predictionPoints, interval]);

    // ✅ 카드 모드: 미래 예측은 보여주되, 축이 멀리(2026 등) 밀리지 않도록 미래 여백을 강하게 제한
    // (ReferenceError 방지를 위해 computeFutureBarsFromPrediction "이후"에 선언)
    const computeFutureBarsForCard = useCallback(() => {
        const base = computeFutureBarsFromPrediction();
        const cap = getCardFutureBarsCap(interval);
        return Math.max(0, Math.min(base, cap));
    }, [computeFutureBarsFromPrediction, getCardFutureBarsCap, interval]);

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
        // ✅ 카드에서는 글로우 OFF (번짐 방지)
        areaGlow.applyOptions({ visible: viewStyle === "line" && mode !== "card" });


        if (savedRangeRef.current) {
            // ✅ 저장된 뷰가 있다면 복구 (테마 변경 시 깜빡임/리셋 방지)
            chart.timeScale().setVisibleLogicalRange(savedRangeRef.current);
            savedRangeRef.current = null; // 1회성 소모
        } else if (lastRealRef.current && rangeSeriesRef.current) {
            // ✅ card 모드: 예측 라인은 보여주되, 미래 여백은 제한
            const futureBars = mode === "card" ? computeFutureBarsForCard() : computeFutureBarsFromPrediction();
            chart.applyOptions({ timeScale: { rightOffset: futureBars } });

            const rangeData = buildRangeData(lastRealRef.current.time, lastRealRef.current.close, interval, futureBars);
            rangeSeriesRef.current.setData(rangeData as any);
            
            // ✅ card 모드: "오늘(마지막 캔들)" 기준으로 최근 구간 + 제한된 미래(예측)까지 보이게 고정
            if (mode === "card") {
                const count = baseC.length; // candle.getData().length 대신 baseC 사용
                const bars = getCardWindowBars(interval);
                const toIndex = Math.max(0, count - 1);
                const fromIndex = Math.max(0, toIndex - bars);
                chart.timeScale().setVisibleLogicalRange({ from: fromIndex, to: toIndex + futureBars });
            } else {
                // ✅ detail 모드: "이번 달 1일 ~ 오늘 + 5일 여백" 범위 설정 (기존 디폴트 로직)
                if (interval === "D") {
                    const last = baseC[baseC.length - 1];
                    const pad2 = (n: number) => String(n).padStart(2, "0");
                    const toYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

                    const lastRealTime = last.time;
                    const lastDate = typeof lastRealTime === "string" ? new Date(lastRealTime) : new Date((lastRealTime as number) * 1000);
                    const cutoff = new Date(lastDate);
                    cutoff.setDate(cutoff.getDate() - 30);
                    const cutoffYmd = toYmd(cutoff);

                    const fromIndex = (() => {
                        for (let i = 0; i < baseC.length; i++) {
                            const t = baseC[i]?.time;
                            if (typeof t === "string") {
                                if (t >= cutoffYmd) return i;
                            } else if (typeof t === "number") {
                                const ymd = toYmd(new Date(t * 1000));
                                if (ymd >= cutoffYmd) return i;
                            }
                        }
                        return Math.max(0, baseC.length - 40);
                    })();

                    const toIndex = (baseC.length - 1) + futureBars;
                    chart.timeScale().setVisibleLogicalRange({ from: fromIndex, to: toIndex });
                } else {
                    chart.timeScale().fitContent();
                }
            }
        } else {
            // fallback
            chart.applyOptions({ timeScale: { rightOffset: 0 } });
        }
    }, [viewStyle, interval, computeFutureBarsFromPrediction, computeFutureBarsForCard, mode]);


    // 3) Prediction line inject (Segmented Gradient)
    const updatePredictionSeries = useCallback(() => {
        const chart = chartRef.current;
        if (!chart) return;

        // ✅ card 모드: 예측 라인은 보여주되, 마커(라벨)는 카드에서 과밀하니 숨김
        if (mode === "card") {
            markerPointsRef.current = [];
            setOverlayMarkers([]);
        }

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

            // ✅ card 모드에서는 마커를 표시하지 않음
            if (mode !== "card") {
                markerPointsRef.current = predOnlySorted;
                // 좌표 업데이트는 다음 프레임에 (시리즈 setData 후 좌표계 안정화)
                requestAnimationFrame(updateOverlayPositions);
            }
            
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
        // ✅ rightOffset 등 timeScale이 바뀐 뒤에도 한 번 더 보정
        if (mode !== "card") requestAnimationFrame(updateOverlayPositions);

    }, [predictionPoints, applyBaseDataToSeries, clearPredictionSegments, addPredictionSegmentSeries, mode, updateOverlayPositions]);


    const _addPredictionSegmentSeries_UNUSED = useCallback((color: string) => {
        const chart = chartRef.current;
        if (!chart) return { seg: null as any, glow: null as any };

        // glow 먼저 (뒤에 깔림)
        const glow = chart.addSeries(LineSeries, {
            color: hexToRgba(color, mode === "card" ? 0.18 : 0.35),
            lineWidth: (mode === "card" ? 4 : 10) as any,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
            visible: true,
        }) as ISeriesApi<"Line">;

        const seg = chart.addSeries(LineSeries, {
            color: hexToRgba(color, 1),
            lineWidth: 3,
            lineStyle: 0,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
        }) as ISeriesApi<"Line">;

        predGlowSegmentSeriesRef.current.push(glow);
        predSegmentSeriesRef.current.push(seg);

        return { seg, glow };
    }, [mode]);



    // 1) Init/Recreate chart (when theme or viewStyle changes)
    useEffect(() => {
        if (!chartContainerRef.current) return;

        // cleanup old chart (safeguard, though cleanup function handles it)
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

        // check interval change
        if (prevIntervalRef.current !== interval) {
            savedRangeRef.current = null;
        }
        prevIntervalRef.current = interval;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: isDark ? "#0a0a0a" : "#ffffff" },
                textColor: isDark ? "#9CA3AF" : "#4B5563",
                fontSize: 12,
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            grid: {
                // ✅ 상세(mode=detail): 가로 라인은 제거하고 세로 라인만 잘 보이도록
                // ✅ 카드(mode=card): 기존처럼 깔끔하게(과한 대비 방지)
                vertLines: {
                    color: mode === "detail"
                        ? (isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(209, 213, 219, 0.45)")
                        : (isDark ? "rgba(105,105,105,0.2)" : "rgba(209,213,219,0.3)"),
                    visible: true,
                },
                horzLines: {
                    color: isDark ? "rgba(105,105,105,0.2)" : "rgba(209,213,219,0.3)",
                    visible: mode === "detail" ? false : true,
                },
            },
            timeScale: {
                visible: true,
                timeVisible: ["1", "60"].includes(interval),
                secondsVisible: false,
                // ✅ Card mode: Give small buffer (5px) to prevent stroke clipping
                rightOffset: mode === "card" ? 10 : 20,
                borderColor: isDark ? "#2a2a2a" : "#E5E7EB",
                barSpacing: getTargetBarSpacingPx(interval),
                minBarSpacing: 0.1,
                tickMarkFormatter: (t: number | string, tickMarkType: TickMarkType) => formatTick(t, tickMarkType, interval),
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
            lineColor: "rgba(41, 98, 255, 0.25)", // 반투명한 파란색
            lineWidth: 8 as any,                  // 상세에서만 글로우
            // ✅ 카드(리스트)에서는 글로우가 번져 보이므로 비활성화
            visible: viewStyle === "line" && mode !== "card",
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
            lineWidth: (mode === "card" ? 4 : 10) as any,
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

        // ✅ timeScale 옵션은 createChart 시점에 통일해서 적용 (중복 applyOptions로 덮어쓰면 축/라벨/간격이 깨질 수 있음)

        const syncSize = () => {
            if (!chartContainerRef.current) return;
            const w = chartContainerRef.current.clientWidth;
            const h = chartContainerRef.current.clientHeight;
            if (w <= 0 || h <= 0) return;
            chart.applyOptions({ width: w, height: h });
            // 차트 크기 변동 후 오버레이 좌표 재계산 (첫 로딩/레이아웃 확정 시점 포함)
            requestAnimationFrame(updateOverlayPositions);
        };
        window.addEventListener("resize", syncSize);

        // ✅ window resize만으로는 라우트 전환/폰트 로딩 등으로 생기는 컨테이너 크기 변화(초기 렌더)를 못 잡을 수 있어 ResizeObserver 사용
        if (typeof ResizeObserver !== "undefined" && chartContainerRef.current) {
            resizeObserverRef.current?.disconnect();
            resizeObserverRef.current = new ResizeObserver(() => {
                // 연속 resize 이벤트에서 layout thrash 방지
                requestAnimationFrame(syncSize);
            });
            resizeObserverRef.current.observe(chartContainerRef.current);
        }

        // ✅ 초기 1프레임 뒤에 한 번 더 사이즈 동기화 (처음 열 때만 틀어지는 케이스 방지)
        requestAnimationFrame(syncSize);

        // ✅ 재생성 직후 base 데이터 즉시 주입 (이게 없으면 토글시 빈 차트)
        setTimeout(() => {
            applyBaseDataToSeries();
            updatePredictionSeries(); // ✅ 차트 재생성 후 예측 라인도 다시 그려야 함
        }, 0);

        return () => {
             // ✅ CLEANUP runs BEFORE next effect setup. Save range HEREs.
            if (chartRef.current) {
                // interval 변경이 아닐 때만 저장하고 싶지만, 
                // 여기서 next interval을 알 수 없음.
                // 그러므로 무조건 저장하고, setup(위쪽)에서 interval 비교 후 채택/폐기 결정
                savedRangeRef.current = chartRef.current.timeScale().getVisibleLogicalRange();
            }

            window.removeEventListener("resize", syncSize);
            resizeObserverRef.current?.disconnect();
            resizeObserverRef.current = null;
            clearPredictionSegments();
            chart.remove();
            chartRef.current = null;
        };
    }, [isDark, viewStyle, interval, applyBaseDataToSeries, clearPredictionSegments, getTargetBarSpacingPx, mode, updateOverlayPositions, updatePredictionSeries]);

    // 2) Fetch data (only when symbol/interval changes)
    useEffect(() => {
        const run = async () => {
            if (!chartRef.current || !candleSeriesRef.current || !areaSeriesRef.current || !areaGlowSeriesRef.current || !volumeSeriesRef.current) return;

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

                // applyBaseDataToSeries 내부로 로직 이동됨 (savedRangeRef 체크 포함)
                // 하지만 FETCH 직후에는 savedRangeRef가 없을 것이므로(interval/symbol 변경),
                // applyBaseDataToSeries 내부의 default logic이 실행되어야 하는데,
                // 위에서 호출한 applyBaseDataToSeries()가 이미 로직을 수행함.
                // 따라서 여기서는 중복 호출할 필요가 없음.
                
                // 단, FETCH 시점에는 savedRangeRef가 비어있어야 함을 보장해야 하지만, 
                // interval 변경 시에는 effect[1]이 먼저 돌아 null or savedRange가 됨.
                // symbol 변경 시에는 savedRangeRef가 이전 값일 수 있나?
                // symbol 변경 -> effect[1] 안 돔 -> savedRangeRef 그대로? 
                // symbol 변경 시에는 무조건 리셋하고 싶음.
                savedRangeRef.current = null; // 안전장치: 데이터 새로 받으면 뷰 리셋
                applyBaseDataToSeries();

                // ✅ 축 범위 설정 이후 오버레이 좌표 재계산 (첫 진입 시 간헐적 불일치 방지)
                if (mode !== "card") {
                    requestAnimationFrame(updateOverlayPositions);
                }
            } catch (e) {
                console.error("[SavedChartViewer] fetch error:", e);
                setError("차트 데이터를 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        run();

        // ✅ 실시간 현재가 스트리밍 (마지막 실측 캔들의 close/high/low 보정에 활용 가능)
        // 홈 카드(mode="card")에선 차트 미리보기만 필요하므로 스트리밍 구독을 끄고
        // 목록 단위(ChartBoardList)의 배치 구독만 사용해 SSE 연결 폭주를 방지합니다.
        const sub =
            mode === "card"
                ? { close: () => {} }
                : subscribeTwelveDataPrices([symbol], (msg) => {
                      const p = Number(msg.price);
                      if (!Number.isFinite(p)) return;
                      const last = lastRealRef.current;
                      if (!last) return;
                      lastRealRef.current = {
                          ...last,
                          close: p,
                      };
                  });

        return () => sub.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, interval, applyBaseDataToSeries, mode, getCardWindowBars, computeFutureBarsForCard]);





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

            {/* ✅ Prediction Points Overlay Markers (항상 라벨 표시 / 지그재그 배치) */}
            {overlayMarkers.map((m, idx) => (
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
                        <div
                            className={`absolute left-1/2 -translate-x-1/2 ${idx % 2 === 0 ? "-top-10" : "top-6"}`}
                        >
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
