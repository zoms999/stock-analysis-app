# 실시간 동기화 확인 가이드

실시간 주식 데이터가 제대로 동기화되고 있는지 확인하는 방법을 안내합니다.

## 🔍 확인 방법

### 1. 브라우저 개발자 도구로 확인

#### Step 1: 개발자 도구 열기
- **Chrome/Edge**: `F12` 또는 `Ctrl + Shift + I` (Mac: `Cmd + Option + I`)
- **Firefox**: `F12` 또는 `Ctrl + Shift + I`

#### Step 2: Network 탭 확인
1. 개발자 도구에서 **Network** 탭 클릭
2. 필터에서 **EventStream** 또는 **SSE** 선택
3. 페이지 새로고침 (`F5`)

**확인할 항목:**
- `/api/stream` 또는 `/api/twelvedata/stream` 요청이 보이는지
- 상태가 **Pending** 또는 **200 OK**인지
- **Type**이 `eventsource`인지

#### Step 3: EventStream 메시지 확인
1. `/api/stream` 요청 클릭
2. **EventStream** 탭 클릭
3. 실시간으로 들어오는 메시지 확인:
   ```
   event: status
   data: {"event":"connected","krxSymbols":[],"globalSymbols":["BTC-USD"]}
   
   event: price
   data: {"symbol":"BTC-USD","price":97542.5,"change":2341.2,"change_percent":2.46}
   ```

**정상 작동 시:**
- `event: status` 메시지가 먼저 들어옴 (연결 확인)
- `event: price` 메시지가 주기적으로 들어옴 (가격 업데이트)
- Keep-alive 메시지가 15초마다 들어옴 (`: keep-alive ...`)

### 2. Console 탭에서 확인

#### 실시간 로그 추가 (개발용)

브라우저 콘솔에서 다음 코드를 실행하여 실시간 가격 업데이트를 확인할 수 있습니다:

```javascript
// 실시간 스트림 연결 확인
const checkStream = () => {
  const symbols = ['BTC-USD', 'AAPL']; // 확인할 심볼
  const url = `/api/stream?symbols=${symbols.join(',')}`;
  const es = new EventSource(url);
  
  let priceCount = 0;
  let lastUpdate = Date.now();
  
  es.addEventListener('status', (e) => {
    const data = JSON.parse(e.data);
    console.log('📡 스트림 상태:', data);
  });
  
  es.addEventListener('price', (e) => {
    const data = JSON.parse(e.data);
    priceCount++;
    const now = Date.now();
    const delay = now - lastUpdate;
    lastUpdate = now;
    
    console.log(`💰 가격 업데이트 #${priceCount}:`, {
      symbol: data.symbol,
      price: data.price,
      change: data.change_percent + '%',
      provider: data.provider,
      업데이트_간격: delay + 'ms',
      시간: new Date().toLocaleTimeString()
    });
  });
  
  es.addEventListener('error', (e) => {
    console.error('❌ 스트림 오류:', e);
  });
  
  // 30초 후 자동 종료
  setTimeout(() => {
    es.close();
    console.log(`✅ 테스트 완료. 총 ${priceCount}개의 가격 업데이트 수신`);
  }, 30000);
  
  return es;
};

// 실행
const stream = checkStream();
```

**예상 출력:**
```
📡 스트림 상태: {event: "connected", globalSymbols: ["BTC-USD", "AAPL"]}
💰 가격 업데이트 #1: {symbol: "BTC-USD", price: 97542.5, change: "2.46%", ...}
💰 가격 업데이트 #2: {symbol: "AAPL", price: 185.23, change: "0.85%", ...}
```

### 3. UI에서 직접 확인

#### 메인 페이지에서 확인
1. 메인 페이지 (`/`) 접속
2. 게시글 카드의 **현재가** 또는 **수익률** 숫자 관찰
3. 가격이 변동될 때마다 숫자가 자동으로 업데이트되는지 확인

**확인 포인트:**
- ✅ 가격이 몇 초 내에 변경됨
- ✅ 수익률(%)이 실시간으로 재계산됨
- ✅ 차트의 마지막 캔들이 업데이트됨

#### 차트 페이지에서 확인
1. 분석 페이지 (`/analyze`) 접속
2. 상단의 **현재가** 표시 관찰
3. 가격이 실시간으로 변경되는지 확인

### 4. 코드에 디버깅 로그 추가

개발 중에 더 자세한 로그를 보고 싶다면 코드에 로그를 추가할 수 있습니다:

#### ChartBoardList에 로그 추가

`src/components/home/ChartBoardList.tsx` 파일의 221줄 근처:

```typescript
streamRef.current = subscribeTwelveDataPrices(symbolsToStream, (msg) => {
  const p = Number(msg.price);
  if (!Number.isFinite(p)) return;
  
  // 🔍 디버깅 로그 추가
  console.log('[실시간 가격]', {
    symbol: msg.symbol,
    price: p,
    timestamp: new Date().toISOString(),
    interval: Date.now() - (window.lastPriceUpdate || Date.now())
  });
  window.lastPriceUpdate = Date.now();
  
  priceRef.current.set(msg.symbol, p);
  // ... 나머지 코드
});
```

#### API 라우트에 로그 추가

`src/app/api/stream/route.ts` 파일에 로그 추가:

```typescript
wsTwelve.on("message", (buf) => {
  const raw = typeof buf === "string" ? buf : buf.toString("utf-8");
  try {
    const msg = JSON.parse(raw);
    if (msg.event === "price") {
      // 🔍 서버 사이드 로그
      console.log('[서버] 실시간 가격 수신:', {
        symbol: msg.symbol,
        price: msg.price,
        timestamp: new Date().toISOString()
      });
    }
    // ... 나머지 코드
  } catch {
    // ...
  }
});
```

### 5. 네트워크 상태 확인

#### 연결 상태 확인
- **온라인 상태**: 인터넷 연결이 정상인지 확인
- **방화벽**: WebSocket 연결이 차단되지 않았는지 확인
- **프록시**: 회사 네트워크 등에서 프록시 설정 확인

#### API 키 확인
- TwelveData API 키가 유효한지 확인
- KIS API 키가 유효한지 확인 (국내주식 사용 시)
- API 사용량 제한에 도달하지 않았는지 확인

### 6. 성능 모니터링

#### 업데이트 빈도 확인
정상 작동 시:
- **암호화폐**: 매우 활발한 거래 시 초당 여러 번 업데이트 가능
- **주식**: 거래 시간 중 가격 변동 시 즉시 업데이트
- **Keep-alive**: 15초마다 연결 유지 메시지

#### 지연 시간 확인
- 브라우저 → 서버: 일반적으로 < 100ms
- 서버 → 데이터 소스: 일반적으로 < 500ms
- 전체 지연: 일반적으로 < 1초

### 7. 문제 해결

#### 실시간 업데이트가 안 될 때

1. **콘솔 에러 확인**
   ```
   - Network 탭에서 요청이 실패했는지 확인
   - Console 탭에서 에러 메시지 확인
   ```

2. **연결 상태 확인**
   ```javascript
   // 콘솔에서 실행
   const es = new EventSource('/api/stream?symbols=BTC-USD');
   es.onerror = (e) => console.error('연결 오류:', e);
   es.onopen = () => console.log('연결 성공');
   ```

3. **API 키 확인**
   - 환경 변수가 올바르게 설정되었는지 확인
   - API 키가 만료되지 않았는지 확인

4. **서버 로그 확인**
   - Vercel 로그 또는 서버 콘솔에서 에러 확인
   - WebSocket 연결 오류 확인

#### 업데이트가 느릴 때

1. **네트워크 속도 확인**
   - 인터넷 연결 속도 테스트
   - VPN 사용 중이면 비활성화 후 테스트

2. **브라우저 성능 확인**
   - 다른 탭에서 무거운 작업이 실행 중인지 확인
   - 브라우저 확장 프로그램 비활성화 후 테스트

3. **데이터 소스 확인**
   - TwelveData/KIS 서버 상태 확인
   - API 사용량 제한 확인

## 📊 체크리스트

실시간 동기화가 정상 작동하는지 확인하는 체크리스트:

- [ ] Network 탭에서 `/api/stream` 요청이 보임
- [ ] EventStream 탭에서 `event: status` 메시지 수신
- [ ] EventStream 탭에서 `event: price` 메시지가 주기적으로 수신
- [ ] Keep-alive 메시지가 15초마다 수신됨
- [ ] UI에서 가격이 실시간으로 업데이트됨
- [ ] 콘솔에 에러 메시지가 없음
- [ ] 네트워크 연결이 안정적임

## 🎯 빠른 테스트

가장 빠르게 확인하는 방법:

1. 메인 페이지 접속
2. `F12` → Network 탭 → EventStream 필터
3. `/api/stream` 요청 찾기
4. EventStream 탭에서 실시간 메시지 확인
5. UI에서 가격이 변경되는지 관찰

**정상 작동 시:**
- EventStream에 메시지가 계속 들어옴
- UI의 가격이 자동으로 업데이트됨
- 에러 메시지가 없음

## 📝 참고사항

- **개발 환경**: `localhost:3000`에서도 동일하게 작동합니다
- **프로덕션**: Vercel 등에서도 동일하게 작동합니다
- **모바일**: 모바일 브라우저에서도 개발자 도구로 확인 가능합니다 (Chrome Remote Debugging 사용)

## 🔧 고급 디버깅

더 자세한 디버깅이 필요하다면:

1. **서버 사이드 로깅 활성화**
   - `src/app/api/stream/route.ts`에 상세 로그 추가
   - Vercel 로그에서 확인

2. **클라이언트 사이드 모니터링**
   - React DevTools로 컴포넌트 상태 확인
   - Redux DevTools (사용 중인 경우)

3. **네트워크 분석**
   - Chrome DevTools의 Performance 탭
   - Network 탭의 Waterfall 뷰

