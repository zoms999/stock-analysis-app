// src/lib/api/search.ts

/**
 * 사용자가 입력한 키워드(다국어 포함)를 티커(symbol)로 변환합니다.
 * - Yahoo Finance 검색(`/api/yahoo/search`)을 1순위로 사용합니다. (코인 및 해외 주식에 강함)
 * - (옵션) Yahoo가 못 찾으면 Twelve Data 검색(`/api/twelvedata/search`)으로 폴백합니다.
 */
export interface SearchResult {
  symbol: string;
  exchange?: string;
  type?: string;
  country?: string;
}

/**
 * 사용자가 입력한 키워드(다국어 포함)를 티커(symbol)로 변환합니다.
 * - Yahoo Finance 검색(`/api/yahoo/search`)을 1순위로 사용합니다. (코인 및 해외 주식에 강함)
 * - (옵션) Yahoo가 못 찾으면 Twelve Data 검색(`/api/twelvedata/search`)으로 폴백합니다.
 */
export async function searchSymbol(query: string): Promise<SearchResult | null> {
  const q = query?.trim();
  if (!q) return null;

  try {
    // 1) Yahoo Finance (코인 및 해외 주식에 강함)
    const yhUrl = `/api/yahoo/search?q=${encodeURIComponent(q)}`;
    const yhRes = await fetch(yhUrl);

    if (yhRes.ok) {
      const yhData: unknown = await yhRes.json().catch(() => null);
      if (yhData && typeof yhData === "object") {
        const symbol = (yhData as { symbol?: unknown }).symbol;
        if (typeof symbol === "string" && symbol.length > 0) {
          return { symbol };
        }
      }
    } else {
      const errorData = await yhRes.json().catch(() => ({}));
      console.warn(`Yahoo Search API Error (${yhRes.status}):`, errorData);
    }

    // 2) Twelve Data fallback (한국 주식 등에 강함)
    const tdUrl = `/api/twelvedata/search?q=${encodeURIComponent(q)}`;
    const tdRes = await fetch(tdUrl);

    if (!tdRes.ok) {
      const errorData = await tdRes.json().catch(() => ({}));
      console.error(`Twelve Data Search API Error (${tdRes.status}):`, errorData);
      return null;
    }

    const tdData: any = await tdRes.json().catch(() => null);
    if (tdData && Array.isArray(tdData.data) && tdData.data.length > 0) {
      // 첫 번째 매칭 결과 사용
      const item = tdData.data[0];
      const symbol = item.symbol;
      if (typeof symbol === "string" && symbol.length > 0) {
        return {
          symbol: symbol,
          exchange: item.exchange,
          type: item.instrument_type,
          country: item.country
        };
      }
    }
    // Fallback for object format (old handling) if data array is missing?
    if (tdData && typeof tdData === "object" && !Array.isArray(tdData.data)) {
      const symbol = (tdData as { symbol?: unknown }).symbol;
      if (typeof symbol === "string" && symbol.length > 0) {
        return { symbol: symbol };
      }
    }

    return null;

  } catch (error) {
    console.error("Search API Error:", error);
    return null;
  }
}

/**
 * 키워드로 종목 목록을 검색합니다. (Dropdown용)
 */
export async function searchStocks(query: string): Promise<SearchResult[]> {
  const q = query?.trim();
  if (!q) return [];

  try {
    // 1) Yahoo Finance 우선 시도 (더 많은 결과 반환)
    const yhUrl = `/api/yahoo/search?q=${encodeURIComponent(q)}`;
    const yhRes = await fetch(yhUrl);
    
    if (yhRes.ok) {
      const yhData: any = await yhRes.json().catch(() => null);
      if (yhData && Array.isArray(yhData.quotes) && yhData.quotes.length > 0) {
        return yhData.quotes.map((item: any) => ({
          symbol: item.symbol,
          exchange: item.exchange,
          type: item.quoteType || item.typeDisp,
          country: item.exchDisp
        }));
      }
    }

    // 2) Twelve Data 폴백
    const tdUrl = `/api/twelvedata/search?q=${encodeURIComponent(q)}`;
    const tdRes = await fetch(tdUrl);
    
    if (tdRes.ok) {
      const tdData: any = await tdRes.json().catch(() => null);
      if (tdData && Array.isArray(tdData.data)) {
        return tdData.data.map((item: any) => ({
             symbol: item.symbol,
             exchange: item.exchange,
             type: item.instrument_type,
             country: item.country
        }));
      }
    }
    return [];
  } catch (e) {
    console.error("searchStocks error:", e);
    return [];
  }
}


