
"use client";

import React, { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, CandlestickSeries } from "lightweight-charts";
import { fetchUpbitCandles, CandleData } from "@/lib/api/upbit";
import { fetchFinnhubCandles } from "@/lib/api/finnhub";

interface TechChartProps {
  source?: "upbit" | "finnhub";
  symbol?: string;
}

export function TechChart({ source = "upbit", symbol = "KRW-BTC" }: TechChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [data, setData] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(true);

  // Data Fetching
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
        try {
            console.log(`[TechChart] Fetching ${source} data for ${symbol}...`);
            
            let candles: CandleData[] = [];
            
            if (source === "upbit") {
                candles = await fetchUpbitCandles(symbol);
            } else if (source === "finnhub") {
                candles = await fetchFinnhubCandles(symbol, "D"); 
            }

            console.log(`[TechChart] ${source} data fetched:`, candles?.length);
            
            // Only update state if component is still mounted
            if (!isMounted) return;
            
            if (candles && candles.length > 0) {
                 setData(candles);
            } else {
                 // Clear data if fetch returns nothing (handle switch gracefully)
                 setData([]);
            }
        } catch (e) {
            console.error(`[TechChart] ${source} Fetch Error:`, e);
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
    
    // Polling interval depending on source
    const intervalTime = source === "upbit" ? 5000 : 60000;
    const interval = setInterval(() => {
        if (isMounted) {
            loadData();
        }
    }, intervalTime);
    
    return () => {
        isMounted = false;
        clearInterval(interval);
    };
  }, [source, symbol]);

  // Chart Rendering
  useEffect(() => {
    if (!chartContainerRef.current) return;
    // Render even if data is empty (to show empty grid)
    
    try {
        if (chartRef.current) {
            chartRef.current.remove();
        }

        const handleResize = () => {
          if (chartContainerRef.current && chartRef.current) {
             chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
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
          chart.remove();
        };
    } catch (err) {
        console.error("Chart Rendering Error:", err);
    }
  }, [data]);

  return (
    <div className="relative w-full rounded-xl border border-border bg-card p-4 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
           {source === 'upbit' ? <span className="text-primary">Upbit</span> : <span className="text-blue-400">Finnhub</span>} 
           {symbol}
        </h3>
        {loading && <span className="text-xs text-muted-foreground animate-pulse">데이터 연결 중...</span>}
      </div>
      <div ref={chartContainerRef} className="h-[400px] w-full" />
    </div>
  );
}
