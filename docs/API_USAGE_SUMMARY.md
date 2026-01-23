# API 사용처 요약

## 📊 현재 사용 중인 데이터 API

### 1. Yahoo Finance (yahoo-finance2)

#### 라이브러리 파일

- `src/lib/api/yahoo.ts` - 캔들 데이터 조회

#### API 엔드포인트

- `src/app/api/yahoo/route.ts` - 기본 라우트
- `src/app/api/yahoo/candles/route.ts` - 캔들 데이터
- `src/app/api/yahoo/search/route.ts` - 심볼 검색

#### 사용 컴포넌트

- `src/lib/api/prices.ts` - 가격 조회 (source="yahoo")
- `src/lib/price-scheduler.ts` - 가격 스케줄러
- `src/app/api/debug/price-status/route.ts` - 디버그
- `src/app/api/twelvedata/candles/route.ts` - 폴백으로 사용
- `src/app/api/assets/identify/route.ts` - 자산 식별

#### 테스트 스크립트

- `scripts/test_yahoo.ts`

---

### 2. TwelveData

#### 라이브러리 파일

- `src/lib/api/twelvedata.ts` - 캔들 데이터 + 실시간 스트리밍

#### API 엔드포인트

- `src/app/api/twelvedata/candles/route.ts` - 캔들 데이터 (실제로는 Yahoo 사용)
- `src/app/api/twelvedata/stream/route.ts` - 실시간 WebSocket → SSE 프록시
- `src/app/api/twelvedata/search/route.ts` - 심볼 검색

#### 사용 컴포넌트

**차트 컴포넌트:**

- `src/components/analyze/ChartAnalyzer.tsx` - 차트 분석기
- `src/components/analyze/SavedChartViewer.tsx` - 저장된 차트 뷰어
- `src/components/chart/TechChart.tsx` - 기술적 차트

**실시간 가격:**

- `src/components/home/ChartBoardList.tsx` - 차트 보드 리스트
- `src/app/posts/page.tsx` - 게시글 페이지

**가격 조회:**

- `src/lib/api/prices.ts` - 기본 가격 소스 (source="twelvedata")

**검색:**

- `src/lib/api/search.ts` - 심볼 검색 (폴백)

---

### 3. Upbit (업비트)

#### 라이브러리 파일

- `src/lib/api/upbit.ts` - 캔들 데이터 + 티커

#### API 엔드포인트

- `src/app/api/upbit/candles/route.ts` - 캔들 데이터
- `src/app/api/upbit/ticker/route.ts` - 티커 정보

#### 사용 컴포넌트

- `src/lib/api/prices.ts` - 가격 조회 (source="upbit")
- `src/lib/cron/update-previous-close.ts` - 전일 종가 업데이트 (KRW- 심볼)
- `src/components/home/PostFeed.tsx` - 샘플 데이터
- `src/components/home/ChartCard.tsx` - 차트 카드

---

### 4. Finnhub

#### 라이브러리 파일

- `src/lib/api/finnhub.ts` - 캔들 데이터

#### API 엔드포인트

- `src/app/api/finnhub/candles/route.ts` - 캔들 데이터

#### 사용 컴포넌트

- `src/lib/api/prices.ts` - 타입 정의만 (실제 사용 안 함)
- `src/components/home/PostFeed.tsx` - 타입 정의만
- `src/components/home/ChartCard.tsx` - 타입 정의만

**⚠️ 실제로는 거의 사용되지 않음 - 제거 가능**

---

### 5. KIS (한국투자증권)

#### 라이브러리 파일

- `src/lib/api/kis.ts` - 토큰 관리 + 가격 조회 + WebSocket

#### API 엔드포인트

- `src/app/api/kis/candles/route.ts` - 캔들 데이터
- `src/app/api/kis/stream/route.ts` - 실시간 WebSocket → SSE 프록시

#### 사용 컴포넌트

- `src/lib/price-scheduler.ts` - 가격 스케줄러 (한국 주식)
- `src/lib/api/twelvedata.ts` - 통합 스트리밍 (subscribeUnifiedPrices)
- `src/app/api/debug/price-status/route.ts` - 디버그

#### 테스트 스크립트

- `scripts/test-scheduler-kis.ts`

---

## 🎯 통합 우선순위

### 즉시 통합 가능 (Yahoo로)

1. **차트 컴포넌트** (TwelveData → Yahoo)
   - `ChartAnalyzer.tsx`
   - `SavedChartViewer.tsx`
   - `TechChart.tsx`

2. **가격 조회** (기본값 변경)
   - `src/lib/api/prices.ts`

3. **전일 종가 업데이트** (TwelveData 제거)
   - `src/lib/cron/update-previous-close.ts`

### 신중히 통합 (대안 필요)

4. **실시간 스트리밍** (WebSocket → 폴링)
   - `ChartBoardList.tsx`
   - `posts/page.tsx`
   - 대안: 10초 폴링 또는 하이브리드

5. **검색 기능** (TwelveData 폴백 제거)
   - `src/lib/api/search.ts`
   - 대안: Yahoo만 사용 + 업비트 하드코딩

### 유지 (특수 목적)

6. **Upbit API** - 한국 코인 (KRW-BTC 등)
7. **KIS API** - 한국 주식 실시간 (선택적)

### 제거 가능

8. **Finnhub API** - 거의 사용 안 함

---

## 📝 파일별 변경 사항

### 높은 우선순위 (즉시 변경)

```typescript
// src/components/analyze/ChartAnalyzer.tsx
- import { fetchTwelveDataCandles } from "@/lib/api/twelvedata";
+ import { fetchYahooCandles } from "@/lib/api/yahoo";

// src/components/analyze/SavedChartViewer.tsx
- import { fetchTwelveDataCandles } from "@/lib/api/twelvedata";
+ import { fetchYahooCandles } from "@/lib/api/yahoo";

// src/components/chart/TechChart.tsx
- import { fetchMarketPricesCandles } from "@/lib/api/twelvedata";
+ import { fetchYahooCandles } from "@/lib/api/yahoo";

// src/lib/api/prices.ts
- source: PriceSource = "twelvedata"
+ source: PriceSource = "yahoo"

// src/lib/cron/update-previous-close.ts
function getDataSource(symbol: string): 'yahoo' | 'upbit' {
-   if (symbol.match(/^\d{6}$/)) return 'twelvedata';
+   // 한국 주식도 Yahoo로 (005930.KS 형식)
    return 'yahoo';
}
```

### 중간 우선순위 (1주일 내)

```typescript
// src/components/home/ChartBoardList.tsx
- import { subscribeTwelveDataPrices } from "@/lib/api/twelvedata";
+ import { PricePoller } from "@/lib/api/price-polling";

// src/app/posts/page.tsx
- import { subscribeTwelveDataPrices } from "@/lib/api/twelvedata";
+ import { PricePoller } from "@/lib/api/price-polling";
```

### 낮은 우선순위 (2주일 내)

```typescript
// src/lib/api/search.ts
export async function searchSymbol(query: string) {
  // Yahoo 검색만 사용
  const yahooResults = await fetch(`/api/yahoo/search?q=${query}`);

-  // TwelveData 폴백 제거
-  const tdResults = await fetch(`/api/twelvedata/search?q=${query}`);

  return yahooResults;
}
```

---

## 🔍 검증 방법

### 1. 차트 데이터 일치 확인

```bash
# 같은 심볼로 두 API 비교
curl "http://localhost:3000/api/yahoo/candles?symbol=AAPL&interval=1d"
curl "http://localhost:3000/api/twelvedata/candles?symbol=AAPL&interval=1d"
```

### 2. 전일 종가 정확도 확인

```sql
SELECT
  symbol,
  previous_close,
  actual_close,
  ABS(previous_close - actual_close) as diff
FROM daily_predictions
WHERE prediction_date = CURRENT_DATE - 1
ORDER BY diff DESC
LIMIT 10;
```

### 3. 실시간 가격 지연 측정

```typescript
// 폴링 방식의 지연 시간 측정
const start = Date.now();
const price = await fetchYahooPrice("AAPL");
const latency = Date.now() - start;
console.log(`Latency: ${latency}ms`);
```

---

## 📦 환경변수 정리

### 유지

```env
# Yahoo Finance (무료, API 키 불필요)
# (없음)

# Upbit (무료, API 키 불필요)
# (없음)

# KIS (선택적)
KIS_APP_KEY=your_app_key
KIS_APP_SECRET=your_app_secret
KIS_IS_VIRTUAL=true
```

### 제거 가능

```env
# TwelveData (통합 후 제거)
TWELVEDATA_API_KEY=xxx

# Finnhub (사용 안 함)
FINNHUB_API_KEY=xxx
NEXT_PUBLIC_FINNHUB_API_KEY=xxx
```

---

## 🚀 마이그레이션 순서

1. ✅ **Phase 1**: 차트 컴포넌트 (1일)
2. ✅ **Phase 2**: 가격 조회 API (1일)
3. ✅ **Phase 3**: Cron Job (1일)
4. ⏳ **Phase 4**: 실시간 스트리밍 (3일)
5. ⏳ **Phase 5**: 검색 기능 (2일)
6. ⏳ **Phase 6**: 레거시 제거 (1일)

**총 예상 기간: 1-2주**

---

## 📞 지원

문제 발생 시:

1. `docs/API_CONSOLIDATION_PLAN.md` 참고
2. 롤백 계획 실행
3. 로그 확인: `vercel logs --follow`
