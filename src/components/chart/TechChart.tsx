
"use client";

import React, { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, CandlestickSeries } from "lightweight-charts";
import { fetchYahooCandles, CandleData } from "@/lib/api/yahoo";

interface TechChartProps {
  symbol?: string;
  interval?: string;
}

export function TechChart({ symbol = "BTC-USD", interval = "1d" }: TechChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [data, setData] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(true);

  // Data Fetching
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
        try {
            console.log(`[TechChart] Fetching Yahoo Finance data for ${symbol} (${interval})...`);
            
            const candles = await fetchYahooCandles(symbol, interval);

            console.log(`[TechChart] Yahoo Finance data fetched:`, candles?.length);
            
            // Only update state if component is still mounted
            if (!isMounted) return;
            
            if (candles && candles.length > 0) {
                 setData(candles);
            } else {
                 // Clear data if fetch returns nothing (handle switch gracefully)
                 setData([]);
            }
        } catch (e) {
            console.error(`[TechChart] Yahoo Finance Fetch Error:`, e);
            if (isMounted) {
                setData([]);
            }
        }
        if (isMounted) {
            setLoading(false);
        }
    };

    // Immediate reset on prop change to indicate content switch
    setData([]); 
    setLoading(true);
    loadData();
    
    // Polling interval for Yahoo Finance (60 seconds)
    const pollingInterval = setInterval(() => {
        if (isMounted) {
            loadData();
        }
    }, 60000);
    
    return () => {
        isMounted = false;
        clearInterval(pollingInterval);
    };
  }, [symbol, interval]);

  // Chart Rendering
  useEffect(() => {
    if (!chartContainerRef.current) return;
    // Render even if data is empty (to show empty grid)
    
    try {
        // Clean up existing chart before creating new one
        if (chartRef.current) {
            try {
                chartRef.current.remove();
            } catch (e) {
                // Chart already disposed, ignore
            }
            chartRef.current = null;
        }

        const handleResize = () => {
          if (chartContainerRef.current && chartRef.current) {
             try {
                 chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
             } catch (e) {
                 // Chart disposed during resize, ignore
             }
          }
        };

        const chart = createChart(chartContainerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "#9CA3AF",
          },
          width: chartContainerRef.current.clientWidth,
          height: 400,
          grid: {
            vertLines: { color: "rgba(105, 105, 105, 0.2)" },
            horzLines: { color: "rgba(105, 105, 105, 0.2)" },
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
          },
        });

        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: "#ef4444", 
            downColor: "#3b82f6", 
            borderVisible: false,
            wickUpColor: "#ef4444",
            wickDownColor: "#3b82f6",
        });

        if (data.length > 0) {
            candlestickSeries.setData(data as any); 
            chart.timeScale().fitContent();
        }

        chartRef.current = chart;

        window.addEventListener("resize", handleResize);

        return () => {
          window.removeEventListener("resize", handleResize);
          if (chartRef.current) {
              try {
                  chartRef.current.remove();
              } catch (e) {
                  // Chart already disposed, ignore
              }
              chartRef.current = null;
          }
        };
    } catch (err) {
        console.error("Chart Rendering Error:", err);
    }
  }, [data]);

  return (
    <div className="relative w-full rounded-xl border border-border bg-card p-4 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
           <span className="text-purple-400">Yahoo Finance</span>
           {symbol}
        </h3>
        {loading && <span className="text-xs text-muted-foreground animate-pulse">데이터 연결 중...</span>}
      </div>
      <div ref={chartContainerRef} className="h-[400px] w-full" />
    </div>
  );
}
