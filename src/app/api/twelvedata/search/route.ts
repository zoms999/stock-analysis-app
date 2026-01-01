import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 최소한의 한글 키워드 보정(사용자 UX용). 필요하면 더 확장 가능.
const KO_SYMBOL_FALLBACK: Record<string, string> = {
  // Twelve Data KRX 예시 포맷: 005930:KRX
  // 참고: KRX 데이터는 플랜에 따라 제한될 수 있습니다.
  "삼성전자": "005930:KRX",
  "삼전": "005930:KRX",
};

function normalizeQuery(q: string) {
  return q.trim();
}

function pickBestSymbol(items: any[]): string | null {
  if (!Array.isArray(items) || items.length === 0) return null;

  // 우선순위: 한국(KSE/KOSDAQ) -> 미국(NYSE/NASDAQ) -> 나머지
  const score = (it: any) => {
    const exchange = String(it?.exchange ?? "").toUpperCase();
    const country = String(it?.country ?? "").toUpperCase();
    const symbol = String(it?.symbol ?? "");
    let s = 0;
    if (symbol.endsWith(".KS") || symbol.endsWith(".KQ")) s += 50;
    if (exchange === "KRX" || exchange === "XKRX") s += 60;
    if (exchange.includes("KSE") || exchange.includes("KOSDAQ") || country === "SOUTH KOREA" || country === "KOREA") s += 40;
    if (exchange.includes("NASDAQ") || exchange.includes("NYSE") || country === "UNITED STATES") s += 20;
    // 길이가 너무 길면 감점(잡음)
    s -= Math.max(0, symbol.length - 12);
    return s;
  };

  const sorted = [...items].sort((a, b) => score(b) - score(a));
  const best = sorted[0];
  const sym = best?.symbol;
  const ex = String(best?.exchange ?? "").toUpperCase();

  if (typeof sym === "string" && sym.length > 0) {
    // Twelve Data KRX는 005930:KRX 형태로 접근하는 예시가 공식 지원 문서에 있습니다.
    if ((ex === "KRX" || ex === "XKRX") && /^\d{6}$/.test(sym)) {
      return `${sym}:KRX`;
    }
    return sym;
  }

  return null;
}

/**
 * Twelve Data Symbol Search API Proxy
 * GET /api/twelvedata/search?q=삼성전자
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = normalizeQuery(searchParams.get("q") ?? "");

  if (!q) {
    return NextResponse.json({ error: "Missing query parameter: q" }, { status: 400 });
  }

  // 한글 키워드 빠른 폴백
  if (KO_SYMBOL_FALLBACK[q]) {
    return NextResponse.json({ symbol: KO_SYMBOL_FALLBACK[q], source: "fallback" }, { status: 200 });
  }

  const apiKey = process.env.TWELVEDATA_API_KEY ?? process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Twelve Data API key is not configured" }, { status: 500 });
  }

  try {
    // Twelve Data: symbol_search endpoint
    // (문서/예시 기준: /symbol_search?symbol=...&apikey=...)
    const url = new URL("https://api.twelvedata.com/symbol_search");
    url.searchParams.set("symbol", q);
    url.searchParams.set("apikey", apiKey);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const text = await res.text().catch(() => "");
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: "Twelve Data search request failed.", details: text.slice(0, 500) },
        { status: 502 }
      );
    }

    // 응답 형태: { data: [...] } 형태가 일반적
    const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    const symbol = pickBestSymbol(list);

    return NextResponse.json(
      { symbol, source: "twelvedata" },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "검색 중 오류가 발생했습니다.", details: errorMessage }, { status: 500 });
  }
}


