// src/lib/api/search.ts

/**
 * Yahoo Search API 기반으로 사용자가 입력한 키워드(다국어 포함)를 티커(symbol)로 변환합니다.
 * - 클라이언트에서 직접 `query1.finance.yahoo.com` 호출 시 CORS 이슈가 날 수 있어
 *   내부 프록시 라우트(`/api/yahoo/search`)를 통해 호출합니다.
 */
export async function searchYahooSymbol(query: string): Promise<string | null> {
  const q = query?.trim();
  if (!q) return null;

  try {
    const url = `/api/yahoo/search?q=${encodeURIComponent(q)}`;
    const res = await fetch(url);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error(`Yahoo Search API Error (${res.status}):`, errorData);
      return null;
    }

    const data: unknown = await res.json();
    if (!data || typeof data !== "object") return null;

    const symbol = (data as { symbol?: unknown }).symbol;
    return typeof symbol === "string" && symbol.length > 0 ? symbol : null;
  } catch (error) {
    console.error("Yahoo Search API Error:", error);
    return null;
  }
}


