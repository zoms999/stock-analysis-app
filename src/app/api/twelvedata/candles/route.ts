import { NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Candle = {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type CacheEntry = {
  expiresAt: number;
  data: Candle[];
};

// 5분 캐시
const TTL_MS = 300_000;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Candle[]>>();

function normalizeSymbolForYahoo(symbol: string) {
  let s = symbol.trim();

  // 1. KRX 처리: 005930:KRX -> 005930.KS (KOSPI) 또는 .KQ (KOSDAQ)
  // Yahoo는 KOSPI=.KS, KOSDAQ=.KQ 사용. 
  // 여기서는 간단히 .KS로 시도하거나, 혹은 사용자가 명시해주길 기대.
  // 대부분의 주요 종목(삼성전자 등)은 .KS
  const mKr = s.match(/^(KRX|XKRX)\s*:\s*(\d{6})$/i);
  if (mKr) {
    // 일단 .KS (KOSPI)로 변환해보고, 필요하다면 실패 시 .KQ로 재시도하는 로직이 필요할 수 있음.
    // 하지만 우선 삼성전자(005930) 등 대형주는 .KS임.
    return `${mKr[2]}.KS`;
  }
  
  // 005930 같은 숫자만 있는 경우 -> .KS 붙임 (가정)
  if (/^\d{6}$/.test(s)) {
    return `${s}.KS`;
  }

  // 2. Crypto: BTC/USD -> BTC-USD
  if (s.includes("/")) {
    return s.replace("/", "-");
  }
  
  // 3. Crypto: BTC (without quote) -> BTC-USD (default)
  const isCrypto = ["BTC", "ETH", "XRP", "DOGE", "SOL"].includes(s.toUpperCase());
  if (isCrypto) {
    return `${s.toUpperCase()}-USD`;
  }

  return s;
}

function mapIntervalToYahoo(intervalArg: string): "1d" | "1wk" | "1mo" | "1m" | "5m" | "15m" | "1h" {
  // Yahoo supported: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
  const map: Record<string, string> = {
    "1d": "1d",
    "1wk": "1wk",
    "1mo": "1mo",
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m", // yahoo doesn't list 30m explicitly in some docs but usually works or fallback
    "60": "1h",
    "60m": "1h",
    "1h": "1h",
  };
  return (map[intervalArg] || "1d") as any;
}


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawSymbol = searchParams.get("symbol") ?? "AAPL";
  const intervalArg = searchParams.get("interval") ?? "1d";
  
  const symbol = normalizeSymbolForYahoo(rawSymbol);
  const interval = mapIntervalToYahoo(intervalArg);
  const cacheKey = `${symbol}|${interval}`;

  // 1. 캐시 체크
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }

  // 2. In-flight 중복 요청 방지
  const pending = inFlight.get(cacheKey);
  if (pending) {
    try {
      const data = await pending;
      return NextResponse.json(data);
    } catch (e) {
       // pending 실패 시 아래 로직 진행
    }
  }

  const fetchPromise = (async () => {
    // Yahoo Finance Historical Options
    // period1 is required. "2000-01-01" is safe.
    // For intraday (1m, 5m), fetch recent data only (e.g., last 7 days) to avoid errors.
    
    let period1 = "2020-01-01";
    // Intraday limitations: 1m (7 days), etc.
    if (interval === "1m" || interval === "5m" || interval === "15m" || interval === "1h") {
        const d = new Date();
        d.setDate(d.getDate() - 7); // Max 7 days buffer for reliable intraday
        period1 = d.toISOString().split("T")[0];
    }

    const queryOptions = { 
        period1, 
        interval 
        // period2 defaults to now
    };

    try {
        const result = await yahooFinance.historical(symbol, queryOptions as any);
        
        // Transform to Candle format
        const candles: Candle[] = result.map((item) => {
             // date is Date object in yahoo-finance2
             const timeStr = item.date.toISOString();
             // For daily/weekly/monthly, use YYYY-MM-DD string
             // For intraday, use UNIX timestamp (seconds)
             let time: string | number;
             if (interval === "1d" || interval === "1wk" || interval === "1mo") {
                 time = timeStr.split("T")[0];
             } else {
                 time = Math.floor(item.date.getTime() / 1000);
             }

             return {
                 time,
                 open: item.open,
                 high: item.high,
                 low: item.low,
                 close: item.close,
                 volume: item.volume
             };
        });

        // Sort just in case
        candles.sort((a, b) => {
            if (typeof a.time === 'string' && typeof b.time === 'string') return a.time.localeCompare(b.time);
            return (a.time as number) - (b.time as number);
        });

        return candles;
    } catch (error) {
        throw error;
    }
  })();

  inFlight.set(cacheKey, fetchPromise);

  try {
      const data = await fetchPromise;
      // Cache success
      cache.set(cacheKey, { expiresAt: Date.now() + TTL_MS, data });
      return NextResponse.json(data, {
          headers: { "Access-Control-Allow-Origin": "*" }
      });
  } catch (error: any) {
      console.error(`Yahoo Finance Error [${symbol}]:`, error);
      return NextResponse.json(
          { error: "Failed to fetch data", details: error.message }, 
          { status: 500 }
      );
  } finally {
      inFlight.delete(cacheKey);
  }
}
