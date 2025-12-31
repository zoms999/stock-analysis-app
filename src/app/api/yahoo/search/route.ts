import { NextResponse } from "next/server";

/**
 * Yahoo Search API Proxy (다국어 검색 대응)
 * GET /api/yahoo/search?q=삼성전자
 *
 * - 브라우저에서 직접 query1.finance.yahoo.com 호출 시 CORS 이슈가 날 수 있어 프록시로 제공합니다.
 * - encodeURIComponent 처리는 클라이언트/서버 모두에서 수행해도 안전합니다.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (!q) {
    return NextResponse.json({ error: "Missing query parameter: q" }, { status: 400 });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=1&newsCount=0`;

    const res = await fetch(url, {
      // 일부 환경에서 403을 피하기 위해 UA를 넣어둡니다.
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
      // Next fetch cache는 기본적으로 동작하므로, 여기선 짧게만 캐시합니다.
      // (정확성이 중요하면 0으로 바꿔도 됩니다.)
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Yahoo Search API request failed.", details: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const data = await res.json();
    const symbol =
      data?.quotes && Array.isArray(data.quotes) && data.quotes.length > 0 ? data.quotes[0]?.symbol : null;

    return NextResponse.json(
      { symbol: typeof symbol === "string" ? symbol : null },
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
    console.error(`Yahoo Search API Error (q: ${q}):`, error);
    return NextResponse.json({ error: "검색 중 오류가 발생했습니다.", details: errorMessage }, { status: 500 });
  }
}


