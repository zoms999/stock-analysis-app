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
    // 0) 한국 주요 종목 하드코딩 매핑 (Yahoo Finance가 한글 검색을 잘 못하므로)
    const koreanStockMap: Record<string, { symbol: string; name: string }> = {
  // ✅ 기존
  '삼성전자': { symbol: '005930.KS', name: '삼성전자' },
  '005930': { symbol: '005930.KS', name: '삼성전자' },
  'sk하이닉스': { symbol: '000660.KS', name: 'SK하이닉스' },
  '000660': { symbol: '000660.KS', name: 'SK하이닉스' },
  '현대차': { symbol: '005380.KS', name: '현대차' },
  '005380': { symbol: '005380.KS', name: '현대차' },
  'lg에너지솔루션': { symbol: '373220.KS', name: 'LG에너지솔루션' },
  '373220': { symbol: '373220.KS', name: 'LG에너지솔루션' },
  '삼성바이오로직스': { symbol: '207940.KS', name: '삼성바이오로직스' },
  '207940': { symbol: '207940.KS', name: '삼성바이오로직스' },
  'naver': { symbol: '035420.KS', name: 'NAVER' },
  '네이버': { symbol: '035420.KS', name: 'NAVER' },
  '035420': { symbol: '035420.KS', name: 'NAVER' },
  'kakao': { symbol: '035720.KS', name: 'Kakao' },
  '카카오': { symbol: '035720.KS', name: 'Kakao' },
  '035720': { symbol: '035720.KS', name: 'Kakao' },

  // ✅ 금융/지주/은행
  '삼성물산': { symbol: '028260.KS', name: '삼성물산' },
  '028260': { symbol: '028260.KS', name: '삼성물산' },
  '삼성생명': { symbol: '032830.KS', name: '삼성생명' },
  '032830': { symbol: '032830.KS', name: '삼성생명' },
  '삼성화재': { symbol: '000810.KS', name: '삼성화재' },
  '000810': { symbol: '000810.KS', name: '삼성화재' },
  'kb금융': { symbol: '105560.KS', name: 'KB금융' },
  'kb금융지주': { symbol: '105560.KS', name: 'KB금융' },
  '105560': { symbol: '105560.KS', name: 'KB금융' },
  '신한지주': { symbol: '055550.KS', name: '신한지주' },
  '055550': { symbol: '055550.KS', name: '신한지주' },
  '하나금융지주': { symbol: '086790.KS', name: '하나금융지주' },
  '086790': { symbol: '086790.KS', name: '하나금융지주' },

  // ✅ 2차전지/전기차 밸류체인
  'lg화학': { symbol: '051910.KS', name: 'LG화학' },
  '051910': { symbol: '051910.KS', name: 'LG화학' },
  '삼성sdi': { symbol: '006400.KS', name: '삼성SDI' },
  '삼성SDI': { symbol: '006400.KS', name: '삼성SDI' },
  '006400': { symbol: '006400.KS', name: '삼성SDI' },
  'posco홀딩스': { symbol: '005490.KS', name: 'POSCO홀딩스' },
  '포스코홀딩스': { symbol: '005490.KS', name: 'POSCO홀딩스' },
  '005490': { symbol: '005490.KS', name: 'POSCO홀딩스' },

  // ✅ 반도체/IT (추가 대표주)
  '삼성전자우': { symbol: '005935.KS', name: '삼성전자우' },
  '005935': { symbol: '005935.KS', name: '삼성전자우' },
  'lg전자': { symbol: '066570.KS', name: 'LG전자' },
  '066570': { symbol: '066570.KS', name: 'LG전자' },

  // ✅ 바이오/헬스케어
  '셀트리온': { symbol: '068270.KS', name: '셀트리온' },
  '068270': { symbol: '068270.KS', name: '셀트리온' },
  '삼성바이오': { symbol: '207940.KS', name: '삼성바이오로직스' }, // 별칭
  'sk바이오사이언스': { symbol: '302440.KS', name: 'SK바이오사이언스' },
  '302440': { symbol: '302440.KS', name: 'SK바이오사이언스' },

  // ✅ 소비재/플랫폼/엔터
  '아모레퍼시픽': { symbol: '090430.KS', name: '아모레퍼시픽' },
  '090430': { symbol: '090430.KS', name: '아모레퍼시픽' },
  'cj제일제당': { symbol: '097950.KS', name: 'CJ제일제당' },
  '097950': { symbol: '097950.KS', name: 'CJ제일제당' },

  // ✅ 방산/조선/중공업
  '한화에어로스페이스': { symbol: '012450.KS', name: '한화에어로스페이스' },
  '012450': { symbol: '012450.KS', name: '한화에어로스페이스' },
  '현대중공업': { symbol: '329180.KS', name: '현대중공업' },
  '329180': { symbol: '329180.KS', name: '현대중공업' },

  // ✅ 통신/인프라
  'kt': { symbol: '030200.KS', name: 'KT' },
  '케이티': { symbol: '030200.KS', name: 'KT' },
  '030200': { symbol: '030200.KS', name: 'KT' },
  'skt': { symbol: '017670.KS', name: 'SK텔레콤' },
  'sk텔레콤': { symbol: '017670.KS', name: 'SK텔레콤' },
  '017670': { symbol: '017670.KS', name: 'SK텔레콤' },

  // ✅ 대표 ETF (많이 찾는 항목)
  'kodex200': { symbol: '069500.KS', name: 'KODEX 200' },
  '코덱스200': { symbol: '069500.KS', name: 'KODEX 200' },
  '069500': { symbol: '069500.KS', name: 'KODEX 200' },
  'tiger200': { symbol: '102110.KS', name: 'TIGER 200' },
  '타이거200': { symbol: '102110.KS', name: 'TIGER 200' },
  '102110': { symbol: '102110.KS', name: 'TIGER 200' },
};

    const lowerQuery = q.toLowerCase();
    
    // ✅ 정확한 매칭 우선
    if (koreanStockMap[lowerQuery]) {
      const stock = koreanStockMap[lowerQuery];
      return {
        symbol: stock.symbol,
        name: stock.name,
        type: 'EQUITY',
        exchange: 'KRX',
        country: 'KR',
        source: 'yahoo',
      };
    }

    // ✅ 부분 매칭 (fuzzy matching): "삼성" → "삼성전자", "sk" → "SK하이닉스"
    const partialMatch = Object.entries(koreanStockMap).find(([key, value]) => {
      // 종목 코드는 부분 매칭 제외 (정확한 매칭만)
      if (/^\d+$/.test(key)) return false;
      
      // 키워드가 회사명에 포함되어 있는지 확인
      return key.includes(lowerQuery) || value.name.toLowerCase().includes(lowerQuery);
    });

    if (partialMatch) {
      const stock = partialMatch[1];
      return {
        symbol: stock.symbol,
        name: stock.name,
        type: 'EQUITY',
        exchange: 'KRX',
        country: 'KR',
        source: 'yahoo',
      };
    }

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



