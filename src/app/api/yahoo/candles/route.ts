import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

// historical() 공지(Deprecated) 및 노이즈 로그 억제
const yahooFinance = new YahooFinance({ suppressNotices: ["ripHistorical"] });

type CacheEntry = {
  expiresAt: number;
  data: any;
};

// 간단한 메모리 캐시 + 동시요청 합치기(요청 폭주/429 완화)
const CANDLES_TTL_MS = 60_000;
const candlesCache = new Map<string, CacheEntry>();
const candlesInFlight = new Map<string, Promise<any>>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchCandlesWithRetry(symbol: string, queryOptions: any, maxAttempts = 3) {
  let attempt = 0;
  let lastErr: any = null;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const chartResult: any = await yahooFinance.chart(symbol, queryOptions);
      if (!chartResult || !Array.isArray(chartResult.quotes)) {
        throw new Error("No chart data received from Yahoo Finance");
      }
      return chartResult.quotes.map((q: any) => ({
        date: new Date(q.date),
        open: q.open ?? 0,
        high: q.high ?? 0,
        low: q.low ?? 0,
        close: q.close ?? 0,
        volume: q.volume ?? 0,
      }));
    } catch (e: any) {
      lastErr = e;
      const code = e?.code ?? e?.statusCode;
      // yahoo-finance2에서 429는 HTTPError.code=429 형태로 들어옵니다.
      if (code === 429) {
        // 지수 백오프(0.5s, 1s, 2s)
        await sleep(500 * Math.pow(2, attempt - 1));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

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

    // 캐시 키는 now 변동으로 인한 미스가 잦으니 interval+symbol 기준으로 60초 TTL로 묶습니다.
    const cacheKey = `${symbol}|${interval}`;
    const cached = candlesCache.get(cacheKey);
    const nowMs = Date.now();
    if (cached && cached.expiresAt > nowMs) {
      return NextResponse.json(cached.data, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          // 브라우저(max-age) + CDN(s-maxage) 모두 캐시하도록 설정
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        },
      });
    }

    const inFlight = candlesInFlight.get(cacheKey);
    if (inFlight) {
      const data = await inFlight;
      return NextResponse.json(data, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        },
      });
    }

    // Use chart() for all intervals (historical()는 Yahoo 제거 API에 의존)
    const promise = fetchCandlesWithRetry(symbol, queryOptions, 3);
    candlesInFlight.set(cacheKey, promise);
    const result = await promise.finally(() => candlesInFlight.delete(cacheKey));

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

    // 캐시 저장
    candlesCache.set(cacheKey, { expiresAt: Date.now() + CANDLES_TTL_MS, data: candles });

    return NextResponse.json(candles, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Yahoo Finance API Error (Symbol: ${searchParams.get("symbol")}, Interval: ${searchParams.get("interval")}):`, error);

    // Provide more helpful error messages
    let userMessage = "차트 데이터를 불러올 수 없습니다.";
    let status = 500;
    if (errorMessage.includes("No data found") || errorMessage.includes("delisted")) {
      userMessage = "종목을 찾을 수 없습니다. 올바른 심볼을 입력했는지 확인해주세요. (예: BTC-USD, AAPL, TSLA)";
    } else if (errorMessage.includes("Invalid")) {
      userMessage = "잘못된 요청입니다. 종목 심볼과 시간대를 확인해주세요.";
    } else if (errorMessage.includes("Too Many Requests") || (error as any)?.code === 429) {
      userMessage = "요청이 많아 일시적으로 차트 데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.";
      status = 429;
    }

    return NextResponse.json(
      { error: userMessage, details: errorMessage },
      { status }
    );
  }
}
