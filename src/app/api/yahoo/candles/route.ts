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
    const allowedIntervals = ["1d", "1wk", "1mo", "1m", "5m", "15m", "30m", "60m", "1h"];
    const intervalQuery = allowedIntervals.includes(intervalArg) ? intervalArg : "1d";
    // Yahoo expects specific types, cast it
    const interval = intervalQuery as "1d" | "1wk" | "1mo" | "1m" | "5m" | "15m" | "30m" | "60m" | "1h";

    const now = new Date();
    let from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); // Default 1 year

    // Adjust history range based on interval constraints
    // Yahoo Finance limits:
    // 1m: 7 days
    // 5m, 15m, 30m: 60 days
    // 60m, 1h: 730 days
    if (["1m", "5m", "15m", "30m"].includes(interval)) {
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days
    } else if (["60m", "1h"].includes(interval)) {
        from = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days
    }

    const queryOptions = {
      period1: from,
      period2: now,
      interval: interval as any,
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
    const candles = result.map((quote) => {
      let time: string | number = Math.floor(new Date(quote.date).getTime() / 1000); // Default to unix timestamp

      // For daily/weekly/monthly, use YYYY-MM-DD string
      if (["1d", "1wk", "1mo"].includes(interval)) {
        const d = new Date(quote.date);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        time = `${yyyy}-${mm}-${dd}`;
      }

      return {
        time,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
      };
    });

    // Sort by time just in case
    candles.sort((a, b) => {
        if (typeof a.time === 'string' && typeof b.time === 'string') {
            return a.time.localeCompare(b.time);
        }
        return (a.time as number) - (b.time as number);
    });

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
