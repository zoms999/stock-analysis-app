// src/lib/api/search.ts

/**
 * 사용자가 입력한 키워드(다국어 포함)를 티커(symbol)로 변환합니다.
 * - Twelve Data 검색(`/api/twelvedata/search`)을 1순위로 사용합니다.
 * - (옵션) Twelve Data가 못 찾으면 Yahoo 검색(`/api/yahoo/search`)으로 폴백합니다.
 */
export async function searchSymbol(query: string): Promise<string | null> {
  const q = query?.trim();
  if (!q) return null;

  try {
    // 1) Twelve Data
    const tdUrl = `/api/twelvedata/search?q=${encodeURIComponent(q)}`;
    const tdRes = await fetch(tdUrl);

    if (tdRes.ok) {
      const tdData: unknown = await tdRes.json().catch(() => null);
      if (tdData && typeof tdData === "object") {
        const symbol = (tdData as { symbol?: unknown }).symbol;
        if (typeof symbol === "string" && symbol.length > 0) return symbol;
      }
    } else {
      const errorData = await tdRes.json().catch(() => ({}));
      console.warn(`Twelve Data Search API Error (${tdRes.status}):`, errorData);
    }

    // 2) Yahoo fallback (기존 프록시 유지)
    const yhUrl = `/api/yahoo/search?q=${encodeURIComponent(q)}`;
    const yhRes = await fetch(yhUrl);

    if (!yhRes.ok) {
      const errorData = await yhRes.json().catch(() => ({}));
      console.error(`Yahoo Search API Error (${yhRes.status}):`, errorData);
      return null;
    }

    const yhData: unknown = await yhRes.json();
    if (!yhData || typeof yhData !== "object") return null;
    const symbol = (yhData as { symbol?: unknown }).symbol;
    return typeof symbol === "string" && symbol.length > 0 ? symbol : null;
  } catch (error) {
    console.error("Search API Error:", error);
    return null;
  }
}


