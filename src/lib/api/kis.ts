/**
 * 한국투자증권 KIS Developers API 유틸리티
 *
 * 공식 문서: https://apiportal.koreainvestment.com
 *
 * 환경변수 (.env.local):
 *   KIS_APP_KEY       - 앱 키 (KIS Developers에서 발급)
 *   KIS_APP_SECRET    - 앱 시크릿
 *   KIS_ACCOUNT_NO    - 계좌번호 (선택, 주문 시 필요)
 *   KIS_HTS_ID        - HTS ID (선택)
 *   KIS_IS_VIRTUAL    - "true"이면 모의투자, 기본값 false (실전)
 */

// ─────────────────────────────────────────────────────────────
// 1. 기본 설정
// ─────────────────────────────────────────────────────────────

const IS_VIRTUAL = process.env.KIS_IS_VIRTUAL === "true";

/** REST API 베이스 URL */
export const KIS_REST_BASE = IS_VIRTUAL
  ? "https://openapivts.koreainvestment.com:29443" // 모의투자
  : "https://openapi.koreainvestment.com:9443"; // 실전투자

/** WebSocket 베이스 URL */
export const KIS_WS_BASE = IS_VIRTUAL
  ? "ws://ops.koreainvestment.com:31000" // 모의투자 WS
  : "ws://ops.koreainvestment.com:21000"; // 실전투자 WS

// ─────────────────────────────────────────────────────────────
// 2. 접근 토큰 관리 (OAuth)
// ─────────────────────────────────────────────────────────────

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let tokenCache: TokenCache | null = null;

/**
 * 접근 토큰 발급 (POST /oauth2/tokenP)
 * - 토큰 유효시간: 24시간 (문서 기준)
 * - 캐싱하여 만료 전까지 재사용
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();

  // 캐시된 토큰이 아직 유효하면 재사용 (만료 5분 전 갱신)
  if (tokenCache && tokenCache.expiresAt - 5 * 60 * 1000 > now) {
    return tokenCache.accessToken;
  }

  const appKey = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;

  if (!appKey || !appSecret) {
    throw new Error("KIS_APP_KEY 또는 KIS_APP_SECRET 환경변수가 설정되지 않았습니다.");
  }

  const res = await fetch(`${KIS_REST_BASE}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: appKey,
      appsecret: appSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KIS 토큰 발급 실패: ${res.status} ${text}`);
  }

  const data = await res.json();
  /*
    응답 예시:
    {
      "access_token": "...",
      "token_type": "Bearer",
      "expires_in": 86400
    }
  */

  const accessToken = data.access_token as string;
  const expiresIn = (data.expires_in as number) ?? 86400; // 초 단위

  tokenCache = {
    accessToken,
    expiresAt: now + expiresIn * 1000,
  };

  return accessToken;
}

// ─────────────────────────────────────────────────────────────
// 3. WebSocket 접속키 발급 (POST /oauth2/Approval)
// ─────────────────────────────────────────────────────────────

interface ApprovalCache {
  approvalKey: string;
  expiresAt: number;
}

let approvalCache: ApprovalCache | null = null;

/**
 * WebSocket 접속키 발급 (POST /oauth2/Approval)
 * - WebSocket 연결 시 필요한 approval_key 발급
 * - 유효시간: 24시간
 */
export async function getApprovalKey(): Promise<string> {
  const now = Date.now();

  // 캐시된 키가 아직 유효하면 재사용 (만료 5분 전 갱신)
  if (approvalCache && approvalCache.expiresAt - 5 * 60 * 1000 > now) {
    return approvalCache.approvalKey;
  }

  const appKey = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;

  if (!appKey || !appSecret) {
    throw new Error("KIS_APP_KEY 또는 KIS_APP_SECRET 환경변수가 설정되지 않았습니다.");
  }

  const res = await fetch(`${KIS_REST_BASE}/oauth2/Approval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: appKey,
      secretkey: appSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KIS WebSocket 접속키 발급 실패: ${res.status} ${text}`);
  }

  const data = await res.json();
  /*
    응답 예시:
    {
      "approval_key": "..."
    }
  */

  const approvalKey = data.approval_key as string;

  approvalCache = {
    approvalKey,
    expiresAt: now + 24 * 60 * 60 * 1000, // 24시간
  };

  return approvalKey;
}

// ─────────────────────────────────────────────────────────────
// 4. 실시간 시세 TR 코드 (국내주식)
// ─────────────────────────────────────────────────────────────

/**
 * 국내주식 실시간 TR 코드
 * - H0STCNT0: 실시간 체결가 (실시간-003)
 * - H0STASP0: 실시간 호가 (실시간-004)
 */
export const KIS_TR_CODES = {
  /** 국내주식 실시간 체결가 */
  KR_EXEC: "H0STCNT0",
  /** 국내주식 실시간 호가 */
  KR_ORDERBOOK: "H0STASP0",
} as const;

// ─────────────────────────────────────────────────────────────
// 5. WebSocket 메시지 빌더
// ─────────────────────────────────────────────────────────────

/**
 * 실시간 시세 구독/해제 메시지 생성
 *
 * @param approvalKey - WebSocket 접속키
 * @param trId - TR 코드 (예: H0STCNT0)
 * @param trKey - 종목코드 (예: 005930)
 * @param trType - "1" 등록, "2" 해제
 */
export function buildSubscribeMessage(
  approvalKey: string,
  trId: string,
  trKey: string,
  trType: "1" | "2" = "1"
): string {
  return JSON.stringify({
    header: {
      approval_key: approvalKey,
      custtype: "P", // 개인
      tr_type: trType,
      "content-type": "utf-8",
    },
    body: {
      input: {
        tr_id: trId,
        tr_key: trKey,
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────
// 6. 실시간 체결가 데이터 파싱
// ─────────────────────────────────────────────────────────────

/**
 * 국내주식 실시간 체결가 (H0STCNT0) 데이터 파싱
 *
 * 수신 데이터 형식: "0|H0STCNT0|001|005930^..."
 * - 첫 번째 필드: 암호화 여부 (0: 평문)
 * - 두 번째 필드: TR ID
 * - 세 번째 필드: 데이터 건수
 * - 네 번째 필드: 실제 데이터 (^ 구분)
 */
export interface KisRealtimePrice {
  symbol: string; // 종목코드
  name?: string; // 종목명
  price: number; // 현재가
  change: number; // 전일대비
  changeRate: number; // 등락률 (%)
  volume: number; // 거래량
  timestamp: string; // 체결시간 (HHmmss)
  tradeType?: string; // 체결구분 (1: 매도, 2: 매수 등)
}

/**
 * 실시간 체결가 메시지 파싱
 * @param raw - 수신된 원본 메시지
 */
export function parseRealtimePrice(raw: string): KisRealtimePrice | null {
  try {
    // JSON 형식 응답 (구독 확인 등)
    if (raw.startsWith("{")) {
      return null;
    }

    // 파이프(|) 구분 데이터
    const parts = raw.split("|");
    if (parts.length < 4) return null;

    const trId = parts[1];
    if (trId !== KIS_TR_CODES.KR_EXEC) return null;

    // 실제 데이터는 ^ 구분
    const dataStr = parts[3];
    const fields = dataStr.split("^");

    /*
      H0STCNT0 필드 순서 (공식 문서 기준, 0-indexed):
      0: 유가증권단축종목코드
      1: 주식체결시간
      2: 주식현재가
      3: 전일대비부호
      4: 전일대비
      5: 전일대비율
      6: 가중평균주식가격
      7: 주식시가
      8: 주식최고가
      9: 주식최저가
      10: 매도호가1
      11: 매수호가1
      12: 체결거래량
      13: 누적거래량
      14: 누적거래대금
      15: 매도체결건수
      16: 매수체결건수
      17: 순매수체결건수
      18: 체결강도
      19: 총매도수량
      20: 총매수수량
      21: 체결구분
      22: 매수비율
      23: 전일거래량대비등락율
      24: 시가시간
      25: 시가대비구분
      26: 시가대비
      27: 최고가시간
      28: 고가대비구분
      29: 고가대비
      30: 최저가시간
      31: 저가대비구분
      32: 저가대비
      33: 영업일자
      34: 신장운영구분코드
      35: 거래정지여부
      36: 매도호가잔량
      37: 매수호가잔량
      38: 총매도호가잔량
      39: 총매수호가잔량
      40: 거래량회전율
      41: 전일동시간누적거래량
      42: 전일동시간누적거래량비율
      43: 시간구분코드
      44: 임의종료구분코드
      45: 정적VI발동기준가
    */

    if (fields.length < 14) return null;

    const symbol = fields[0];
    const timestamp = fields[1]; // HHmmss
    const price = parseFloat(fields[2]) || 0;
    const changeSign = fields[3]; // 1:상한, 2:상승, 3:보합, 4:하한, 5:하락
    const changeAbs = parseFloat(fields[4]) || 0;
    const changeRate = parseFloat(fields[5]) || 0;
    const volume = parseInt(fields[13], 10) || 0;
    const tradeType = fields[21];

    // 부호 적용
    let change = changeAbs;
    if (changeSign === "4" || changeSign === "5") {
      change = -changeAbs;
    }

    return {
      symbol,
      price,
      change,
      changeRate,
      volume,
      timestamp,
      tradeType,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 7. 유틸리티
// ─────────────────────────────────────────────────────────────

/**
 * 종목코드 정규화 (6자리 숫자)
 * - "005930" → "005930"
 * - "KRX:005930" → "005930"
 * - "삼성전자" → null (종목명은 별도 조회 필요)
 */
export function normalizeKrxSymbol(raw: string): string | null {
  const s = raw.trim().toUpperCase();

  // KRX:005930 / XKRX:005930 형태
  const mKrx = s.match(/^(?:X?KRX)\s*:\s*(\d{6})$/);
  if (mKrx) return mKrx[1];

  // 순수 6자리 숫자
  if (/^\d{6}$/.test(s)) return s;

  return null;
}

/**
 * 국내주식 종목인지 판별
 */
export function isKrxSymbol(raw: string): boolean {
  return normalizeKrxSymbol(raw) !== null;
}


