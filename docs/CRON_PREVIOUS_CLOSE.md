# 전일 종가 자동 업데이트 시스템

## 개요

`daily_predictions` 테이블의 `previous_close` 필드를 자동으로 업데이트하는 Vercel Cron Job 시스템입니다.

## 실행 시간

### 주 실행 시간

- **09:30 KST (00:30 UTC)** - 매일 1회 실행

### 재시도 시간

- **10:00 KST (01:00 UTC)** - 1차 재시도
- **10:30 KST (01:30 UTC)** - 2차 재시도 (최종)

## 왜 09:30 KST인가?

### 시장별 마감 시간 (KST 기준)

| 자산 종류              | 시장 마감/기준 시간         | 데이터 확정 시점 |
| ---------------------- | --------------------------- | ---------------- |
| 코인 (업비트/바이낸스) | 오전 09:00 (일봉 갱신)      | 09:00 직후       |
| 미국 주식              | 오전 06:00 (썸머타임 05:00) | 장 마감 후       |
| 한국 주식              | 오후 03:30 (15:30)          | 장 마감 후       |

### 09:30 KST가 최적인 이유

1. **코인 일봉 갱신 완료**: 09:00에 새로운 일봉이 생성되고 30분의 안정화 시간 확보
2. **미국 주식 마감 완료**: 이미 장이 끝난 상태 (06:00 또는 05:00)
3. **한국 주식 마감 완료**: 전날 15:30에 장이 끝난 상태
4. **API 안정성**: 모든 데이터 제공자의 데이터가 안정화된 시점

## 작동 방식

### 1. 데이터 수집

```typescript
// 업데이트가 필요한 예측 레코드 조회
SELECT id, post_id, prediction_date, previous_close, posts.ticker_symbol
FROM daily_predictions
WHERE previous_close IS NULL
ORDER BY prediction_date ASC
```

### 2. 종목별 그룹화

- API 호출 최소화를 위해 같은 종목(symbol)끼리 그룹화
- 예: AAPL 종목에 10개의 예측이 있다면 API는 1번만 호출

### 3. 데이터 소스 자동 선택

```typescript
function getDataSource(symbol: string) {
  if (symbol.includes("KRW-")) return "upbit"; // 업비트 코인
  if (symbol.match(/^\d{6}$/)) return "twelvedata"; // 한국 주식
  return "yahoo"; // 미국 주식, 기타
}
```

### 4. 전일 종가 계산

- 캔들 데이터를 시간순으로 정렬
- `prediction_date` 이전의 가장 최근 캔들의 `close` 값을 사용

### 5. 재시도 로직

- 각 API 호출마다 최대 3회 재시도
- 지수 백오프(Exponential Backoff): 1초, 2초, 3초 대기
- 실패한 종목은 다음 cron 실행 시 재시도

## API 엔드포인트

### Cron Endpoint

```
GET /api/cron/update-previous-close
```

### 응답 예시

```json
{
  "success": true,
  "updated": 45,
  "failed": 2,
  "failedSymbols": ["INVALID-SYMBOL"],
  "duration": "12345ms",
  "message": "Updated 45 records, 2 failed"
}
```

## 수동 실행

개발 환경에서 테스트하거나 즉시 업데이트가 필요한 경우:

```bash
# 로컬 개발 환경
curl http://localhost:3000/api/cron/update-previous-close

# 프로덕션 환경
curl https://your-domain.com/api/cron/update-previous-close
```

## 모니터링

### Vercel 대시보드

1. Vercel 프로젝트 대시보드 접속
2. "Cron Jobs" 탭 선택
3. 실행 기록 및 로그 확인

### 로그 확인

```bash
# Vercel CLI로 로그 확인
vercel logs --follow
```

### 주요 로그 메시지

```
[UpdatePreviousClose] Starting update process...
[UpdatePreviousClose] Found 50 predictions to update
[UpdatePreviousClose] Processing 10 unique symbols
[UpdatePreviousClose] Processing AAPL (5 records)...
[UpdatePreviousClose] Completed AAPL: 5 records processed
[UpdatePreviousClose] Process completed
[UpdatePreviousClose] Updated: 45, Failed: 5
```

## 에러 처리

### 일반적인 에러 상황

1. **API Rate Limit**
   - 재시도 로직으로 자동 처리
   - 100ms 딜레이로 과도한 요청 방지

2. **데이터 부족**
   - 캔들 데이터가 2개 미만인 경우
   - 로그에 경고 메시지 출력, 다음 실행 시 재시도

3. **네트워크 오류**
   - 3회 재시도 후 실패
   - `failedSymbols` 배열에 기록

4. **잘못된 심볼**
   - 로그에 기록하고 건너뜀
   - 수동으로 데이터 확인 필요

## 성능 최적화

### 배치 처리

- 종목별로 그룹화하여 API 호출 최소화
- 예: 100개 예측 레코드, 10개 종목 → API 호출 10회

### 캐싱

- 같은 종목의 여러 예측은 한 번의 API 호출로 처리
- 메모리 내 임시 캐싱

### 병렬 처리 제한

- 순차 처리로 API Rate Limit 방지
- 각 종목 처리 후 100ms 대기

## 데이터베이스 스키마

```sql
CREATE TABLE daily_predictions (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES posts(id),
  prediction_date DATE NOT NULL,
  predicted_price NUMERIC NOT NULL,
  previous_close NUMERIC,           -- 이 필드를 업데이트
  actual_close NUMERIC,
  daily_accuracy NUMERIC,
  calculated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_daily_predictions_previous_close_null
ON daily_predictions(prediction_date)
WHERE previous_close IS NULL;
```

## 문제 해결

### previous_close가 업데이트되지 않는 경우

1. **Cron Job 실행 확인**

   ```bash
   # Vercel 대시보드에서 Cron Jobs 탭 확인
   ```

2. **수동 실행으로 테스트**

   ```bash
   curl https://your-domain.com/api/cron/update-previous-close
   ```

3. **로그 확인**

   ```bash
   vercel logs --follow
   ```

4. **데이터 확인**

   ```sql
   -- 업데이트가 필요한 레코드 확인
   SELECT COUNT(*)
   FROM daily_predictions
   WHERE previous_close IS NULL;

   -- 특정 종목의 캔들 데이터 확인
   SELECT * FROM market_prices
   WHERE ticker_symbol = 'AAPL'
   ORDER BY timestamp DESC
   LIMIT 10;
   ```

### 특정 종목이 계속 실패하는 경우

1. **심볼 형식 확인**
   - 업비트: `KRW-BTC` 형식
   - 한국 주식: `005930` (6자리 숫자)
   - 미국 주식: `AAPL`, `TSLA` 등

2. **데이터 소스 확인**

   ```typescript
   // 올바른 데이터 소스가 선택되는지 확인
   const source = getDataSource(symbol);
   console.log(`Symbol: ${symbol}, Source: ${source}`);
   ```

3. **수동으로 캔들 데이터 확인**

   ```bash
   # Yahoo Finance
   curl "https://your-domain.com/api/yahoo/candles?symbol=AAPL&interval=1d"

   # Upbit
   curl "https://your-domain.com/api/upbit/candles?symbol=KRW-BTC&interval=1"

   # TwelveData
   curl "https://your-domain.com/api/twelvedata/candles?symbol=005930&interval=1d"
   ```

## 향후 개선 사항

1. **알림 시스템**
   - 실패율이 높을 때 관리자에게 알림
   - Slack, Discord 웹훅 연동

2. **대시보드**
   - 실시간 업데이트 상태 모니터링
   - 실패한 종목 목록 및 재시도 버튼

3. **스마트 재시도**
   - 실패 원인 분석
   - 원인별 다른 재시도 전략 적용

4. **성능 개선**
   - 병렬 처리 도입 (Rate Limit 고려)
   - Redis 캐싱 활용

## 관련 파일

- `/src/app/api/cron/update-previous-close/route.ts` - Cron 엔드포인트
- `/src/lib/cron/update-previous-close.ts` - 핵심 로직
- `/vercel.json` - Cron 스케줄 설정
- `/src/lib/api/daily-predictions.ts` - 데이터베이스 API

## 참고 자료

- [Vercel Cron Jobs 문서](https://vercel.com/docs/cron-jobs)
- [Cron 표현식 가이드](https://crontab.guru/)
- [시간대 변환 도구](https://www.worldtimebuddy.com/)
