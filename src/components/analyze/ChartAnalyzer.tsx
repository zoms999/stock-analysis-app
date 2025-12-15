"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { 
  createChart, 
  ColorType, 
  IChartApi, 
  CandlestickSeries, 
  ISeriesApi,
  Time,
  LineSeries,
  TickMarkType
} from "lightweight-charts";
import { fetchYahooCandles } from "@/lib/api/yahoo"; // Reusing the yahoo api
import { Button } from "@/components/ui/button";

interface ChartAnalyzerProps {
  symbol: string;
  interval: string;
  onPointsChange?: (points: PredictionPoint[]) => void;
  onChartCapture?: (imageDataUrl: string) => void;
}

interface PredictionPoint {
  time: Time;
  value: number;
}

export function ChartAnalyzer({ symbol, interval, onPointsChange, onChartCapture }: ChartAnalyzerProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  
  const [points, setPoints] = useState<PredictionPoint[]>([]);
  const [loading, setLoading] = useState(false);

  // Capture chart as image
  const captureChart = useCallback(async () => {
    if (!chartContainerRef.current) return null;
    
    try {
      // Use html2canvas to capture the chart
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(chartContainerRef.current, {
        backgroundColor: '#1a1a1a',
        scale: 2, // Higher quality
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
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9CA3AF",
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      grid: {
        vertLines: { color: "rgba(105, 105, 105, 0.2)" },
        horzLines: { color: "rgba(105, 105, 105, 0.2)" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 20, // Space for future drawing
      },
      crosshair: {
        mode: 1, // Magnet mode
      }
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#ef4444", 
        downColor: "#3b82f6", 
        borderVisible: false,
        wickUpColor: "#ef4444",
        wickDownColor: "#3b82f6",
    });

    // Line series for connecting prediction points
    const lineSeries = chart.addSeries(LineSeries, {
        color: '#2962FF',
        lineWidth: 2,
        lineStyle: 1, // Dotted? 0=Solid, 1=Dotted, 2=Dashed, 3=LargeDashed
    });

    candlestickSeriesRef.current = candlestickSeries;
    lineSeriesRef.current = lineSeries;
    chartRef.current = chart;

    // Handle Resize
    const handleResize = () => {
        if (chartContainerRef.current) {
            chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
    };
    window.addEventListener("resize", handleResize);

    // Click Interaction
    chart.subscribeClick((param) => {
        if (!param.point || !param.time) return;
        
        // We only want to allow drawing in the future or extending from last point?
        // For simplicity, allow clicking anywhere to add a point to the prediction line.
        // Getting value from coordinate
        const price = candlestickSeries.coordinateToPrice(param.point.y);
        
        if (price !== null) {
             const newPoint = { time: param.time, value: price };
             
             setPoints(prev => {
                const nextPoints = [...prev, newPoint];
                // Sort by time
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
        lineSeriesRef.current = null;
        chartRef.current = null;
    };
  }, []);

  // 2. Fetch Data
  useEffect(() => {
    const fetchData = async () => {
        if (!candlestickSeriesRef.current) return;
        setLoading(true);
        try {
            // Map generic interval to Yahoo API interval
            // "D" -> "1d", "W" -> "1wk", "M" -> "1mo"
            let yahooInterval = "1d";
            if (interval === "W") yahooInterval = "1wk";
            if (interval === "M") yahooInterval = "1mo";
            if (interval === "60") yahooInterval = "60m"; // 1 hour
            if (interval === "1") yahooInterval = "1m"; // 1 minute
            
             // Basic support for now
            
            const data = await fetchYahooCandles(symbol, yahooInterval);
            candlestickSeriesRef.current.setData(data as any);
            
            // Clear existing prediction points on symbol change?
            setPoints([]); 
            
            if (chartRef.current) {
                // Adjust time axis based on interval
                // Hide time for D, W, M
                const isIntraday = !["D", "W", "M"].includes(interval);
                
                chartRef.current.applyOptions({
                    timeScale: {
                        timeVisible: isIntraday,
                        secondsVisible: false,
                        tickMarkFormatter: (time: any, tickMarkType: TickMarkType, locale: string) => {
                            // Convert to Date
                            // time can be string 'YYYY-MM-DD' or number (unix timestamp)
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
                                    return date.toLocaleDateString('en-US', { month: 'short' });
                                case TickMarkType.DayOfMonth:
                                    return date.getDate().toString();
                                case TickMarkType.Time:
                                case TickMarkType.TimeWithSeconds:
                                    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                                default:
                                    return "";
                            }
                        }
                    }
                });

                chartRef.current.timeScale().fitContent();
            }

            // Automatically capture chart after data loads
            setTimeout(() => {
                captureChart();
            }, 500); // Small delay to ensure chart is fully rendered

        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };
    
    fetchData();
  }, [symbol, interval]);

  // 3. Update Prediction Line
  useEffect(() => {
    if (onPointsChange) {
        onPointsChange(points);
    }

    if (lineSeriesRef.current && points.length > 0) {
        lineSeriesRef.current.setData(points);
        
        // Add markers for points
        const markers = points.map(p => ({
            time: p.time,
            position: 'inBar' as const,
            color: '#2962FF',
            shape: 'circle' as const,
            size: 1, // small dot
            text: p == points[points.length-1] ? `$${p.value.toFixed(2)}` : undefined,
        }));
        
        // Safety check and debug
        if ('setMarkers' in lineSeriesRef.current && typeof (lineSeriesRef.current as any).setMarkers === 'function') {
             (lineSeriesRef.current as any).setMarkers(markers);
        } else {
            console.warn("setMarkers not found on LineSeries", lineSeriesRef.current);
        }

    } else if (lineSeriesRef.current) {
        lineSeriesRef.current.setData([]);
        // Clear markers if possible
        if ('setMarkers' in lineSeriesRef.current && typeof (lineSeriesRef.current as any).setMarkers === 'function') {
            (lineSeriesRef.current as any).setMarkers([]);
       }
    }
  }, [points]);

  const handleSavePoints = () => {
      console.log("Saving prediction points:", points);
      // Pass this up to parent or save to state that parent can access?
      // For now, assume parent accesses state or we use context/store.
      // Or just a visual confirmation for this task.
      alert(`Saved ${points.length} prediction points!`);
  };

  return (
    <div className="relative w-full h-full">
        {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                <span className="animate-pulse">Loading...</span>
            </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
        
        {/* Floating Save Button Inside Chart Area */}
        {points.length > 0 && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
                <Button onClick={handleSavePoints} className="shadow-lg bg-[#4A90E2] hover:bg-[#357ABD] text-white">
                    Save Point
                </Button>
            </div>
        )}
    </div>
  );
}
