
"use client";

import React, { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, CandlestickSeries } from "lightweight-charts";
import { fetchTwelveDataCandles, subscribeTwelveDataPrices, CandleData } from "@/lib/api/twelvedata";

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
    let sub: { close: () => void } | null = null;

    const loadData = async () => {
      try {
        console.log(`[TechChart] Fetching Twelve Data candles for ${symbol} (${interval})...`);

        const candles = await fetchTwelveDataCandles(symbol, interval);

        console.log(`[TechChart] Twelve Data candles fetched:`, candles?.length);

        // Only update state if component is still mounted
        if (!isMounted) return;

        if (candles && candles.length > 0) {
          setData(candles);
        } else {
          setData([]);
        }
      } catch (e) {
        // Silently handle errors for TechChart (it's a widget, not critical)
        console.error(`[TechChart] Twelve Data Fetch Error:`, e);
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

    // ✅ Live price streaming via Twelve Data WebSocket (server-proxied SSE)
    sub = subscribeTwelveDataPrices(
      [symbol],
      (msg) => {
        if (!isMounted) return;
        const p = Number(msg.price);
        if (!Number.isFinite(p)) return;

        // 마지막 캔들의 close/high/low만 실시간으로 보정 (초기 OHLC는 time_series가 제공)
        setData((prev) => {
          if (!prev || prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          const nextLast: CandleData = {
            ...last,
            close: p,
            high: Math.max(last.high, p),
            low: Math.min(last.low, p),
          };
          const next = prev.slice(0, -1);
          next.push(nextLast);
          return next;
        });
      },
      () => {
        // 스트림 오류는 위젯에서 조용히 무시
      }
    );

    return () => {
      isMounted = false;
      sub?.close();
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
          horzLines: { color: "rgba(105, 105, 105, 0.2)", visible: false },
        },
        timeScale: {
          // ✅ 일/주/월(비-인트라데이)에서는 날짜 단위로 보이도록
          timeVisible: ["1m", "2m", "5m", "15m", "30m", "60m", "1h", "90m"].includes(interval),
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
          <span className="text-purple-400">Twelve Data</span>
          {symbol}
        </h3>
        {loading && <span className="text-xs text-muted-foreground animate-pulse">데이터 연결 중...</span>}
      </div>
      <div ref={chartContainerRef} className="h-[400px] w-full" />
    </div>
  );
}
