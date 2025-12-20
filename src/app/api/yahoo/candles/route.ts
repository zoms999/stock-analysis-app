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
    const allowedIntervals = ["1d", "1wk", "1mo", "1m", "5m", "15m", "30m", "1h"];
    const intervalQuery = allowedIntervals.includes(intervalArg) ? intervalArg : "1d";
    // Yahoo expects specific types, cast it
    const interval = intervalQuery as "1d" | "1wk" | "1mo" | "1m" | "5m" | "15m" | "30m" | "1h";

    const now = new Date();
    let from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); // Default 1 year

    // Adjust history range based on interval constraints
    // Yahoo Finance limits:
    // 1m: 7 days
    // 5m, 15m, 30m: 60 days
    // 1h: 730 days
    if (["1m"].includes(interval)) {
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days
    } else if (["5m", "15m", "30m"].includes(interval)) {
      from = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days
    } else if (["1h"].includes(interval)) {
      from = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days for 1h
    }

    const queryOptions = {
      period1: from,
      period2: now,
      interval: interval,
    };

    // Use chart() for intraday data, historical() for daily+
    let result: Array<{
      date: Date;
      open: number;
      high: number;
      low: number;
      close: number;
      adjClose?: number;
      volume: number;
    }>;

    if (["1m", "5m", "15m", "30m", "1h"].includes(interval)) {
      // Use chart() for intraday intervals
      const chartResult = await yahooFinance.chart(symbol, queryOptions);
      if (!chartResult || !chartResult.quotes) {
        console.error("Yahoo Finance Chart result invalid:", chartResult);
        throw new Error("No chart data received from Yahoo Finance");
      }
      result = chartResult.quotes.map(q => ({
        date: new Date(q.date),
        open: q.open ?? 0,
        high: q.high ?? 0,
        low: q.low ?? 0,
        close: q.close ?? 0,
        volume: q.volume ?? 0,
      }));
    } else {
      // Use historical() for daily, weekly, monthly
      result = await yahooFinance.historical(symbol, {
        period1: from,
        period2: now,
        interval: interval as "1d" | "1wk" | "1mo",
      }) as Array<{
        date: Date;
        open: number;
        high: number;
        low: number;
        close: number;
        adjClose?: number;
        volume: number;
      }>;
    }

    if (!Array.isArray(result)) {
      console.error("Yahoo Finance Historical result invalid:", result);
      throw new Error("No historical data received from Yahoo Finance");
    }

    // Transform to Lightweight Charts format
    const candles = result
      .filter(quote => quote && quote.date) // Ensure quote and date exist
      .map((quote) => {
        // For Daily/Weekly/Monthly, use YYYY-MM-DD string to handle non-trading days (weekends) automatically
        // For Intraday, use UNIX timestamp
        let time: string | number;
        if (["1d", "1wk", "1mo"].includes(interval)) {
           // Format to YYYY-MM-DD
           const d = new Date(quote.date);
           const year = d.getFullYear();
           const month = String(d.getMonth() + 1).padStart(2, '0');
           const day = String(d.getDate()).padStart(2, '0');
           time = `${year}-${month}-${day}`;
        } else {
           time = Math.floor(new Date(quote.date).getTime() / 1000);
        }

        return {
          time,
          open: quote.open,
          high: quote.high,
          low: quote.low,
          close: quote.close,
        };
      })
      .filter(candle => {
         if (typeof candle.time === 'number') return !isNaN(candle.time) && candle.time > 0;
         return !!candle.time;
      });

    // Sort by time just in case
    // Sort by time
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Yahoo Finance API Error (Symbol: ${searchParams.get("symbol")}, Interval: ${searchParams.get("interval")}):`, error);

    // Provide more helpful error messages
    let userMessage = "차트 데이터를 불러올 수 없습니다.";
    if (errorMessage.includes("No data found") || errorMessage.includes("delisted")) {
      userMessage = "종목을 찾을 수 없습니다. 올바른 심볼을 입력했는지 확인해주세요. (예: BTC-USD, AAPL, TSLA)";
    } else if (errorMessage.includes("Invalid")) {
      userMessage = "잘못된 요청입니다. 종목 심볼과 시간대를 확인해주세요.";
    }

    return NextResponse.json(
      { error: userMessage, details: errorMessage },
      { status: 500 }
    );
  }
}
