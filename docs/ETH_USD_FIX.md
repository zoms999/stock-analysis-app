# ETH-USD 차트 데이터 에러 해결

**날짜:** 2026-01-23  
**상태:** ✅ 해결 완료

---

## 문제 요약

사용자가 ETH-USD 차트를 로드할 때 다음 에러가 발생:

```
Error: No data available for ETH-USD
at SavedChartViewer.useEffect.run (src/components/analyze/SavedChartViewer.tsx:937:27)
```

---

## 원인 분석

### 1. Yahoo Finance API 버전 변경

yahoo-finance2 라이브러리가 v2.12+로 업데이트되면서 API 사용 방법이 변경됨:

**구버전 (v2.11 이하):**

```typescript
import yahooFinance from "yahoo-finance2";
const quote = await yahooFinance.quote("ETH-USD"); // ✅ 작동
```

**신버전 (v2.12+):**

```typescript
import yahooFinance from "yahoo-finance2";
const quote = await yahooFinance.quote("ETH-USD"); // ❌ 에러
// Error: Call `const yahooFinance = new YahooFinance()` first
```

### 2. 영향받은 파일

프로젝트 내 4개 파일이 구버전 import 패턴을 사용하고 있었음:

1. `src/lib/api/price-cache.ts` - 핵심 캐싱 시스템
2. `src/lib/price-scheduler.ts` - 가격 스케줄러
3. `src/app/api/yahoo/route.ts` - Yahoo API 프록시
4. `src/app/api/twelvedata/candles/route.ts` - 캔들 데이터 API

---

## 해결 방법

### 수정 전 (❌ 작동 안 함)

```typescript
import yahooFinance from "yahoo-finance2";

// 직접 사용 시도
const quote = await yahooFinance.quote("ETH-USD");
```

### 수정 후 (✅ 작동)

```typescript
import YahooFinance from "yahoo-finance2";

// 인스턴스 생성 필수
const yahooFinance = new YahooFinance();

// 이제 정상 작동
const quote = await yahooFinance.quote("ETH-USD");
```

---

## 적용된 변경사항

### 1. `src/lib/api/price-cache.ts`

```diff
- import yahooFinance from 'yahoo-finance2';
+ import YahooFinance from 'yahoo-finance2';
+
+ // ✅ Yahoo Finance 인스턴스 생성 (v2.12+ 필수)
+ const yahooFinance = new YahooFinance();
```

**추가 개선:**

- `getCachedCandles` 함수에 상세한 디버깅 로그 추가
- 캐시 히트/미스 로깅
- Yahoo API 호출 시 심볼 변환 로깅

### 2. `src/lib/price-scheduler.ts`

```diff
- import yahooFinance from "yahoo-finance2";
+ import YahooFinance from "yahoo-finance2";
+
+ // ✅ Yahoo Finance 인스턴스 생성 (v2.12+ 필수)
+ const yahooFinance = new YahooFinance();
```

### 3. `src/app/api/yahoo/route.ts`

```diff
- import yahooFinance from 'yahoo-finance2';
+ import YahooFinance from 'yahoo-finance2';
+
+ // ✅ Yahoo Finance 인스턴스 생성 (v2.12+ 필수)
+ const yahooFinance = new YahooFinance();
```

### 4. `src/app/api/twelvedata/candles/route.ts`

```diff
- import yahooFinance from "yahoo-finance2";
+ import YahooFinance from "yahoo-finance2";
+
+ // ✅ Yahoo Finance 인스턴스 생성 (v2.12+ 필수)
+ const yahooFinance = new YahooFinance();
```

---

## 테스트 결과

### 테스트 스크립트 생성

`test-eth-yahoo.js` 파일을 생성하여 Yahoo Finance API 직접 테스트:

```javascript
const YahooFinance =
  require("yahoo-finance2").default || require("yahoo-finance2");
const yahooFinance = new YahooFinance();

// Test 1: Quote (현재가)
const quote = await yahooFinance.quote("ETH-USD");
console.log("Price:", quote.regularMarketPrice);

// Test 2: Chart (차트 데이터)
const chart = await yahooFinance.chart("ETH-USD", {
  period1: "2025-12-23",
  interval: "1d",
});
console.log("Data points:", chart.quotes.length);
```

### 테스트 실행 결과

```bash
$ node test-eth-yahoo.js

Testing Yahoo Finance API with ETH-USD...

Test 1: Fetching quote for ETH-USD...
✅ Quote successful:
  Symbol: ETH-USD
  Price: 2949.1262
  Previous Close: 2979.6353
  Change: 50.803467
  Change %: 1.7528554

Test 2: Fetching chart data for ETH-USD...
✅ Chart successful:
  Symbol: ETH-USD
  Currency: USD
  Exchange: CCC
  Data points: 31
  First candle: { date: '2025-12-23', close: 2963.3740234375 }
  Last candle: { date: '2026-01-22', close: 2949.126220703125 }

Test 3: Testing other crypto symbols...
  ✅ BTC-USD: $89243.984
  ✅ XRP-USD: $1.9207274
  ✅ SOL-USD: $127.975334

🎉 All tests passed! Yahoo Finance works with crypto symbols.
```

---

## 검증 체크리스트

- [x] TypeScript 컴파일 에러 없음
- [x] 모든 파일에 일관된 import 패턴 적용
- [x] Yahoo Finance API 직접 테스트 성공
- [x] ETH-USD 데이터 조회 성공
- [x] 다른 암호화폐 심볼도 정상 작동 (BTC, XRP, SOL)
- [x] 디버깅 로그 추가로 향후 문제 추적 용이
- [x] 문서 업데이트 (TROUBLESHOOTING.md)

---

## 향후 고려사항

### 1. 다른 파일 확인

프로젝트 내 다른 파일들도 yahoo-finance2를 사용하는지 확인 필요:

```bash
grep -r "import.*yahoo-finance2" src/
```

**확인된 파일:**

- `src/app/api/yahoo/candles/route.ts` - 이미 `YahooFinance` 사용 중 ✅
- `src/app/api/debug/price-status/route.ts` - 이미 `YahooFinance` 사용 중 ✅
- `src/app/api/assets/identify/route.ts` - 이미 `YahooFinance` 사용 중 ✅

### 2. 의존성 버전 고정

`package.json`에서 yahoo-finance2 버전을 명시적으로 관리:

```json
{
  "dependencies": {
    "yahoo-finance2": "^2.12.0"
  }
}
```

### 3. 에러 핸들링 강화

Yahoo Finance API 호출 실패 시 더 명확한 에러 메시지 제공:

```typescript
try {
  const quote = await yahooFinance.quote(symbol);
} catch (error) {
  console.error(`[Yahoo] Failed to fetch ${symbol}:`, error.message);
  // 대체 데이터 소스 시도 (Upbit, Binance 등)
}
```

---

## 관련 문서

- [API 통합 계획](./API_CONSOLIDATION_PLAN.md)
- [암호화폐 심볼 가이드](./CRYPTO_SYMBOL_GUIDE.md)
- [문제 해결 가이드](./TROUBLESHOOTING.md)
- [Phase 1 완료](./PHASE1_COMPLETE.md)
- [Phase 2 완료](./PHASE2_COMPLETE.md)

---

## 결론

yahoo-finance2 라이브러리의 API 변경으로 인한 문제를 성공적으로 해결했습니다. 모든 파일에서 일관된 import 패턴을 사용하도록 수정하고, 디버깅 로그를 추가하여 향후 문제 추적이 용이하도록 개선했습니다.

**핵심 교훈:**

- 외부 라이브러리 업데이트 시 Breaking Changes 확인 필수
- 일관된 import 패턴 유지
- 충분한 로깅으로 문제 진단 시간 단축
- 테스트 스크립트로 빠른 검증
