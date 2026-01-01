import { NextResponse } from "next/server";

// ✅ env(process.env) 접근을 위해 Node.js 런타임을 강제합니다.
// (일부 설정/환경에서 route handler가 Edge로 실행되면 env가 비어 보일 수 있음)
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
      meta?: unknown;
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

// ✅ 간단한 메모리 캐시 + 동시요청 합치기(요청 폭주 완화)
const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Candle[]>>();

function normalizeSymbolForTwelveData(symbol: string) {
  const s = symbol.trim();

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
  // Twelve Data intraday는 보통 "YYYY-MM-DD HH:mm:ss" 형태.
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
  const allowed: Record<
    string,
    { interval: string; mode: "date" | "datetime"; outputsize: number }
  > = {
    "1d": { interval: "1day", mode: "date", outputsize: 365 },
    "1wk": { interval: "1week", mode: "date", outputsize: 520 },
    "1mo": { interval: "1month", mode: "date", outputsize: 240 },
    "1m": { interval: "1min", mode: "datetime", outputsize: 390 },
    "5m": { interval: "5min", mode: "datetime", outputsize: 500 },
    "15m": { interval: "15min", mode: "datetime", outputsize: 500 },
    "30m": { interval: "30min", mode: "datetime", outputsize: 500 },
    "1h": { interval: "1h", mode: "datetime", outputsize: 720 },
  };

  return allowed[intervalArg] ?? allowed["1d"];
}

/**
 * Twelve Data API Proxy (API 키 보호 + 캐시)
 * GET /api/twelvedata/candles?symbol=AAPL&interval=1d
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  try {
    const rawSymbol = searchParams.get("symbol") ?? "AAPL";
    const intervalArg = searchParams.get("interval") ?? "1d";
    const symbol = normalizeSymbolForTwelveData(rawSymbol);
    const { interval, mode, outputsize } = mapIntervalToTwelve(intervalArg);

    // ✅ 서버 전용 env를 우선 사용. (실수로 NEXT_PUBLIC_*로 넣은 경우도 로컬에서는 동작하도록 fallback)
    const apiKey = process.env.TWELVEDATA_API_KEY ?? process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Twelve Data API key is not configured",
          hint: "`.env.local`에 TWELVEDATA_API_KEY=... 를 추가하고 dev 서버를 재시작하세요.",
        },
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
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const bodyText = await res.text().catch(() => "");
      let json: TwelveDataTimeSeriesResponse | null = null;
      try {
        json = bodyText ? (JSON.parse(bodyText) as TwelveDataTimeSeriesResponse) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        return {
          ok: false as const,
          status: res.status,
          message: `Twelve Data request failed: ${res.statusText}`,
          details: bodyText.slice(0, 800),
        };
      }

      if (!json || (json as any)?.status !== "ok" || !Array.isArray((json as any)?.values)) {
        const msg =
          (json as any)?.message ||
          (json ? "Unexpected Twelve Data response" : "Empty response from Twelve Data");
        return { ok: false as const, status: 502, message: msg, details: json };
      }

      const values = (json as any).values as TwelveDataTimeSeriesResponse & any;
      const candles: Candle[] = [];

      for (const v of values) {
        const open = parseNum(v.open);
        const high = parseNum(v.high);
        const low = parseNum(v.low);
        const close = parseNum(v.close);
        const volume = parseNum(v.volume);
        if (open === null || high === null || low === null || close === null) continue;

        let time: string | number | null = null;
        if (mode === "date") {
          // YYYY-MM-DD만 사용 (주/월/일 봉)
          time = String(v.datetime).slice(0, 10);
        } else {
          time = toUnixSecondsFromDatetime(String(v.datetime));
        }

        if (time === null) continue;
        candles.push({ time, open, high, low, close, ...(volume !== null ? { volume } : {}) });
      }

      // 정렬 + 중복 제거
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
      const status = result.status ?? 500;
      const userMessage =
        status === 429
          ? "요청이 많아 일시적으로 차트 데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요."
          : "차트 데이터를 불러올 수 없습니다.";

      return NextResponse.json({ error: userMessage, details: result.details ?? result.message }, { status });
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
    console.error("Twelve Data proxy error:", error);
    return NextResponse.json({ error: "차트 데이터를 불러올 수 없습니다.", details: errorMessage }, { status: 500 });
  }
}


