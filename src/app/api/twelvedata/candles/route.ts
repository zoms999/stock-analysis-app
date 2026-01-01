import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TwelveDataTimeSeriesResponse =
  | {
      status: "ok";
      values: Array<{
        datetime: string;
        open: string;
        high: string;
        low: string;
        close: string;
        volume?: string;
      }>;
    }
  | {
      status: "error";
      code?: number | string;
      message?: string;
      param?: string;
    };

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

const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Candle[]>>();

function normalizeSymbolForTwelveData(symbol: string) {
  const s = symbol.trim();

  // ✅ KRX 포맷 정규화
  // - Twelve Data 예시: 005930:KRX
  // - 사용자가 KRX:005930 형태로 넣어도 005930:KRX로 맞춰줌
  const mKr = s.match(/^(KRX|XKRX)\s*:\s*(\d{6})$/i);
  if (mKr) {
    return `${mKr[2]}:KRX`;
  }

  // Yahoo 스타일의 "BTC-USD" 같은 심볼을 Twelve Data에서 자주 쓰는 "BTC/USD"로만 제한 변환
  const m = s.match(/^([A-Za-z0-9]{2,10})-([A-Za-z]{3,5})$/);
  if (m) {
    const base = m[1];
    const quote = m[2].toUpperCase();
    const isFiatLike = ["USD", "USDT", "KRW", "EUR", "JPY", "GBP"].includes(quote);
    if (isFiatLike) return `${base}/${quote}`;
  }

  return s;
}

function isIsoWithTimezone(s: string) {
  return /Z$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/.test(s);
}

function toUnixSecondsFromDatetime(datetime: string) {
  const isoBase = datetime.includes("T") ? datetime : datetime.replace(" ", "T");
  const iso = isIsoWithTimezone(isoBase) ? isoBase : `${isoBase}Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function parseNum(v: string | undefined) {
  if (v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapIntervalToTwelve(intervalArg: string) {
  const allowed: Record<string, { interval: string; mode: "date" | "datetime"; outputsize: number }> = {
    // ✅ Free-tier 크레딧/레이트리밋을 고려해 outputsize를 작게 유지합니다.
    // 화면에서는 주로 최근 구간만 보여주므로 120~260 수준으로 충분합니다.
    "1d": { interval: "1day", mode: "date", outputsize: 120 },
    "1wk": { interval: "1week", mode: "date", outputsize: 260 },
    "1mo": { interval: "1month", mode: "date", outputsize: 120 },
    "1m": { interval: "1min", mode: "datetime", outputsize: 200 },
    "5m": { interval: "5min", mode: "datetime", outputsize: 200 },
    "15m": { interval: "15min", mode: "datetime", outputsize: 200 },
    "30m": { interval: "30min", mode: "datetime", outputsize: 200 },
    "1h": { interval: "1h", mode: "datetime", outputsize: 240 },
  };

  return allowed[intervalArg] ?? allowed["1d"];
}

/**
 * Twelve Data REST (time_series) Proxy
 * GET /api/twelvedata/candles?symbol=AAPL&interval=1d
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  try {
    const rawSymbol = searchParams.get("symbol") ?? "AAPL";
    const intervalArg = searchParams.get("interval") ?? "1d";
    const symbol = normalizeSymbolForTwelveData(rawSymbol);
    const { interval, mode, outputsize } = mapIntervalToTwelve(intervalArg);

    const apiKey = process.env.TWELVEDATA_API_KEY ?? process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Twelve Data API key is not configured", hint: "`.env.local`에 TWELVEDATA_API_KEY=... 를 추가하세요." },
        { status: 500 }
      );
    }

    const cacheKey = `${symbol}|${intervalArg}`;
    const nowMs = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > nowMs) {
      return NextResponse.json(cached.data, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        },
      });
    }

    const pending = inFlight.get(cacheKey);
    if (pending) {
      const data = await pending;
      return NextResponse.json(data, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        },
      });
    }

    const url = new URL("https://api.twelvedata.com/time_series");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("outputsize", String(outputsize));
    url.searchParams.set("timezone", "UTC");
    url.searchParams.set("format", "JSON");
    url.searchParams.set("apikey", apiKey);

    const promise = (async () => {
      const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" });
      const bodyText = await res.text().catch(() => "");
      let json: TwelveDataTimeSeriesResponse | null = null;
      try {
        json = bodyText ? (JSON.parse(bodyText) as TwelveDataTimeSeriesResponse) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        return { ok: false as const, status: res.status, details: bodyText.slice(0, 800) };
      }

      if (!json || (json as any)?.status !== "ok" || !Array.isArray((json as any)?.values)) {
        return { ok: false as const, status: 502, details: (json as any)?.message ?? json ?? "Unexpected response" };
      }

      const values = (json as any).values as Array<any>;
      const candles: Candle[] = [];
      for (const v of values) {
        const open = parseNum(v.open);
        const high = parseNum(v.high);
        const low = parseNum(v.low);
        const close = parseNum(v.close);
        const volume = parseNum(v.volume);
        if (open === null || high === null || low === null || close === null) continue;

        const time =
          mode === "date" ? String(v.datetime).slice(0, 10) : toUnixSecondsFromDatetime(String(v.datetime));
        if (time === null) continue;

        candles.push({ time, open, high, low, close, ...(volume !== null ? { volume } : {}) });
      }

      const unique = candles.filter((c, i, a) => a.findIndex((t) => t.time === c.time) === i);
      unique.sort((a, b) => {
        if (typeof a.time === "string" && typeof b.time === "string") return a.time.localeCompare(b.time);
        return (a.time as number) - (b.time as number);
      });

      return { ok: true as const, data: unique };
    })();

    inFlight.set(cacheKey, promise.then((r) => (r.ok ? r.data : [])));
    const result = await promise.finally(() => inFlight.delete(cacheKey));

    if (!result.ok) {
      return NextResponse.json({ error: "차트 데이터를 불러올 수 없습니다.", details: result.details }, { status: result.status });
    }

    cache.set(cacheKey, { expiresAt: Date.now() + TTL_MS, data: result.data });

    return NextResponse.json(result.data, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "차트 데이터를 불러올 수 없습니다.", details: errorMessage }, { status: 500 });
  }
}


