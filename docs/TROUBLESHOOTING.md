# 문제 해결 가이드

## 🎉 최근 해결된 문제

### ✅ ETH-USD 차트 데이터 에러 (2026-01-23 해결)

**증상:**

```
Error: No data available for ETH-USD
```

**원인:**

- yahoo-finance2 라이브러리가 v2.12+로 업데이트되면서 API 사용 방법이 변경됨
- 기존: `import yahooFinance from 'yahoo-finance2'` (직접 사용)
- 신규: `import YahooFinance from 'yahoo-finance2'` + `const yahooFinance = new YahooFinance()` (인스턴스 생성 필수)

**해결 방법:**
모든 yahoo-finance2 import를 다음과 같이 수정:

```typescript
// ❌ 구버전 (작동 안 함)
import yahooFinance from "yahoo-finance2";

// ✅ 신버전 (v2.12+)
import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();
```

**수정된 파일:**

- `src/lib/api/price-cache.ts`
- `src/lib/price-scheduler.ts`
- `src/app/api/yahoo/route.ts`
- `src/app/api/twelvedata/candles/route.ts`

**테스트 결과:**

```bash
node test-eth-yahoo.js
# ✅ ETH-USD: $2,949.13
# ✅ BTC-USD: $89,243.98
# ✅ XRP-USD: $1.92
# ✅ SOL-USD: $127.98
```

---

## 일반적인 에러

### 1. "No data available for ETH-USD"

#### 원인

- Yahoo Finance API가 일시적으로 해당 심볼의 데이터를 제공하지 않음
- 심볼 형식이 잘못됨
- Yahoo Finance 서비스 장애

#### 해결 방법

**방법 1: 올바른 심볼 형식 사용**

```typescript
// ✅ 올바른 형식
const symbol = "ETH-USD";

// ❌ 잘못된 형식
const symbol = "ETH";
const symbol = "ETHUSD";
```

**방법 2: 업비트 API 사용 (한국 코인)**

```typescript
// KRW 페어 사용
const symbol = "KRW-ETH";
const response = await fetch(
  `/api/upbit/candles?market=${symbol}&minutes=1440&count=200`,
);
```

**방법 3: 다른 코인으로 테스트**

```bash
# BTC-USD로 테스트
curl "http://localhost:3000/api/chart?symbol=BTC-USD&interval=1d"
```

**방법 4: 잠시 후 재시도**

- Yahoo Finance API가 일시적으로 불안정할 수 있음
- 5-10분 후 다시 시도

#### 디버깅

```bash
# 1. 서버 로그 확인
npm run dev
# 콘솔에서 [PriceCache] 로그 확인

# 2. API 직접 테스트
curl "http://localhost:3000/api/chart?symbol=ETH-USD&interval=1d"

# 3. Yahoo Finance 직접 확인
# https://finance.yahoo.com/quote/ETH-USD
```

---

### 2. "Rate Limit" 에러

#### 원인

- Yahoo Finance API 호출 한도 초과
- 서버 캐싱이 작동하지 않음

#### 해결 방법

**방법 1: 캐시 확인**

```typescript
import { getCacheStats } from "@/lib/api/price-cache";
console.log(getCacheStats());
// 캐시 히트율이 낮으면 문제
```

**방법 2: 폴링 간격 조정**

```typescript
// 10초 → 30초로 변경
subscribePrices(symbols, onPrice, { interval: 30000 });
```

**방법 3: 배치 조회 사용**

```typescript
// 개별 조회 대신 배치 조회
const symbols = ["AAPL", "TSLA", "GOOGL"];
subscribePrices(symbols, onPrice); // 자동으로 배치 조회
```

---

### 3. "차트 데이터를 불러올 수 없습니다"

#### 원인

- 네트워크 오류
- API 엔드포인트 문제
- 심볼이 존재하지 않음

#### 해결 방법

**방법 1: 네트워크 확인**

```bash
# API 서버 상태 확인
curl http://localhost:3000/api/chart?symbol=AAPL&interval=1d
```

**방법 2: 심볼 검증**

```typescript
// 검색 API로 심볼 확인
const result = await searchSymbol("이더리움");
console.log(result.symbol); // ETH-USD
```

**방법 3: 브라우저 콘솔 확인**

```javascript
// F12 → Console 탭
// 에러 메시지 확인
```

---

### 4. "실시간 가격이 업데이트되지 않음"

#### 원인

- 폴링이 시작되지 않음
- cleanup 함수가 호출되지 않음
- 메모리 누수

#### 해결 방법

**방법 1: cleanup 확인**

```typescript
useEffect(() => {
  const sub = subscribePrices(symbols, onPrice);
  return () => sub.close(); // ✅ 반드시 cleanup
}, [symbols]);
```

**방법 2: 폴링 상태 확인**

```typescript
import { getGlobalPoller } from "@/lib/api/price-polling";
const poller = getGlobalPoller();
console.log("Active symbols:", poller.getActiveSymbols());
```

**방법 3: 브라우저 새로고침**

```bash
# 개발 중 HMR 문제일 수 있음
Ctrl + Shift + R (강제 새로고침)
```

---

### 5. "데이터 정합성 문제 (차트 vs 테이블)"

#### 원인

- 다른 데이터 소스 사용
- 캐시 타이밍 차이

#### 해결 방법

**방법 1: 데이터 소스 확인**

```typescript
// 모두 같은 API 사용하는지 확인
// ✅ /api/chart
// ✅ /api/price
// ❌ 직접 Yahoo Finance 호출
```

**방법 2: 캐시 초기화**

```typescript
import { clearCache } from "@/lib/api/price-cache";
clearCache();
```

**방법 3: 타임스탬프 비교**

```typescript
const chartData = await fetch("/api/chart?symbol=AAPL&interval=1d");
const priceData = await fetch("/api/price?symbol=AAPL");

console.log("Chart timestamp:", chartData[chartData.length - 1].time);
console.log("Price timestamp:", priceData.timestamp);
```

---

## 성능 문제

### 1. "차트 로딩이 느림"

#### 해결 방법

**방법 1: 간격 조정**

```typescript
// 1분봉 대신 1시간봉 사용
interval = "1h"; // 더 빠름
```

**방법 2: 기간 단축**

```typescript
// price-cache.ts에서 기간 조정
period1.setDate(period1.getDate() - 100); // 200 → 100일
```

**방법 3: 캐싱 확인**

```bash
# 두 번째 로딩은 빨라야 함 (캐시)
```

---

### 2. "메모리 사용량 증가"

#### 해결 방법

**방법 1: cleanup 확인**

```typescript
// 모든 구독에 cleanup 추가
useEffect(() => {
  const sub = subscribePrices(symbols, onPrice);
  return () => sub.close();
}, []);
```

**방법 2: 폴러 정리**

```typescript
import { getGlobalPoller } from "@/lib/api/price-polling";
const poller = getGlobalPoller();
poller.stopAll(); // 모든 폴링 중지
```

**방법 3: 브라우저 메모리 프로파일링**

```bash
# Chrome DevTools → Memory 탭
# Heap snapshot 비교
```

---

## 배포 문제

### 1. "Vercel 배포 후 작동 안 함"

#### 해결 방법

**방법 1: 환경변수 확인**

```bash
# Vercel 대시보드 → Settings → Environment Variables
NEXT_PUBLIC_SUPABASE_URL=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

**방법 2: 빌드 로그 확인**

```bash
vercel logs --follow
```

**방법 3: 로컬 프로덕션 빌드 테스트**

```bash
npm run build
npm run start
```

---

### 2. "Cron Job이 실행되지 않음"

#### 해결 방법

**방법 1: vercel.json 확인**

```json
{
  "crons": [
    {
      "path": "/api/cron/update-previous-close",
      "schedule": "30 0 * * *"
    }
  ]
}
```

**방법 2: 수동 실행 테스트**

```bash
curl https://your-domain.com/api/cron/update-previous-close
```

**방법 3: Vercel 대시보드 확인**

```
Vercel Dashboard → Cron Jobs 탭
실행 기록 및 로그 확인
```

---

## 도움 받기

### 1. 로그 수집

```bash
# 서버 로그
vercel logs --follow > logs.txt

# 브라우저 콘솔
F12 → Console → 우클릭 → Save as...
```

### 2. 재현 단계 작성

```markdown
1. 페이지 접속: http://localhost:3000
2. 심볼 입력: ETH-USD
3. 에러 발생: "No data available"
4. 브라우저: Chrome 120
5. OS: Windows 11
```

### 3. 관련 문서

- [API 통합 계획](./API_CONSOLIDATION_PLAN.md)
- [암호화폐 심볼 가이드](./CRYPTO_SYMBOL_GUIDE.md)
- [Phase 1 완료](./PHASE1_COMPLETE.md)
- [Phase 2 완료](./PHASE2_COMPLETE.md)

---

## 빠른 체크리스트

- [ ] 올바른 심볼 형식 사용 (ETH-USD, not ETH)
- [ ] 서버 로그 확인 ([PriceCache] 로그)
- [ ] 네트워크 탭 확인 (API 요청/응답)
- [ ] 캐시 상태 확인 (getCacheStats())
- [ ] cleanup 함수 추가 (메모리 누수 방지)
- [ ] 환경변수 설정 확인
- [ ] 최신 코드로 업데이트 (git pull)
- [ ] 의존성 재설치 (npm install)
- [ ] 빌드 재실행 (npm run build)
- [ ] 브라우저 캐시 삭제 (Ctrl + Shift + R)
