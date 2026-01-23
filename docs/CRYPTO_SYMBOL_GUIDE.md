# 암호화폐 심볼 가이드

## Yahoo Finance 코인 심볼 형식

### 지원되는 형식

Yahoo Finance는 다음 형식의 암호화폐 심볼을 지원합니다:

| 코인     | 올바른 형식 | 잘못된 형식       |
| -------- | ----------- | ----------------- |
| 비트코인 | `BTC-USD`   | `BTC`, `BTCUSD`   |
| 이더리움 | `ETH-USD`   | `ETH`, `ETHUSD`   |
| 리플     | `XRP-USD`   | `XRP`, `XRPUSD`   |
| 솔라나   | `SOL-USD`   | `SOL`, `SOLUSD`   |
| 도지코인 | `DOGE-USD`  | `DOGE`, `DOGEUSD` |

### 자동 변환

시스템은 다음과 같이 자동으로 심볼을 변환합니다:

```typescript
// 입력: ETH
// 자동 변환: ETH-USD

// 입력: BTC
// 자동 변환: BTC-USD
```

## 문제 해결

### "No data available for ETH-USD" 에러

이 에러가 발생하는 경우:

1. **Yahoo Finance API 문제**
   - Yahoo Finance가 일시적으로 해당 코인 데이터를 제공하지 않을 수 있음
   - 몇 분 후 다시 시도

2. **심볼 형식 문제**
   - 올바른 형식: `ETH-USD`
   - 잘못된 형식: `ETH`, `ETHUSD`, `ETH/USD`

3. **대체 방법**
   - 업비트 코인 (KRW 페어) 사용
   - 예: `KRW-ETH` → Upbit API 사용

### 테스트 방법

```bash
# 1. 직접 API 테스트
curl "http://localhost:3000/api/chart?symbol=ETH-USD&interval=1d"

# 2. 다른 코인 테스트
curl "http://localhost:3000/api/chart?symbol=BTC-USD&interval=1d"

# 3. 업비트 코인 테스트
curl "http://localhost:3000/api/upbit/candles?market=KRW-ETH&minutes=1440&count=200"
```

## 지원되는 암호화폐 목록

### Yahoo Finance (글로벌)

```typescript
const YAHOO_CRYPTO = [
  "BTC-USD", // 비트코인
  "ETH-USD", // 이더리움
  "XRP-USD", // 리플
  "SOL-USD", // 솔라나
  "DOGE-USD", // 도지코인
  "ADA-USD", // 카르다노
  "AVAX-USD", // 아발란체
  "MATIC-USD", // 폴리곤
  "DOT-USD", // 폴카닷
  "LINK-USD", // 체인링크
  "ATOM-USD", // 코스모스
];
```

### Upbit (한국)

```typescript
const UPBIT_CRYPTO = [
  "KRW-BTC", // 비트코인
  "KRW-ETH", // 이더리움
  "KRW-XRP", // 리플
  "KRW-SOL", // 솔라나
  "KRW-DOGE", // 도지코인
  // ... (src/lib/api/upbit-coins.ts 참고)
];
```

## 코드 예시

### 프론트엔드에서 사용

```typescript
// 올바른 사용
const symbol = "ETH-USD";
const response = await fetch(`/api/chart?symbol=${symbol}&interval=1d`);

// 자동 변환 (권장하지 않음, 명시적으로 -USD 추가)
const symbol = "ETH"; // 시스템이 ETH-USD로 변환
```

### 에러 핸들링

```typescript
try {
  const response = await fetch(`/api/chart?symbol=ETH-USD&interval=1d`);

  if (!response.ok) {
    const error = await response.json();

    if (error.suggestion) {
      console.log("Suggestion:", error.suggestion);
      // 예: "Try using ETH-USD format instead of ETH"
    }

    // 대체 방법 시도
    if (error.yahooSymbol) {
      console.log("Try:", error.yahooSymbol);
    }
  }

  const candles = await response.json();
} catch (error) {
  console.error("Failed to fetch chart:", error);
}
```

## Yahoo Finance 제한사항

### 지원하지 않는 것

1. **KRW 페어**
   - ❌ `KRW-BTC`, `KRW-ETH` 등
   - ✅ 대신 Upbit API 사용

2. **일부 신규 코인**
   - Yahoo Finance가 아직 지원하지 않는 코인
   - 업비트에서만 거래되는 코인

3. **실시간 틱 데이터**
   - Yahoo는 캔들 데이터만 제공
   - 밀리초 단위 틱 데이터 없음

### 지원하는 것

1. **주요 암호화폐**
   - 시가총액 상위 50개 대부분 지원

2. **다양한 간격**
   - 1분봉, 5분봉, 15분봉, 30분봉
   - 1시간봉, 1일봉, 1주봉, 1월봉

3. **과거 데이터**
   - 최대 수년치 데이터 제공

## 디버깅

### 로그 확인

```typescript
// price-cache.ts에서 로그 출력
console.log("[PriceCache] Fetching:", symbol);
console.log("[PriceCache] Yahoo symbol:", yahooSymbol);
console.log("[PriceCache] Result:", result);
```

### 브라우저 콘솔

```javascript
// 개발자 도구 콘솔에서 직접 테스트
fetch("/api/chart?symbol=ETH-USD&interval=1d")
  .then((r) => r.json())
  .then(console.log)
  .catch(console.error);
```

### 서버 로그

```bash
# Vercel 로그 확인
vercel logs --follow

# 로컬 개발 서버
npm run dev
# 콘솔에서 [PriceCache] 로그 확인
```

## 대체 솔루션

### 1. Upbit API 사용 (한국 코인)

```typescript
// KRW 페어는 Upbit API 사용
const symbol = "KRW-ETH";
const response = await fetch(
  `/api/upbit/candles?market=${symbol}&minutes=1440&count=200`,
);
```

### 2. 다른 데이터 소스 추가 (미래)

```typescript
// CoinGecko, Binance 등 추가 가능
// Phase 4 이후 고려
```

## 참고 자료

- [Yahoo Finance API 문서](https://github.com/gadicc/node-yahoo-finance2)
- [Upbit API 문서](https://docs.upbit.com/)
- [암호화폐 심볼 목록](./upbit-coins.ts)
