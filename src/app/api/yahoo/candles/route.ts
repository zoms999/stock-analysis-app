import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

/**
 * Yahoo Finance API Proxy
 * GET /api/yahoo/candles?symbol=AAPL&interval=1d
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  try {
    const symbol = searchParams.get("symbol") ?? "AAPL";
    const intervalArg = searchParams.get("interval") ?? "1d";

    // Validate interval (yahoo-finance2 supports: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
    // We'll support a subset that makes sense for the chart
    const allowedIntervals = ["1d", "1wk", "1mo"];
    const interval = allowedIntervals.includes(intervalArg) ? (intervalArg as "1d" | "1wk" | "1mo") : "1d";

    const now = new Date();
    // Fetch enough history. For daily, 1 year is good.
    const from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    const queryOptions = {
      period1: from,
      period2: now,
      interval: interval,
    };

    // Explicitly type the result to avoid inference issues with the library
    const result = await yahooFinance.historical(symbol, queryOptions) as Array<{
        date: Date;
        open: number;
        high: number;
        low: number;
        close: number;
        adjClose?: number;
        volume: number;
    }>;

    // Transform to Lightweight Charts format
    const candles = result.map((quote) => ({
      time: Math.floor(new Date(quote.date).getTime() / 1000), // Unix timestamp in seconds
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.close,
    }));

    // Sort by time just in case
    candles.sort((a, b) => (a.time as number) - (b.time as number));

    return NextResponse.json(candles, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error: any) {
    console.error(`Yahoo Finance API Error (Symbol: ${searchParams.get("symbol")}, Interval: ${searchParams.get("interval")}):`, error);
    return NextResponse.json(
      { error: "Failed to fetch from Yahoo Finance", details: error.message || String(error) },
      { status: 500 }
    );
  }
}
