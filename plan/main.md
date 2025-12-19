제공해주신 스키마와 데이터를 바탕으로 요청하신 다양한 기준의 정렬 쿼리를 작성했습니다.

**중요 전제 조건:**
1.  **정확도(Accuracy)**를 계산하기 위해서는 **'예측값'**(`chart_config` 내의 JSON 데이터)과 **'실제 시장가'**를 비교해야 합니다.
2.  현재 스키마에는 '실제 시장가' 테이블이 없으므로, **`market_prices`라는 가상의 가격 테이블이 있다고 가정**하거나, 혹은 현재가(Current Price)를 외부에서 주입받아 비교하는 형태의 로직으로 작성했습니다.
3.  PostgreSQL의 `JSONB` 기능을 활용하여 `chart_config` 내부의 데이터를 추출하여 정렬합니다.

---

### 1. 기초 정렬 쿼리 (분석 빈도, 최신순, 상태 등)

이 쿼리들은 현재 테이블 구조만으로 즉시 실행 가능합니다.

#### 1-1. 많이 분석한 종목 순 (Most Analyzed Ticker)
가장 인기가 많은 종목(Ticker) 순서대로 정렬합니다.
```sql
SELECT 
    ticker_symbol, 
    COUNT(*) as analysis_count,
    MAX(created_at) as last_analyzed_at
FROM public.posts
GROUP BY ticker_symbol
ORDER BY analysis_count DESC, last_analyzed_at DESC;
```

#### 1-2. 최신 분석 순 (Newest Analysis)
가장 최근에 작성된 글 순서입니다.
```sql
SELECT * 
FROM public.posts
ORDER BY created_at DESC;
```

#### 1-3. 분석 완료 순 (Analysis Completed)
예측 상태가 완료된 것(예: `FINISHED` 또는 `COMPLETED` 등 상태값 가정)을 우선으로 봅니다.
```sql
SELECT * 
FROM public.posts
ORDER BY 
    CASE WHEN prediction_status = 'FINISHED' THEN 1 
         WHEN prediction_status = 'WAITING' THEN 2 
         ELSE 3 END,
    created_at DESC;
```

---

### 2. 정확도 분석 및 기간별 예측 추출 쿼리 (고급)

JSONB 데이터(`chart_config`)에 들어있는 시계열 데이터를 풀어서, **작성일 기준 N일 뒤의 예측값**을 추출하고 정확도를 계산하는 쿼리입니다.

**※ 참고:** 정확도 계산을 위해 `actual_price`(실제 가격)가 필요합니다. 아래 쿼리는 **'예측값 추출'**에 초점을 맞추었으며, 실제 가격 테이블(`market_prices` 가정)과 조인하여 오차율을 계산하는 로직을 포함했습니다.

#### 공통 CTE (JSON 데이터 펼치기)
먼저 각 포스트의 예측 포인트를 사용하기 좋게 펼치는 가상 테이블(CTE)을 정의합니다.

```sql
WITH PredictionPoints AS (
    -- 1. JSONB 배열을 행(Row)으로 펼치고 시간 차이를 계산
    SELECT 
        p.id AS post_id,
        p.ticker_symbol,
        p.created_at,
        TO_TIMESTAMP((point->>'time')::double precision) AS predicted_at,
        (point->>'value')::numeric AS predicted_price,
        -- 작성일로부터 경과한 일수 계산 (정수형)
        EXTRACT(DAY FROM (TO_TIMESTAMP((point->>'time')::double precision) - p.created_at))::int AS days_elapsed
    FROM 
        public.posts p,
        jsonb_array_elements(p.chart_config -> 'prediction_points') AS point
)
```

#### 2-1. 정확도 1일 / 5일 / 10일 순 (Accuracy by Timeframe)
위의 CTE를 활용하여 각 기간별(1일, 5일, 10일) 예측값과 오차율을 구하는 쿼리입니다.
*(가정: `public.market_prices` 테이블에 `ticker`, `recorded_at`, `close_price`가 있다고 가정)*

```sql
WITH TargetPredictions AS (
    SELECT 
        p.id AS post_id,
        p.title,
        p.ticker_symbol,
        p.created_at,
        elem.predicted_price,
        elem.days_elapsed,
        -- 1일, 5일, 10일 중 가장 근사한 데이터 필터링을 위한 순위 매기기
        ROW_NUMBER() OVER (PARTITION BY p.id, elem.days_elapsed ORDER BY elem.predicted_at ASC) as rn
    FROM 
        public.posts p
    CROSS JOIN LATERAL (
        SELECT 
            TO_TIMESTAMP((point->>'time')::double precision) AS predicted_at,
            (point->>'value')::numeric AS predicted_price,
            ROUND(EXTRACT(EPOCH FROM (TO_TIMESTAMP((point->>'time')::double precision) - p.created_at)) / 86400) AS days_elapsed
        FROM jsonb_array_elements(p.chart_config -> 'prediction_points') AS point
    ) elem
    WHERE elem.days_elapsed IN (1, 5, 10) -- 원하는 날짜(1, 5, 10일)
)
SELECT 
    tp.post_id,
    tp.title,
    tp.ticker_symbol,
    tp.days_elapsed || '일차 예측' as type,
    tp.predicted_price,
    mp.close_price as actual_price,
    -- 정확도 계산: (1 - |예측-실제|/실제) * 100
    ROUND(
        (1 - ABS(tp.predicted_price - mp.close_price) / mp.close_price) * 100, 
    2) as accuracy_score
FROM TargetPredictions tp
LEFT JOIN public.market_prices mp  -- !중요: 실제 가격 테이블 조인
    ON tp.ticker_symbol = mp.ticker 
    AND DATE(mp.recorded_at) = DATE(tp.created_at + (tp.days_elapsed || ' days')::interval)
WHERE tp.rn = 1 -- 각 일자별 하나의 포인트만 선택
ORDER BY 
    tp.days_elapsed ASC, -- 1일, 5일, 10일 순 그룹
    accuracy_score DESC NULLS LAST; -- 정확도 높은 순
```

#### 2-2. 전체 정확도 순 (Overall Accuracy)
특정 일자가 아니라, 예측한 모든 포인트의 평균 정확도가 높은 순서입니다.

```sql
SELECT 
    p.id,
    p.title,
    AVG(
        -- 개별 포인트의 정확도 로직 (실제 가격 테이블 필요)
        -- 실제 구현 시에는 실제 가격을 가져오는 함수나 테이블 조인이 필요합니다.
        -- 예시 로직: 100 - 오차율(%)
        100 - (ABS((point->>'value')::numeric - 90000) / 90000 * 100) -- 90000은 현재가 예시
    ) as avg_accuracy
FROM 
    public.posts p,
    jsonb_array_elements(p.chart_config -> 'prediction_points') AS point
GROUP BY p.id, p.title
ORDER BY avg_accuracy DESC;
```

#### 2-3. 최근 정확도 순 (Recent Accuracy)
"최근에 작성된 글 중에서 정확도가 높은 순" 또는 "최근 예측 포인트의 정확도가 높은 순"으로 해석됩니다. 아래는 **최근 30일 내 작성된 글 중 정확도 순**입니다.

```sql
SELECT 
    p.id,
    p.title,
    p.created_at,
    -- 정확도 계산 로직 (위와 동일한 예시)
    (100 - (ABS((p.chart_config->'prediction_points'->0->>'value')::numeric - 90000) / 90000 * 100)) as accuracy
FROM public.posts p
WHERE p.created_at >= NOW() - INTERVAL '30 days' -- 최근 30일
ORDER BY accuracy DESC;
```

### 요약 및 적용 팁
1.  **JSON 처리:** `chart_config -> 'prediction_points'`에 접근하기 위해 `jsonb_array_elements`를 사용했습니다.
2.  **실제 가격 데이터:** 정확도 정렬(1일/5일/10일/전체)을 위해서는 반드시 비교 대상인 **실제 가격(Actual Price)**이 있어야 합니다.
    *   DB 내에 `market_prices` 테이블을 구축하여 스케줄러로 가격을 쌓거나,
    *   어플리케이션 레벨에서 현재가를 가져와 쿼리의 파라미터로 넣어 계산해야 합니다.
3.  **인덱싱:** `posts(ticker_symbol)`, `posts(created_at)`에 인덱스가 걸려있으면 조회 속도가 빨라집니다. (현재 `idx_activity_logs...`만 보이므로 추가 권장)


-- 추가된 테이블  -- 
네, **정확도(Accuracy)**를 기준으로 정렬하거나 랭킹을 매기려면 **`market_prices` (실제 시세) 테이블은 필수**라고 보셔야 합니다.

그 이유와 **언제, 어떻게 저장해야 하는지** 정리해 드립니다.

---

### 1. 왜 필요한가요?
현재 DB에는 **"유저가 예측한 가격"**(`posts` 테이블)만 있고, 정답지인 **"실제 시장 가격"**이 없습니다.

*   **실시간 API로 해결 불가능:** 랭킹 페이지를 열 때마다 수천 개의 게시글에 대해 바이낸스나 업비트 API를 호출해서 채점하는 것은 불가능합니다. (속도 저하 + API 차단됨)
*   **DB 내부 비교:** SQL 쿼리로 "예측값 vs 실제값"을 계산해서 `ORDER BY`를 하려면, 두 값이 모두 DB 안에 있어야 합니다.

---

### 2. 테이블 생성 (SQL)
가장 단순하고 효율적인 구조입니다.

```sql
CREATE TABLE public.market_prices (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ticker_symbol varchar(50) NOT NULL, -- 예: 'BTC-USD'
    price numeric NOT NULL,             -- 당시 가격
    recorded_at timestamptz DEFAULT now(), -- 기록된 시간
    
    -- 조회 속도를 위해 인덱스 필수
    CONSTRAINT market_prices_unique_entry UNIQUE (ticker_symbol, recorded_at)
);

CREATE INDEX idx_market_prices_search ON public.market_prices (ticker_symbol, recorded_at DESC);
```

---

### 3. 언제 저장되나요? (저장 시점 및 방법)

이 테이블은 유저가 글을 쓸 때 저장되는 것이 아니라, **서버(백엔드)가 주기적으로 자동으로 저장**해야 합니다. 이를 **"스케줄러(Scheduler)"** 또는 **"크론 잡(Cron Job)"**이라고 부릅니다.

#### 시나리오 A: 1시간마다 저장 (가장 권장)
게시글의 차트 설정(`chart_config`)을 보니 `interval: "D"` (일봉) 기준인 것 같습니다. 하지만 정확한 채점을 위해 보통 **1시간 단위** 혹은 **4시간 단위**로 시세를 저장해두는 것이 좋습니다.

1.  **서버(Supabase Edge Function / Node.js 등)**가 매시 정각(00:00, 01:00...)에 깨어납니다.
2.  외부 API(CoinGecko, Binance 등)에서 현재 `BTC-USD`, `ETH-USD` 가격을 가져옵니다.
3.  `market_prices` 테이블에 `INSERT` 합니다.

#### 시나리오 B: 일봉 마감시 저장
매일 아침 9시(한국시간) 혹은 UTC 00:00에 한 번만 저장합니다. 데이터 양은 적지만, "장중 정확도"를 보여주기 어렵습니다.

---

### 4. 전체 시스템 흐름 (채점 로직)

정확도 순 쿼리를 "실시간"으로 돌리면 DB가 뻗을 수 있습니다. **"채점(Grading)"** 방식을 추천합니다.

1.  **데이터 수집:** 스케줄러가 매시간 `market_prices`에 실제 가격 저장.
2.  **채점 실행:** 
    *   스케줄러가 하루에 한 번(또는 매시간) `posts` 테이블을 돕니다.
    *   `prediction_date`가 지난 게시글을 찾습니다.
    *   `market_prices`에서 해당 날짜의 실제 가격을 가져와 오차율을 계산합니다.
3.  **결과 업데이트:** 
    *   계산된 정확도를 `posts` 테이블에 새로 만든 컬럼(`accuracy_score`)에 업데이트합니다.
4.  **조회(유저):** 
    *   복잡한 계산 없이 `SELECT * FROM posts ORDER BY accuracy_score DESC`만 하면 되므로 매우 빠릅니다.

### 요약
1.  **`market_prices` 테이블 만드세요.**
2.  **서버 스케줄러**를 통해 매 시간 혹은 매일 정해진 시간에 주요 코인/주식의 가격을 **자동으로 INSERT** 하세요.
3.  쿼리 성능을 위해, 실시간 계산보다는 **채점 결과를 `posts` 테이블에 업데이트**해두고 정렬하는 방식을 추천합니다.
