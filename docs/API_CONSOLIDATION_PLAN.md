# API 통합 계획 - Yahoo Finance 단일화

## 현황 분석

### 현재 사용 중인 데이터 API

| API                    | 용도                  | 사용 위치                  | 비용             | 장점                      | 단점          |
| ---------------------- | --------------------- | -------------------------- | ---------------- | ------------------------- | ------------- |
| **Yahoo Finance**      | 주식(미국/한국), 코인 | 대부분의 차트, 가격 조회   | 무료             | 광범위한 커버리지, 안정적 | Rate limit    |
| **TwelveData**         | 주식, 실시간 스트리밍 | 차트 컴포넌트, 실시간 가격 | 무료 티어 제한   | 실시간 WebSocket          | API 제한      |
| **Upbit**              | 한국 코인             | 업비트 코인 전용           | 무료             | 정확한 한국 코인 데이터   | 업비트만 지원 |
| **Finnhub**            | 미국 주식             | 일부 차트                  | 무료 티어 제한   | 미국 주식 특화            | 제한적        |
| **KIS (한국투자증권)** | 한국 주식             | 실시간 한국 주식           | 무료 (계정 필요) | 정확한 한국 주식          | 복잡한 인증   |

## 통합 전략: Yahoo Finance 중심

### 왜 Yahoo Finance인가?

1. **비용**: 완전 무료 (yahoo-finance2 라이브러리)
2. **커버리지**:
   - 미국 주식: ✅ (AAPL, TSLA 등)
   - 한국 주식: ✅ (005930.KS, 삼성전자)
   - 코인: ✅ (BTC-USD, ETH-USD)
   - 업비트 코인: ⚠️ (KRW-BTC는 직접 지원 안 함, 변환 필요)
3. **데이터 정합성**: 단일 소스로 통일하여 차트와 테이블 수치 일치
4. **안정성**: 오랜 기간 검증된 데이터 소스
5. **Previous Close**: 명확한 `previousClose` 필드 제공

### 예외 케이스

| 자산                  | Yahoo 지원 | 대안                | 이유                    |
| --------------------- | ---------- | ------------------- | ----------------------- |
| 업비트 코인 (KRW-BTC) | ❌         | Upbit API 유지      | Yahoo는 KRW 페어 미지원 |
| 한국 주식 실시간      | ⚠️         | KIS API 유지 (선택) | 더 정확한 실시간 데이터 |

## 마이그레이션 계획

### Phase 1: 핵심 데이터 소스 통합 (우선순위 높음)

#### 1.1 차트 컴포넌트

```typescript
// 변경 전
import { fetchTwelveDataCandles } from "@/lib/api/twelvedata";

// 변경 후
import { fetchYahooCandles } from "@/lib/api/yahoo";
```

**영향받는 파일:**

- ✅ `src/components/analyze/ChartAnalyzer.tsx`
- ✅ `src/components/analyze/SavedChartViewer.tsx`
- ✅ `src/components/chart/TechChart.tsx`

#### 1.2 가격 조회 API

```typescript
// src/lib/api/prices.ts
export async function getCurrentPrice(
  symbol: string,
  source: PriceSource = "yahoo", // 기본값 변경
): Promise<number | null>;
```

**영향받는 파일:**

- ✅ `src/lib/api/prices.ts`
- ✅ `src/app/posts/[id]/page.tsx`

#### 1.3 Cron Job (전일 종가 업데이트)

```typescript
// src/lib/cron/update-previous-close.ts
function getDataSource(symbol: string): "yahoo" | "upbit" {
  // Upbit 코인만 예외
  if (symbol.includes("KRW-")) return "upbit";

  // 나머지는 모두 Yahoo
  return "yahoo";
}
```

**영향받는 파일:**

- ✅ `src/lib/cron/update-previous-close.ts`
- ✅ `src/app/api/cron/update-previous-close/route.ts`

### Phase 2: 실시간 스트리밍 (우선순위 중간)

#### 2.1 실시간 가격 업데이트

**현재 상황:**

- TwelveData WebSocket을 SSE로 프록시하여 사용
- 한국 주식은 KIS WebSocket 사용

**통합 방안:**

```typescript
// 옵션 1: Yahoo Finance 폴링 (간단, 안정적)
// - 10초마다 가격 조회
// - WebSocket 없이 REST API만 사용

// 옵션 2: 하이브리드 (권장)
// - 업비트 코인: Upbit WebSocket 유지
// - 한국 주식: KIS WebSocket 유지 (선택)
// - 나머지: Yahoo 폴링
```

**영향받는 파일:**

- ⚠️ `src/lib/api/twelvedata.ts` (subscribeTwelveDataPrices)
- ⚠️ `src/components/home/ChartBoardList.tsx`
- ⚠️ `src/app/posts/page.tsx`

### Phase 3: 검색 기능 (우선순위 낮음)

#### 3.1 심볼 검색

**현재:**

- Yahoo Finance 검색 → TwelveData 폴백

**변경 후:**

- Yahoo Finance 검색만 사용
- 업비트 코인은 별도 하드코딩 목록

**영향받는 파일:**

- ✅ `src/lib/api/search.ts`
- ✅ `src/app/api/twelvedata/search/route.ts` (제거 가능)

### Phase 4: 레거시 API 제거 (최종)

#### 4.1 제거 대상

**완전 제거:**

- ❌ Finnhub API
  - `src/lib/api/finnhub.ts`
  - `src/app/api/finnhub/candles/route.ts`

**조건부 유지:**

- ⚠️ TwelveData API (실시간 스트리밍 대안 마련 후 제거)
  - `src/lib/api/twelvedata.ts`
  - `src/app/api/twelvedata/candles/route.ts`
  - `src/app/api/twelvedata/stream/route.ts`
  - `src/app/api/twelvedata/search/route.ts`

- ✅ Upbit API (한국 코인 전용으로 유지)
  - `src/lib/api/upbit.ts`
  - `src/app/api/upbit/candles/route.ts`
  - `src/app/api/upbit/ticker/route.ts`

- ✅ KIS API (한국 주식 실시간 전용으로 유지)
  - `src/lib/api/kis.ts`
  - `src/app/api/kis/candles/route.ts`
  - `src/app/api/kis/stream/route.ts`

## 구현 상세

### 1. Yahoo Finance 심볼 정규화

```typescript
// src/lib/api/yahoo.ts

/**
 * 심볼을 Yahoo Finance 형식으로 변환
 */
export function normalizeSymbolForYahoo(symbol: string): string {
  const s = symbol.trim().toUpperCase();

  // 1. 업비트 코인 (KRW-BTC) → 지원 안 함, Upbit API 사용
  if (s.includes("KRW-")) {
    throw new Error("Upbit symbols not supported by Yahoo, use Upbit API");
  }

  // 2. 한국 주식 (6자리 숫자)
  if (/^\d{6}$/.test(s)) {
    return `${s}.KS`; // 코스피
    // 코스닥은 .KQ (필요시 별도 로직)
  }

  // 3. KRX 프리픽스 제거
  if (s.startsWith("KRX:")) {
    const code = s.replace(/^KRX:/, "");
    return `${code}.KS`;
  }

  // 4. 미국 주식, 코인 등은 그대로
  return s;
}
```

### 2. 통합 가격 조회 함수

```typescript
// src/lib/api/unified-price.ts

export type DataSource = "yahoo" | "upbit" | "kis";

export interface PriceData {
  symbol: string;
  price: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  source: DataSource;
}

/**
 * 심볼에 따라 자동으로 적절한 데이터 소스 선택
 */
export async function fetchPrice(symbol: string): Promise<PriceData | null> {
  // 1. 업비트 코인
  if (symbol.includes("KRW-")) {
    const candles = await fetchUpbitCandles(symbol, 2);
    if (!candles || candles.length < 2) return null;

    const current = candles[candles.length - 1];
    const previous = candles[candles.length - 2];

    return {
      symbol,
      price: current.close,
      previousClose: previous.close,
      change: current.close - previous.close,
      changePercent: ((current.close - previous.close) / previous.close) * 100,
      source: "upbit",
    };
  }

  // 2. 나머지는 모두 Yahoo
  const yahooSymbol = normalizeSymbolForYahoo(symbol);
  const quote = await yahooFinance.quote(yahooSymbol);

  if (!quote) return null;

  return {
    symbol,
    price: quote.regularMarketPrice || 0,
    previousClose: quote.regularMarketPreviousClose,
    change: quote.regularMarketChange,
    changePercent: quote.regularMarketChangePercent,
    source: "yahoo",
  };
}
```

### 3. 실시간 가격 폴링 (WebSocket 대안)

```typescript
// src/lib/api/price-polling.ts

export class PricePoller {
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * 심볼 가격을 주기적으로 폴링
   */
  subscribe(
    symbols: string[],
    onPrice: (data: PriceData) => void,
    intervalMs: number = 10000, // 10초
  ) {
    symbols.forEach((symbol) => {
      // 즉시 1회 실행
      this.fetchAndNotify(symbol, onPrice);

      // 주기적 실행
      const timer = setInterval(() => {
        this.fetchAndNotify(symbol, onPrice);
      }, intervalMs);

      this.intervals.set(symbol, timer);
    });

    return {
      close: () => {
        symbols.forEach((symbol) => {
          const timer = this.intervals.get(symbol);
          if (timer) {
            clearInterval(timer);
            this.intervals.delete(symbol);
          }
        });
      },
    };
  }

  private async fetchAndNotify(
    symbol: string,
    onPrice: (data: PriceData) => void,
  ) {
    try {
      const data = await fetchPrice(symbol);
      if (data) onPrice(data);
    } catch (error) {
      console.error(`Failed to fetch price for ${symbol}:`, error);
    }
  }
}
```

## 마이그레이션 체크리스트

### Phase 1: 핵심 데이터 (즉시 시작)

- [ ] `src/lib/api/yahoo.ts`에 `normalizeSymbolForYahoo` 추가
- [ ] `src/lib/api/unified-price.ts` 생성
- [ ] `src/components/analyze/ChartAnalyzer.tsx` 수정
- [ ] `src/components/analyze/SavedChartViewer.tsx` 수정
- [ ] `src/components/chart/TechChart.tsx` 수정
- [ ] `src/lib/api/prices.ts` 기본값 변경
- [ ] `src/lib/cron/update-previous-close.ts` 수정
- [ ] 테스트: 차트 표시 확인
- [ ] 테스트: 전일 종가 업데이트 확인

### Phase 2: 실시간 스트리밍 (1주일 후)

- [ ] `src/lib/api/price-polling.ts` 생성
- [ ] `src/components/home/ChartBoardList.tsx` 수정
- [ ] `src/app/posts/page.tsx` 수정
- [ ] 테스트: 실시간 가격 업데이트 확인
- [ ] 성능 모니터링 (폴링 vs WebSocket)

### Phase 3: 검색 기능 (2주일 후)

- [ ] `src/lib/api/search.ts` 수정 (TwelveData 폴백 제거)
- [ ] 업비트 코인 목록 하드코딩
- [ ] 테스트: 검색 기능 확인

### Phase 4: 레거시 제거 (1개월 후)

- [ ] Finnhub API 완전 제거
- [ ] TwelveData API 제거 (실시간 대안 확인 후)
- [ ] 환경변수 정리 (.env)
- [ ] 문서 업데이트

## 데이터 정합성 검증

### 검증 항목

1. **차트 vs 테이블 수치 일치**

   ```sql
   -- 차트에 표시된 가격과 daily_predictions의 previous_close 비교
   SELECT
     dp.prediction_date,
     dp.previous_close,
     mp.close_price,
     ABS(dp.previous_close - mp.close_price) as diff
   FROM daily_predictions dp
   JOIN market_prices mp ON dp.post_id = mp.post_id
   WHERE ABS(dp.previous_close - mp.close_price) > 0.01
   ORDER BY diff DESC;
   ```

2. **실시간 가격 vs 차트 가격**
   - 실시간 표시 가격이 차트 최신 캔들과 일치하는지 확인

3. **Previous Close 정확도**
   - Yahoo의 `previousClose`와 직접 계산한 전일 종가 비교

### 모니터링

```typescript
// src/lib/monitoring/price-consistency.ts

export async function checkPriceConsistency(symbol: string) {
  // 1. Yahoo에서 가격 조회
  const yahooPrice = await fetchYahooPrice(symbol);

  // 2. 차트 데이터에서 최신 가격 조회
  const candles = await fetchYahooCandles(symbol, "1d");
  const chartPrice = candles[candles.length - 1]?.close;

  // 3. 비교
  const diff = Math.abs(yahooPrice - chartPrice);
  const diffPercent = (diff / yahooPrice) * 100;

  if (diffPercent > 0.1) {
    console.warn(
      `Price inconsistency for ${symbol}: ${diffPercent.toFixed(2)}%`,
    );
  }

  return { yahooPrice, chartPrice, diff, diffPercent };
}
```

## 롤백 계획

만약 Yahoo Finance 통합 후 문제가 발생하면:

1. **즉시 롤백**:
   - Git revert로 이전 버전 복구
   - 환경변수 원복

2. **부분 롤백**:
   - 문제가 있는 자산군만 이전 API로 복구
   - 예: 한국 주식만 TwelveData로 복구

3. **하이브리드 유지**:
   - Yahoo를 기본으로 하되, 특정 케이스만 다른 API 사용
   - 데이터 소스를 명시적으로 표시

## 예상 효과

### 긍정적 효과

1. **데이터 정합성**: 단일 소스로 차트와 테이블 수치 완벽 일치
2. **비용 절감**: TwelveData API 제한 걱정 없음
3. **유지보수 간소화**: 관리할 API 수 감소
4. **안정성 향상**: 검증된 Yahoo Finance 사용

### 주의사항

1. **Rate Limit**: Yahoo도 과도한 요청 시 제한 가능
   - 해결: 캐싱, 요청 간격 조절
2. **실시간성 저하**: WebSocket → 폴링으로 변경 시
   - 해결: 폴링 간격 최적화 (10초)
3. **업비트 코인**: 별도 API 유지 필요
   - 해결: 명확한 분기 로직

## 관련 문서

- [Yahoo Finance API 문서](https://github.com/gadicc/node-yahoo-finance2)
- [Upbit API 문서](https://docs.upbit.com/)
- [KIS Developers 문서](https://apiportal.koreainvestment.com/)

## 문의 및 피드백

마이그레이션 중 문제 발생 시:

1. 로그 확인: `vercel logs --follow`
2. 데이터 정합성 검증 스크립트 실행
3. 필요시 부분 롤백
