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
    AreaSeries
} from "lightweight-charts";
import { fetchYahooCandles } from "@/lib/api/yahoo";
import { Button } from "@/components/ui/button";

interface ChartAnalyzerProps {
    symbol: string;
    interval: string;
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

export function ChartAnalyzer({ symbol, interval, chartStyle = "candle", onPointsChange, onChartCapture }: ChartAnalyzerProps) {
    const { theme, systemTheme } = useTheme();
    const currentTheme = theme === 'system' ? systemTheme : theme;
    const isDark = currentTheme === 'dark';

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);


    const [points, setPoints] = useState<PredictionPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [priceChange, setPriceChange] = useState<{ value: number; percent: number } | null>(null);
    const [hoveredPrice, setHoveredPrice] = useState<{ time: string; open: number; high: number; low: number; close: number; volume?: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Capture chart as image
    const captureChart = useCallback(async () => {
        if (!chartContainerRef.current) return null;

        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(chartContainerRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
            });

            const imageDataUrl = canvas.toDataURL('image/png');
            if (onChartCapture) {
                onChartCapture(imageDataUrl);
            }
            return imageDataUrl;
        } catch (error) {
            console.error('Failed to capture chart:', error);
            return null;
        }
    }, [onChartCapture]);

    // 1. Initialize Chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: isDark ? "#0a0a0a" : "#ffffff" },
                textColor: isDark ? "#9CA3AF" : "#4B5563",
                fontSize: 12,
            },
            width: chartContainerRef.current.clientWidth,
            height: 500,
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
                rightOffset: 20,
                borderColor: isDark ? "#2a2a2a" : "#E5E7EB",
            },
            rightPriceScale: {
                borderColor: isDark ? "#2a2a2a" : "#E5E7EB",
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.2,
                },
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

        // Original style: Red for up, Blue for down
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: "#ef4444",
            downColor: "#3b82f6",
            borderVisible: false,
            wickUpColor: "#ef4444",
            wickDownColor: "#3b82f6",
            borderUpColor: "#ef4444",
            borderDownColor: "#3b82f6",
            visible: chartStyle === 'candle',
        });

        // Area Series (Line Chart)
        const areaSeries = chart.addSeries(AreaSeries, {
            topColor: 'rgba(41, 98, 255, 0.4)',
            bottomColor: 'rgba(41, 98, 255, 0.0)',
            lineColor: '#2962FF',
            lineWidth: 2,
            visible: chartStyle === 'line',
        });

        // Volume histogram
        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: '#26a69a',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: 'volume',
        });

        volumeSeries.priceScale().applyOptions({
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });



        // Line series for connecting prediction points
        const lineSeries = chart.addSeries(LineSeries, {
            color: '#2962FF',
            lineWidth: 2,
            lineStyle: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
        });

        candlestickSeriesRef.current = candlestickSeries as ISeriesApi<"Candlestick">;
        areaSeriesRef.current = areaSeries as ISeriesApi<"Area">;
        volumeSeriesRef.current = volumeSeries as ISeriesApi<"Histogram">;
        lineSeriesRef.current = lineSeries as ISeriesApi<"Line">;

        chartRef.current = chart;

        // Handle Resize
        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener("resize", handleResize);

        // Crosshair move handler for tooltip
        chart.subscribeCrosshairMove((param: MouseEventParams) => {
            if (!param.time || !param.seriesData || param.seriesData.size === 0) {
                setHoveredPrice(null);
                return;
            }

            const candleData = param.seriesData.get(candlestickSeries) as CandlestickData | undefined;
            const areaData = param.seriesData.get(areaSeries) as { value: number } | undefined;
            const volumeData = param.seriesData.get(volumeSeries) as { value: number } | undefined;

            if (chartStyle === 'candle' && candleData) {
                setHoveredPrice({
                    time: typeof param.time === 'string' ? param.time : new Date((param.time as number) * 1000).toLocaleDateString('ko-KR'),
                    open: candleData.open,
                    high: candleData.high,
                    low: candleData.low,
                    close: candleData.close,
                    volume: volumeData?.value,
                });
            } else if (chartStyle === 'line' && areaData) {
                 setHoveredPrice({
                    time: typeof param.time === 'string' ? param.time : new Date((param.time as number) * 1000).toLocaleDateString('ko-KR'),
                    open: areaData.value,
                    high: areaData.value,
                    low: areaData.value,
                    close: areaData.value,
                    volume: volumeData?.value,
                });
            }
        });

        // Click Interaction - Fixed mouse pointer alignment
        chart.subscribeClick((param: MouseEventParams) => {
            if (!param.time || !param.point) return;

            // Use coordinateToPrice with the actual mouse Y coordinate
            const activeSeries = chartStyle === 'line' ? areaSeries : candlestickSeries;
            const price = activeSeries.coordinateToPrice(param.point.y);

            if (price !== null && price !== undefined) {
                const newPoint = { time: param.time, value: price };

                setPoints(prev => {
                    const nextPoints = [...prev, newPoint];
                    nextPoints.sort((a, b) => {
                        if (typeof a.time === 'string' && typeof b.time === 'string') {
                            return a.time.localeCompare(b.time);
                        }
                        return (a.time as number) - (b.time as number);
                    });
                    return nextPoints;
                });
            }
        });

        return () => {
            window.removeEventListener("resize", handleResize);
            chart.remove();
            candlestickSeriesRef.current = null;
            areaSeriesRef.current = null;
            volumeSeriesRef.current = null;
            lineSeriesRef.current = null;

            chartRef.current = null;
        };
    }, [isDark, chartStyle]);



    // 2. Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            if (!candlestickSeriesRef.current || !areaSeriesRef.current || !volumeSeriesRef.current) return;
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

                const data = await fetchYahooCandles(symbol, yahooInterval) as CandleDataWithVolume[];

                if (!data || data.length === 0) {
                    setError(`${interval === "1" ? "1분봉" : interval === "60" ? "60분봉" : ""} 데이터를 불러올 수 없습니다. 다른 시간대를 선택해주세요.`);
                    setLoading(false);
                    return;
                }

                const candleData = data.map(d => ({
                    time: d.time,
                    open: d.open,
                    high: d.high,
                    low: d.low,
                    close: d.close,
                }));

                const areaData = data.map(d => ({
                    time: d.time,
                    value: d.close,
                }));

                const volumeData: HistogramData[] = data
                    .filter(d => d.volume !== undefined)
                    .map(d => ({
                        time: d.time,
                        value: d.volume!,
                        color: d.close >= d.open ? '#ef444480' : '#3b82f680',
                    }));

                candlestickSeriesRef.current.setData(candleData);
                areaSeriesRef.current.setData(areaData);
                volumeSeriesRef.current.setData(volumeData);



                // Set current price and change
                if (data.length > 0) {
                    const latest = data[data.length - 1];
                    const previous = data[data.length - 2];
                    setCurrentPrice(latest.close);
                    if (previous) {
                        const change = latest.close - previous.close;
                        const changePercent = (change / previous.close) * 100;
                        setPriceChange({ value: change, percent: changePercent });
                    }
                }

                setPoints([]);

                if (chartRef.current) {
                    const isIntraday = ["60", "1"].includes(interval);

                    chartRef.current.applyOptions({
                        timeScale: {
                            timeVisible: isIntraday,
                            secondsVisible: false,
                            borderColor: "#D1D5DB",
                            tickMarkFormatter: (time: number | string, tickMarkType: TickMarkType) => {
                                let date: Date;
                                if (typeof time === 'string') {
                                    date = new Date(time);
                                } else {
                                    date = new Date(time * 1000);
                                }

                                switch (tickMarkType) {
                                    case TickMarkType.Year:
                                        return date.getFullYear().toString();
                                    case TickMarkType.Month:
                                        return (date.getMonth() + 1).toString();
                                    case TickMarkType.DayOfMonth:
                                        return date.getDate().toString();
                                    case TickMarkType.Time:
                                    case TickMarkType.TimeWithSeconds:
                                        return date.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' });
                                    default:
                                        return "";
                                }
                            }
                        }
                    });

                    chartRef.current.timeScale().fitContent();
                }

                setTimeout(() => {
                    captureChart();
                }, 500);

            } catch (error) {
                console.error("Failed to fetch data", error);
                setError("차트 데이터를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [symbol, interval, captureChart, chartStyle]);

    // 3. Update Prediction Line
    useEffect(() => {
        if (onPointsChange) {
            onPointsChange(points);
        }

        if (lineSeriesRef.current && points.length > 0) {
            lineSeriesRef.current.setData(points);

            const markers = points.map((p, idx) => ({
                time: p.time,
                position: 'inBar' as const,
                color: '#2962FF',
                shape: 'circle' as const,
                size: 2,
                text: idx === points.length - 1 ? `${p.value.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}` : undefined,
            }));

            if ('setMarkers' in lineSeriesRef.current && typeof (lineSeriesRef.current as { setMarkers?: (markers: unknown[]) => void }).setMarkers === 'function') {
                (lineSeriesRef.current as { setMarkers: (markers: unknown[]) => void }).setMarkers(markers);
            }

        } else if (lineSeriesRef.current) {
            lineSeriesRef.current.setData([]);
            if ('setMarkers' in lineSeriesRef.current && typeof (lineSeriesRef.current as { setMarkers?: (markers: unknown[]) => void }).setMarkers === 'function') {
                (lineSeriesRef.current as { setMarkers: (markers: unknown[]) => void }).setMarkers([]);
            }
        }
    }, [points, onPointsChange]);

    const handleClearPoints = () => {
        setPoints([]);
    };

    return (
        <div className={`relative w-full h-full ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
            {loading && (
                <div className={`absolute inset-0 flex items-center justify-center ${isDark ? 'bg-black/50' : 'bg-white/50'} z-10`}>
                    <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'} animate-pulse`}>차트 로딩 중...</span>
                </div>
            )}

            {error && !loading && (
                <div className={`absolute inset-0 flex flex-col items-center justify-center ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'} z-10`}>
                    <div className="text-center space-y-4 p-8">
                        <div className="text-red-500 text-lg font-semibold">⚠️ {error}</div>
                        <div className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>
                            {interval === "1" && "1분봉 데이터는 최근 7일만 제공됩니다."}
                            {interval === "60" && "60분봉 데이터는 최근 60일만 제공됩니다."}
                        </div>
                        <div className={`${isDark ? 'text-gray-500' : 'text-gray-500'} text-xs`}>
                            일봉, 주봉, 월봉 데이터를 권장합니다.
                        </div>
                    </div>
                </div>
            )}

            {/* Price Info Overlay */}
            {currentPrice && priceChange && (
                <div className={`absolute top-4 left-4 z-20 ${isDark ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg ${isDark ? 'border border-gray-700' : 'border border-gray-200'}`}>
                    <div className="flex items-baseline gap-3">
                        <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {currentPrice.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
                        </span>
                        <span className={`text-sm font-semibold ${priceChange.value >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                            {priceChange.value >= 0 ? '+' : ''}{priceChange.value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
                            {' '}({priceChange.percent >= 0 ? '+' : ''}{priceChange.percent.toFixed(2)}%)
                        </span>
                    </div>

                </div>
            )}

            {/* Hover Tooltip */}
            {hoveredPrice && (
                <div className={`absolute top-20 left-4 z-20 ${isDark ? 'bg-gray-900/95 text-white' : 'bg-white/95 text-gray-900'} backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg text-sm ${isDark ? 'border border-gray-700' : 'border border-gray-200'}`}>
                    <div className={`font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{hoveredPrice.time}</div>
                    <div className="space-y-1">
                        <div className="flex justify-between gap-6">
                            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>시가:</span>
                            <span className="font-medium">{hoveredPrice.open.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between gap-6">
                            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>고가:</span>
                            <span className="font-medium text-red-400">{hoveredPrice.high.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between gap-6">
                            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>저가:</span>
                            <span className="font-medium text-blue-400">{hoveredPrice.low.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between gap-6">
                            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>종가:</span>
                            <span className="font-medium">{hoveredPrice.close.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</span>
                        </div>
                        {hoveredPrice.volume && (
                            <div className={`flex justify-between gap-6 pt-1 ${isDark ? 'border-t border-gray-700' : 'border-t border-gray-200'}`}>
                                <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>거래량:</span>
                                <span className="font-medium">{hoveredPrice.volume.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div ref={chartContainerRef} className="w-full h-full" />

            {points.length > 0 && (
                <div className="absolute top-4 right-4 z-20">
                    <Button
                        onClick={handleClearPoints}
                        variant="outline"
                        size="sm"
                        className={`shadow-md ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-white border-gray-600' : 'bg-white hover:bg-gray-50 text-gray-900 border-gray-300'}`}
                    >
                        예측 초기화 ({points.length})
                    </Button>
                </div>
            )}
        </div>
    );
}
