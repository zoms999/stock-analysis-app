/**
 * 한국투자증권 KIS Developers API 유틸리티
 *
 * 공식 문서: https://apiportal.koreainvestment.com
 *
 * 환경변수 (DB system_config):
 *   KIS_APP_KEY       - 앱 키
 *   KIS_APP_SECRET    - 앱 시크릿
 *   KIS_IS_VIRTUAL    - "true"이면 모의투자
 */

import { getSystemConfig } from '../config-helper';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ─────────────────────────────────────────────────────────────
// 1. 기본 설정 (동적 로딩)
// ─────────────────────────────────────────────────────────────

interface KisConfig {
  appKey: string;
  appSecret: string;
  isVirtual: boolean;
  restBase: string;
  wsBase: string;
}

/**
 * KIS 설정 로드
 */
async function getKisConfig(): Promise<KisConfig> {
  const appKey = await getSystemConfig('KIS_APP_KEY');
  const appSecret = await getSystemConfig('KIS_APP_SECRET');
  const isVirtualStr = await getSystemConfig('KIS_IS_VIRTUAL');
  const isVirtual = isVirtualStr === 'true';

  if (!appKey || !appSecret) {
    throw new Error("KIS_APP_KEY 또는 KIS_APP_SECRET 시스템 설정이 없습니다.");
  }

  return {
    appKey,
    appSecret,
    isVirtual,
    restBase: isVirtual
      ? "https://openapivts.koreainvestment.com:29443" // 모의투자
      : "https://openapi.koreainvestment.com:9443", // 실전투자
    wsBase: isVirtual
      ? "ws://ops.koreainvestment.com:31000" // 모의투자 WS
      : "ws://ops.koreainvestment.com:21000", // 실전투자 WS
  };
}

// ─────────────────────────────────────────────────────────────
// 2. 접근 토큰 관리 (OAuth)
// ─────────────────────────────────────────────────────────────

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let tokenCache: TokenCache | null = null;
let tokenRequestPromise: Promise<string> | null = null;

/**
 * 접근 토큰 발급 (POST /oauth2/tokenP)
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();

  // 1. 메모리 캐시 체크
  if (tokenCache && tokenCache.expiresAt - 5 * 60 * 1000 > now) {
    return tokenCache.accessToken;
  }

  // 2. 진행 중인 요청이 있다면 기다림 (Race Condition 방지)
  if (tokenRequestPromise) {
    return tokenRequestPromise;
  }

  // 3. 파일 캐시 확인 (최초 1회만, 혹은 메모리에 없을 때만)
  try {
    const tmpDir = os.tmpdir();
    const cachePath = path.join(tmpDir, 'kis_token_cache.json');
    if (fs.existsSync(cachePath)) {
      const fileData = fs.readFileSync(cachePath, 'utf8');
      const loadedCache = JSON.parse(fileData) as TokenCache;

      if (loadedCache.expiresAt - 5 * 60 * 1000 > now) {
        console.log('[KIS API] Loaded token from disk cache');
        tokenCache = loadedCache;
        return loadedCache.accessToken;
      }
    }
  } catch (err) {
    console.warn('[KIS API] Failed to load token from disk:', err);
  }

  // 4. 실제로 토큰 발급 요청 (Singleton Promise 시작)
  tokenRequestPromise = (async () => {
    try {
      const { appKey, appSecret, restBase, isVirtual } = await getKisConfig();

      console.log(`[KIS API] Token Request - Mode: ${isVirtual ? "Virtual (모의투자)" : "Real (실전투자)"}, Base: ${restBase}`);

      const res = await fetch(`${restBase}/oauth2/tokenP`, {
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
      const accessToken = data.access_token as string;
      const expiresIn = (data.expires_in as number) ?? 86400; // 초 단위

      tokenCache = {
        accessToken,
        expiresAt: Date.now() + expiresIn * 1000,
      };

      // 파일에 캐시 저장
      try {
        const tmpDir = os.tmpdir();
        const cachePath = path.join(tmpDir, 'kis_token_cache.json');
        fs.writeFileSync(cachePath, JSON.stringify(tokenCache), 'utf8');
        console.log('[KIS API] Token saved to disk cache');
      } catch (err) {
        console.warn('[KIS API] Failed to save token to disk:', err);
      }

      return accessToken;
    } finally {
      // 요청이 끝나면 (성공이든 실패든) Promise 초기화하여 재시도 가능하게 함
      tokenRequestPromise = null;
    }
  })();

  return tokenRequestPromise;
}

// ─────────────────────────────────────────────────────────────
// 3. WebSocket 접속키 발급 (POST /oauth2/Approval)
// ─────────────────────────────────────────────────────────────

interface ApprovalCache {
  approvalKey: string;
  expiresAt: number;
  wsBase: string; // 접속키 발급 시 사용된 Base URL 저장 (환경 변경 대응)
}

let approvalCache: ApprovalCache | null = null;

/**
 * WebSocket 접속키 발급
 * 반환값: { approvalKey, wsBase }
 * 주의: 환경이 바뀌면 키도 다시 받아야 하므로 wsBase도 함께 리턴하거나 확인해야 함.
 */
export async function getApprovalKey(): Promise<{ approvalKey: string; wsBase: string }> {
  const now = Date.now();
  const config = await getKisConfig();

  // 캐시된 키가 유효하고, 환경(Base URL)이 동일하면 재사용
  if (
    approvalCache &&
    approvalCache.expiresAt - 5 * 60 * 1000 > now &&
    approvalCache.wsBase === config.wsBase
  ) {
    return { approvalKey: approvalCache.approvalKey, wsBase: config.wsBase };
  }

  const { appKey, appSecret, restBase, wsBase } = config;

  const res = await fetch(`${restBase}/oauth2/Approval`, {
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
  const approvalKey = data.approval_key as string;

  approvalCache = {
    approvalKey,
    expiresAt: now + 24 * 60 * 60 * 1000, // 24시간
    wsBase,
  };

  return { approvalKey, wsBase };
}

// ─────────────────────────────────────────────────────────────
// 4. 실시간 시세 TR 코드 (국내주식)
// ─────────────────────────────────────────────────────────────

export const KIS_TR_CODES = {
  /** 국내주식 실시간 체결가 */
  KR_EXEC: "H0STCNT0",
  /** 국내주식 실시간 호가 */
  KR_ORDERBOOK: "H0STASP0",
} as const;

// ─────────────────────────────────────────────────────────────
// 5. WebSocket 메시지 빌더
// ─────────────────────────────────────────────────────────────

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

export function parseRealtimePrice(raw: string): KisRealtimePrice | null {
  try {
    if (raw.startsWith("{")) return null;

    const parts = raw.split("|");
    if (parts.length < 4) return null;

    const trId = parts[1];
    if (trId !== KIS_TR_CODES.KR_EXEC) return null;

    const dataStr = parts[3];
    const fields = dataStr.split("^");

    if (fields.length < 14) return null;

    const symbol = fields[0];
    const timestamp = fields[1];
    const price = parseFloat(fields[2]) || 0;
    const changeSign = fields[3];
    const changeAbs = parseFloat(fields[4]) || 0;
    const changeRate = parseFloat(fields[5]) || 0;
    const volume = parseInt(fields[13], 10) || 0;
    const tradeType = fields[21];

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

export function normalizeKrxSymbol(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  // Prefix: KRX:005930
  const mPrefix = s.match(/^(?:X?KRX)\s*:\s*(\d{6})$/);
  if (mPrefix) return mPrefix[1];
  
  // Suffix: 005930:KRX
  const mSuffix = s.match(/^(\d{6})\s*:\s*(?:X?KRX)$/);
  if (mSuffix) return mSuffix[1];
  
  // Pure digits: 005930
  if (/^\d{6}$/.test(s)) return s;
  
  return null;
}

export function isKrxSymbol(raw: string): boolean {
  return normalizeKrxSymbol(raw) !== null;
}

// ─────────────────────────────────────────────────────────────
// 8. 과거 캔들 데이터 조회 (REST)
// ─────────────────────────────────────────────────────────────

export interface CandleData {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export async function fetchKisCandles(symbol: string, interval: string): Promise<CandleData[]> {
  const code = normalizeKrxSymbol(symbol);
  if (!code) throw new Error(`유효하지 않은 국내주식 종목코드입니다: ${symbol}`);

  const accessToken = await getAccessToken();
  const { appKey, appSecret, restBase } = await getKisConfig();

  // 일/주/월 vs 분봉 구분
  const isMinute = ["1m", "5m", "15m", "30m", "1h"].includes(interval);
  
  const trId = isMinute ? "FHKST03010200" : "FHKST03010100";
  
  const url = new URL(`${restBase}/uapi/domestic-stock/v1/quotations/${isMinute ? "inquire-time-itemchartprice" : "inquire-daily-itemchartprice"}`);
  
  if (isMinute) {
    url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
    url.searchParams.set("FID_INPUT_ISCD", code);
    url.searchParams.set("FID_INPUT_HOUR_1", ""); 
    url.searchParams.set("FID_PW_RESV_RT_1", "");
    url.searchParams.set("FID_ETC_CLS_CODE", "");
  } else {
    url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
    url.searchParams.set("FID_INPUT_ISCD", code);
    url.searchParams.set("FID_PERIOD_DIV_CODE", interval === "1wk" ? "W" : interval === "1mo" ? "M" : "D");
    url.searchParams.set("FID_ORG_ADJ_PRC", "0"); 
    
    // 19800104 ~ 현재
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    url.searchParams.set("FID_INPUT_DATE_1", "19800104"); 
    url.searchParams.set("FID_INPUT_DATE_2", today);
  }

  const res = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "authorization": `Bearer ${accessToken}`,
      "appkey": appKey,
      "appsecret": appSecret,
      "tr_id": trId,
      "custtype": "P",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[KIS API] HTTP Error: ${res.status}`, text);
    throw new Error(`KIS API Error: ${res.status} ${text}`);
  }

  const data = await res.json();
  
  if (data.rt_cd !== "0") {
    console.error(`[KIS API] Business Error: ${data.msg_cd}`, data.msg1);
    throw new Error(`KIS API Error: ${data.msg_cd} ${data.msg1}`);
  }

  const output = data.output2 || data.output;
  
  if (!Array.isArray(output)) {
    return [];
  }

  return output.map((item: any) => {
    if (isMinute) {
      const yymmdd = item.stck_bsop_date || new Date().toISOString().split("T")[0].replace(/-/g, "");
      const hhmmss = item.stck_cntg_hour;
      const dateStr = `${yymmdd.slice(0, 4)}-${yymmdd.slice(4, 6)}-${yymmdd.slice(6, 8)} ${hhmmss.slice(0, 2)}:${hhmmss.slice(2, 4)}:${hhmmss.slice(4, 6)}`;
      const timestamp = Math.floor(new Date(dateStr).getTime() / 1000);

      return {
        time: timestamp,
        open: parseFloat(item.stck_oprc),
        high: parseFloat(item.stck_hgpr),
        low: parseFloat(item.stck_lwpr),
        close: parseFloat(item.stck_prpr),
        volume: parseFloat(item.cntg_vol),
      };
    } else {
      const date = item.stck_bsop_date;
      const dateStr = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
      
      return {
        time: dateStr,
        open: parseFloat(item.stck_oprc),
        high: parseFloat(item.stck_hgpr),
        low: parseFloat(item.stck_lwpr),
        close: parseFloat(item.stck_clpr),
        volume: parseFloat(item.acml_vol),
      };
    }
  }).sort((a, b) => {
    if (typeof a.time === "string" && typeof b.time === "string") return a.time.localeCompare(b.time);
    return (a.time as number) - (b.time as number);
  });
}

/**
 * 현재가 조회 (1분봉 기준 최신가)
 */
/**
 * 현재가 조회 (1분봉 기준 최신가 -> 실패 시 일봉 기준 종가)
 */
export async function fetchKisPrice(symbol: string): Promise<number | null> {
  try {
    // 1. Try 1-minute candles first
    let candles = await fetchKisCandles(symbol, "1m");
    
    // 2. If no minute data (e.g., market closed, weekend, or too early), fallback to daily
    if (!candles || candles.length === 0) {
        // console.log(`[KIS API] No minute data for ${symbol}, trying daily fallback.`);
        candles = await fetchKisCandles(symbol, "1d");
    }

    if (!candles || candles.length === 0) return null;

    // 가장 최근 캔들의 종가 반환
    const latest = candles[candles.length - 1];
    return latest.close;
  } catch (e: any) {
    console.error(`[KIS API] Failed to fetch price for ${symbol}: ${e.message}`);
    return null;
  }
}










