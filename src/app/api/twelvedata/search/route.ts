import { NextResponse } from "next/server";
import { getSystemConfig } from "@/lib/config-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 최소한의 한글 키워드 보정(사용자 UX용). 필요하면 더 확장 가능.
// 키: 공백제거 + 대문자변환 된 문자열
const KO_SYMBOL_FALLBACK: Record<string, string> = {
  // Twelve Data KRX 예시 포맷: 005930:KRX
  // 목적: 한글 검색어는 Yahoo fallback을 타지 않고 즉시 매핑되도록 함

  // =========================
  // 반도체 / IT
  // =========================
  "삼성전자": "005930:KRX",
  "삼전": "005930:KRX",
  "삼성": "005930:KRX",

  "SK하이닉스": "000660:KRX",
  "하이닉스": "000660:KRX",

  "삼성전기": "009150:KRX",
  "삼전기": "009150:KRX",

  "삼성SDI": "006400:KRX",

  "LG이노텍": "011070:KRX",
  "엘지이노텍": "011070:KRX",

  "LG디스플레이": "034220:KRX",
  "엘지디스플레이": "034220:KRX",

  "SK텔레콤": "017670:KRX",
  "SKT": "017670:KRX",
  "에스케이텔레콤": "017670:KRX",

  "KT": "030200:KRX",
  "케이티": "030200:KRX",

  "LG유플러스": "032640:KRX",
  "엘지유플러스": "032640:KRX",

  "카카오": "035720:KRX",
  "카카오톡": "035720:KRX",

  "NAVER": "035420:KRX",
  "네이버": "035420:KRX",

  "삼성SDS": "018260:KRX",

  "엔씨소프트": "036570:KRX",
  "NC": "036570:KRX",
  "엔씨": "036570:KRX",

  "넷마블": "251270:KRX",

  // =========================
  // 2차전지 / 화학
  // =========================
  "LG에너지솔루션": "373220:KRX",
  "LG엔솔": "373220:KRX",
  "엘지에너지솔루션": "373220:KRX",

  "LG화학": "051910:KRX",
  "엘지화학": "051910:KRX",

  "포스코퓨처엠": "003670:KRX",
  "POSCO퓨처엠": "003670:KRX",

  "에코프로": "086520:KRX",
  "에코프로비엠": "247540:KRX",
  "에코프로BM": "247540:KRX",

  "엘앤에프": "066970:KRX",
  "L&F": "066970:KRX",

  "한화솔루션": "009830:KRX",

  // =========================
  // 자동차 / 기계
  // =========================
  "현대차": "005380:KRX",
  "현대자동차": "005380:KRX",

  "기아": "000270:KRX",

  "현대모비스": "012330:KRX",
  "모비스": "012330:KRX",

  "현대글로비스": "086280:KRX",
  "글로비스": "086280:KRX",

  "한화에어로스페이스": "012450:KRX",
  "한화에어로": "012450:KRX",

  "두산에너빌리티": "034020:KRX",
  "두산중공업": "034020:KRX", // 구명칭 검색 대비

  "현대로템": "064350:KRX",

  // =========================
  // 금융
  // =========================
  "KB금융": "105560:KRX",
  "국민금융": "105560:KRX",
  "신한지주": "055550:KRX",
  "하나금융지주": "086790:KRX",
  "하나금융": "086790:KRX",
  "우리금융지주": "316140:KRX",
  "우리금융": "316140:KRX",

  "삼성생명": "032830:KRX",
  "삼성화재": "000810:KRX",

  "미래에셋증권": "006800:KRX",
  "미래에셋": "006800:KRX",

  "한국금융지주": "071050:KRX",
  "한금지": "071050:KRX",

  "카카오뱅크": "323410:KRX",
  "카뱅": "323410:KRX",
  "카카오페이": "377300:KRX",

  // =========================
  // 바이오 / 헬스케어
  // =========================
  "삼성바이오로직스": "207940:KRX",
  "삼바": "207940:KRX",

  "셀트리온": "068270:KRX",

  "SK바이오팜": "326030:KRX",

  "유한양행": "000100:KRX",

  "한미약품": "128940:KRX",

  "종근당": "185750:KRX",
  "녹십자": "006280:KRX",

  // =========================
  // 소비재 / 유통 / 플랫폼
  // =========================
  "LG전자": "066570:KRX",
  "엘지전자": "066570:KRX",

  "삼성물산": "028260:KRX",

  "아모레퍼시픽": "090430:KRX",
  "아모레": "090430:KRX",

  "오리온": "271560:KRX",

  "롯데쇼핑": "023530:KRX",
  "신세계": "004170:KRX",

  "CJ": "001040:KRX",
  "CJ제일제당": "097950:KRX",

  "대한항공": "003490:KRX",
  "아시아나항공": "020560:KRX",

  // =========================
  // 철강 / 소재 / 건설
  // =========================
  "POSCO홀딩스": "005490:KRX",
  "포스코홀딩스": "005490:KRX",
  "포스코": "005490:KRX",

  "현대제철": "004020:KRX",

  "고려아연": "010130:KRX",

  "LG": "003550:KRX",        // 지주
  "SK": "034730:KRX",        // 지주
  "SKC": "011790:KRX",
  "에스케이씨": "011790:KRX",
  "SKC솔믹스": "336370:KRX",
  "롯데지주": "004990:KRX",
  "두산": "000150:KRX",

  "GS건설": "006360:KRX",
  "현대건설": "000720:KRX",

  // =========================
  // 전력 / 인프라
  // =========================
  "한국전력": "015760:KRX",
  "한전": "015760:KRX",

  // =========================
  // 기타 많이 찾는 종목
  // =========================
  "하이브": "352820:KRX",
  "HYBE": "352820:KRX",

  "삼양식품": "003230:KRX",

  "펄어비스": "263750:KRX",

  "크래프톤": "259960:KRX",
};


function normalizeQuery(q: string) {
  // 공백 제거 + 대문자 변환
  return q.trim().replace(/\s+/g, "").toUpperCase();
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
    const sym = KO_SYMBOL_FALLBACK[q];
    return NextResponse.json({ 
        symbol: sym, 
        // Mock data structure for dropdown compatibility
        data: [{ 
            symbol: sym, 
            instrument_name: q, 
            exchange: "KRX", 
            instrument_type: "Common Stock",
            country: "South Korea" 
        }],
        source: "fallback" 
    }, { status: 200 });
  }

  const apiKey = await getSystemConfig("TWELVEDATA_API_KEY");
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
      { symbol, data: list, source: "twelvedata" },
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
