import { NextResponse } from "next/server";

/**
 * Finnhub API Proxy to avoid CORS issues and hide API key
 * GET /api/finnhub/candles?symbol=AAPL&resolution=D
 */
type CacheEntry = { expiresAt: number; data: any };
const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<any>>();

function normalizeFinnhubSymbol(input: string) {
  // Yahoo 스타일 crypto 티커를 Finnhub crypto 심볼로 매핑 (메인에서 BTC-USD를 유지하고 싶을 때)
  // 예) BTC-USD -> BINANCE:BTCUSDT
  const m = input.match(/^([A-Z0-9]{2,10})-USD$/i);
  if (m) {
    const base = m[1].toUpperCase();
    return `BINANCE:${base}USDT`;
  }
  return input;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSymbol = searchParams.get("symbol") ?? "AAPL";
    const symbol = normalizeFinnhubSymbol(rawSymbol);
    const resolution = searchParams.get("resolution") ?? "D";

    // 서버에서는 비공개 키(FINNHUB_API_KEY)를 우선 사용 (NEXT_PUBLIC_*는 fallback)
    const apiKey = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "Finnhub API key is not configured" },
        { status: 500 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const from = now - (200 * 24 * 60 * 60); // 200 days ago

    const cacheKey = `${symbol}|${resolution}|${from}|${now}`;
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

    const inflight = inFlight.get(cacheKey);
    if (inflight) {
      const data = await inflight;
      return NextResponse.json(data, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        },
      });
    }

    const isCrypto = symbol.includes(":"); // e.g. BINANCE:BTCUSDT
    const baseUrl = isCrypto ? "https://finnhub.io/api/v1/crypto/candle" : "https://finnhub.io/api/v1/stock/candle";
    const finnhubUrl = `${baseUrl}?symbol=${encodeURIComponent(symbol)}&resolution=${encodeURIComponent(resolution)}&from=${from}&to=${now}&token=${apiKey}`;

    const promise = (async () => {
      const response = await fetch(finnhubUrl, {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        // 403은 키/플랜 권한 문제일 가능성이 매우 높음
        const isForbidden = response.status === 401 || response.status === 403;
        if (isForbidden) {
          console.warn(`Finnhub API Forbidden (${response.status}) for symbol=${symbol} (raw=${rawSymbol})`);
        } else {
          console.error(`Finnhub API Error (${response.status}):`, errorText);
        }

        return {
          __error: true,
          status: response.status,
          body: {
            error: isForbidden
              ? "Finnhub API 키 권한(플랜) 문제로 접근이 거부되었습니다. FINNHUB_API_KEY를 확인하거나 플랜을 업그레이드해주세요."
              : `Finnhub API Error: ${response.statusText}`,
            status: response.status,
            details: errorText,
          },
        };
      }

      const data = await response.json();
      return { __error: false, status: 200, body: data };
    })();

    inFlight.set(cacheKey, promise);
    const result = await promise.finally(() => inFlight.delete(cacheKey));

    if (result.__error) {
      return NextResponse.json(result.body, { status: result.status });
    }

    cache.set(cacheKey, { expiresAt: Date.now() + TTL_MS, data: result.body });

    return NextResponse.json(result.body, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Finnhub proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch from Finnhub" },
      { status: 500 }
    );
  }
}
