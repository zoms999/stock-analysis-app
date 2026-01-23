// src/lib/api/search.ts

/**
 * ✅ Phase 3: Yahoo Finance 중심 검색 (TwelveData 폴백 제거)
 * 
 * 검색 우선순위:
 * 1. 업비트 코인 (하드코딩 목록)
 * 2. Yahoo Finance (미국/한국 주식, 글로벌 코인)
 */

import { searchUpbitCoins, getUpbitCoin, type UpbitCoin } from './upbit-coins';

export interface SearchResult {
  symbol: string;
  name?: string;
  exchange?: string;
  type?: string;
  country?: string;
  source?: 'upbit' | 'yahoo';
}

/**
 * 사용자가 입력한 키워드를 티커(symbol)로 변환합니다.
 * 
 * ✅ Phase 3: TwelveData 제거, Yahoo + Upbit만 사용
 */
export async function searchSymbol(query: string): Promise<SearchResult | null> {
  const q = query?.trim();
  if (!q) return null;

  try {
    // 1) 업비트 코인 우선 검색 (KRW 페어)
    const upbitResults = searchUpbitCoins(q);
    if (upbitResults.length > 0) {
      const coin = upbitResults[0];
      return {
        symbol: coin.symbol,
        name: coin.name,
        type: 'CRYPTOCURRENCY',
        exchange: 'Upbit',
        country: 'KR',
        source: 'upbit',
      };
    }

    // 2) Yahoo Finance 검색 (미국/한국 주식, 글로벌 코인)
    const yhUrl = `/api/yahoo/search?q=${encodeURIComponent(q)}`;
    const yhRes = await fetch(yhUrl);

    if (yhRes.ok) {
      const yhData: unknown = await yhRes.json().catch(() => null);
      if (yhData && typeof yhData === "object") {
        const symbol = (yhData as { symbol?: unknown }).symbol;
        if (typeof symbol === "string" && symbol.length > 0) {
          return {
            symbol,
            source: 'yahoo',
          };
        }
      }
    } else {
      const errorData = await yhRes.json().catch(() => ({}));
      console.warn(`Yahoo Search API Error (${yhRes.status}):`, errorData);
    }

    return null;

  } catch (error) {
    console.error("Search API Error:", error);
    return null;
  }
}

/**
 * 키워드로 종목 목록을 검색합니다. (Dropdown용)
 * 
 * ✅ Phase 3: TwelveData 제거, Yahoo + Upbit만 사용
 */
export async function searchStocks(query: string): Promise<SearchResult[]> {
  const q = query?.trim();
  if (!q) return [];

  try {
    const results: SearchResult[] = [];

    // 1) 업비트 코인 검색
    const upbitResults = searchUpbitCoins(q);
    results.push(...upbitResults.map((coin) => ({
      symbol: coin.symbol,
      name: coin.name,
      type: 'CRYPTOCURRENCY',
      exchange: 'Upbit',
      country: 'KR',
      source: 'upbit' as const,
    })));

    // 2) Yahoo Finance 검색
    const yhUrl = `/api/yahoo/search?q=${encodeURIComponent(q)}`;
    const yhRes = await fetch(yhUrl);

    if (yhRes.ok) {
      const yhData: any = await yhRes.json().catch(() => null);
      if (yhData && Array.isArray(yhData.quotes) && yhData.quotes.length > 0) {
        results.push(...yhData.quotes.map((item: any) => ({
          symbol: item.symbol,
          name: item.shortname || item.longname,
          exchange: item.exchange,
          type: item.quoteType || item.typeDisp,
          country: item.exchDisp,
          source: 'yahoo' as const,
        })));
      }
    }

    // 중복 제거 (같은 심볼)
    const uniqueResults = results.filter((result, index, self) =>
      index === self.findIndex((r) => r.symbol === result.symbol)
    );

    return uniqueResults;
  } catch (e) {
    console.error("searchStocks error:", e);
    return [];
  }
}



