/**
 * 통합 실시간 스트림 API (TwelveData + KIS 겸용)
 *
 * 종목코드에 따라 자동으로 적절한 데이터 소스로 라우팅합니다:
 * - 국내주식 (6자리 숫자, KRX:XXXXXX): KIS Developers WebSocket
 * - 해외주식/암호화폐/외환: TwelveData WebSocket
 *
 * GET /api/stream?symbols=005930,AAPL,BTC-USD
 *
 * 혼합 요청 시 두 WebSocket을 동시에 연결하여 SSE로 통합 전달합니다.
 */

import { NextResponse } from "next/server";
import WebSocket from "ws";
import {
  getApprovalKey,
  KIS_TR_CODES,
  buildSubscribeMessage,
  parseRealtimePrice,
  normalizeKrxSymbol,
  isKrxSymbol,
} from "@/lib/api/kis";
import { getSystemConfig } from "@/lib/config-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────
// TwelveData 심볼 정규화 (기존 로직)
// ─────────────────────────────────────────────────────────────

const CRYPTO_BASE_TO_USD = new Set([
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "ADA",
  "DOGE",
  "DOT",
  "AVAX",
  "MATIC",
  "LINK",
  "BNB",
]);

function normalizeSymbolForTwelveWs(raw: string): string {
  const s = raw.trim();

  // BTC-USD / EUR-USD → BTC/USD / EUR/USD
  if (/^[A-Za-z0-9]+-[A-Za-z]{3,6}$/.test(s)) return s.replace("-", "/");

  // ETH (같은 단일 코인 티커) → ETH/USD
  if (/^[A-Za-z]{2,6}$/.test(s) && CRYPTO_BASE_TO_USD.has(s.toUpperCase())) {
    return `${s.toUpperCase()}/USD`;
  }

  return s;
}

// ─────────────────────────────────────────────────────────────
// 심볼 분류
// ─────────────────────────────────────────────────────────────

interface ClassifiedSymbols {
  krx: string[]; // KIS용 (6자리 종목코드)
  global: string[]; // TwelveData용
}

function classifySymbols(symbolsRaw: string): ClassifiedSymbols {
  const result: ClassifiedSymbols = { krx: [], global: [] };

  const list = symbolsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const raw of list) {
    const krxCode = normalizeKrxSymbol(raw);
    if (krxCode) {
      result.krx.push(krxCode);
    } else if (!isKrxSymbol(raw)) {
      result.global.push(normalizeSymbolForTwelveWs(raw));
    }
  }

  // 중복 제거
  result.krx = Array.from(new Set(result.krx)).slice(0, 20);
  result.global = Array.from(new Set(result.global)).slice(0, 100);

  return result;
}

// ─────────────────────────────────────────────────────────────
// 메인 핸들러
// ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolsRaw = searchParams.get("symbols")?.trim() ?? "";

  if (!symbolsRaw) {
    return NextResponse.json({ error: "Missing query parameter: symbols" }, { status: 400 });
  }

  const classified = classifySymbols(symbolsRaw);

  if (classified.krx.length === 0 && classified.global.length === 0) {
    return NextResponse.json({ error: "No valid symbols provided" }, { status: 400 });
  }

  // 환경변수 확인
  const twelveApiKey = await getSystemConfig('TWELVEDATA_API_KEY');
  const kisAppKey = await getSystemConfig('KIS_APP_KEY');
  const kisAppSecret = await getSystemConfig('KIS_APP_SECRET');

  // 글로벌 심볼이 있는데 TwelveData 키가 없으면 에러
  if (classified.global.length > 0 && !twelveApiKey) {
    return NextResponse.json({ error: "TwelveData API key is not configured" }, { status: 500 });
  }

  // KRX 심볼이 있는데 KIS 키가 없으면 에러
  if (classified.krx.length > 0 && (!kisAppKey || !kisAppSecret)) {
    return NextResponse.json({ error: "KIS API credentials are not configured" }, { status: 500 });
  }

  const encoder = new TextEncoder();

  // WebSocket 인스턴스들
  let wsKis: WebSocket | null = null;
  let wsTwelve: WebSocket | null = null;

  // 타이머들
  let kisHeartbeatTimer: NodeJS.Timeout | null = null;
  let twelveHeartbeatTimer: NodeJS.Timeout | null = null;
  let sseKeepAliveTimer: NodeJS.Timeout | null = null;
  let kisReconnectTimer: NodeJS.Timeout | null = null;
  let twelveReconnectTimer: NodeJS.Timeout | null = null;

  let kisReconnectAttempt = 0;
  let twelveReconnectAttempt = 0;
  let closedByClient = false;
  let streamClosed = false;

  // KIS 접속키 (재연결 시 갱신)
  let kisApprovalKey: string | null = null;
  let kisWsBase: string | null = null; // KIS WS Base URL

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const safeCloseStream = () => {
        if (streamClosed) return;
        streamClosed = true;
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      const safeSend = (chunk: string) => {
        if (closedByClient || streamClosed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closedByClient = true;
          safeCloseStream();
        }
      };

      const safeSendEvent = (event: string, data: unknown) => {
        safeSend(`event: ${event}\n`);
        safeSend(`data: ${JSON.stringify(data)}\n\n`);
      };

      // SSE 초기 설정
      safeSend("retry: 2000\n\n");
      safeSendEvent("status", {
        event: "connected",
        krxSymbols: classified.krx,
        globalSymbols: classified.global,
      });

      // SSE keep-alive
      sseKeepAliveTimer = setInterval(() => {
        safeSend(`: keep-alive ${Date.now()}\n\n`);
      }, 15_000);

      // ─────────────────────────────────────────────────────────
      // KIS WebSocket 연결 (국내주식)
      // ─────────────────────────────────────────────────────────

      const cleanupKisWs = () => {
        if (kisHeartbeatTimer) clearInterval(kisHeartbeatTimer);
        kisHeartbeatTimer = null;
        try {
          wsKis?.close();
        } catch {
          // ignore
        }
        wsKis = null;
      };

      const scheduleKisReconnect = (reason: string) => {
        if (closedByClient || streamClosed) return;
        cleanupKisWs();
        if (kisReconnectTimer) clearTimeout(kisReconnectTimer);
        kisReconnectAttempt += 1;
        const delay = Math.min(30_000, 1000 * Math.pow(2, Math.min(kisReconnectAttempt, 5)));
        safeSendEvent("status", {
          event: "kis_reconnecting",
          attempt: kisReconnectAttempt,
          delayMs: delay,
          reason,
        });
        kisReconnectTimer = setTimeout(() => connectKisWs(), delay);
      };

      const connectKisWs = async () => {
        if (closedByClient || streamClosed || classified.krx.length === 0) return;
        cleanupKisWs();

        try {
          const config = await getApprovalKey();
          kisApprovalKey = config.approvalKey;
          kisWsBase = config.wsBase;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          safeSendEvent("status", { event: "kis_auth_error", message });
          scheduleKisReconnect("auth_error");
          return;
        }

        wsKis = new WebSocket(kisWsBase);

        wsKis.on("open", () => {
          kisReconnectAttempt = 0;
          safeSendEvent("status", { event: "kis_connected", symbols: classified.krx });

          for (const symbol of classified.krx) {
            const msg = buildSubscribeMessage(kisApprovalKey!, KIS_TR_CODES.KR_EXEC, symbol, "1");
            wsKis?.send(msg);
          }

          safeSendEvent("status", { event: "kis_subscribed", symbols: classified.krx });

          kisHeartbeatTimer = setInterval(() => {
            try {
              wsKis?.ping();
            } catch {
              // ignore
            }
          }, 30_000);
        });

        wsKis.on("message", (buf) => {
          const raw = typeof buf === "string" ? buf : buf.toString("utf-8");

          if (raw.startsWith("{")) {
            try {
              const json = JSON.parse(raw);
              safeSendEvent("status", { ...json, provider: "kis" });
            } catch {
              safeSendEvent("message", { raw, provider: "kis" });
            }
            return;
          }

          const price = parseRealtimePrice(raw);
          if (price) {
            safeSendEvent("price", {
              symbol: price.symbol,
              price: price.price,
              change: price.change,
              change_percent: price.changeRate,
              volume: price.volume,
              timestamp: price.timestamp,
              provider: "kis",
            });
          }
        });

        wsKis.on("error", (err) => {
          safeSendEvent("status", { event: "kis_error", message: (err as Error)?.message ?? String(err) });
          scheduleKisReconnect("ws_error");
        });

        wsKis.on("close", (code, reason) => {
          if (closedByClient) {
            cleanupKisWs();
            return;
          }
          safeSendEvent("status", { event: "kis_closed", code, reason: reason?.toString?.() ?? "" });
          scheduleKisReconnect("ws_closed");
        });
      };

      // ─────────────────────────────────────────────────────────
      // TwelveData WebSocket 연결 (해외주식/암호화폐/외환)
      // ─────────────────────────────────────────────────────────

      const cleanupTwelveWs = () => {
        if (twelveHeartbeatTimer) clearInterval(twelveHeartbeatTimer);
        twelveHeartbeatTimer = null;
        try {
          wsTwelve?.close();
        } catch {
          // ignore
        }
        wsTwelve = null;
      };

      const scheduleTwelveReconnect = (reason: string) => {
        if (closedByClient || streamClosed) return;
        cleanupTwelveWs();
        if (twelveReconnectTimer) clearTimeout(twelveReconnectTimer);
        twelveReconnectAttempt += 1;
        const delay = Math.min(30_000, 1000 * Math.pow(2, Math.min(twelveReconnectAttempt, 5)));
        safeSendEvent("status", {
          event: "twelve_reconnecting",
          attempt: twelveReconnectAttempt,
          delayMs: delay,
          reason,
        });
        twelveReconnectTimer = setTimeout(() => connectTwelveWs(), delay);
      };

      const connectTwelveWs = () => {
        if (closedByClient || streamClosed || classified.global.length === 0) return;
        cleanupTwelveWs();

        const wsUrl = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(twelveApiKey!)}`;
        wsTwelve = new WebSocket(wsUrl);

        wsTwelve.on("open", () => {
          twelveReconnectAttempt = 0;
          wsTwelve?.send(
            JSON.stringify({
              action: "subscribe",
              params: { symbols: classified.global.join(",") },
            })
          );

          safeSendEvent("status", { event: "twelve_subscribed", symbols: classified.global });

          twelveHeartbeatTimer = setInterval(() => {
            try {
              wsTwelve?.ping();
            } catch {
              // ignore
            }
          }, 10_000);
        });

        (wsTwelve as WebSocket & { on: (event: string, listener: (...args: unknown[]) => void) => void }).on(
          "unexpected-response",
          (_req: unknown, res: { statusCode?: number; headers?: unknown }) => {
            safeSendEvent("status", {
              event: "twelve_unexpected_response",
              statusCode: res?.statusCode,
              headers: res?.headers,
            });
            scheduleTwelveReconnect("unexpected-response");
          }
        );

        wsTwelve.on("message", (buf) => {
          const raw = typeof buf === "string" ? buf : buf.toString("utf-8");
          try {
            const msg = JSON.parse(raw);
            const ev = typeof msg?.event === "string" ? msg.event : "message";
            if (ev === "price") {
              safeSendEvent("price", { ...msg, provider: "twelvedata" });
            } else {
              safeSendEvent("status", { ...msg, provider: "twelvedata" });
            }
          } catch {
            safeSendEvent("message", { raw, provider: "twelvedata" });
          }
        });

        wsTwelve.on("error", (err) => {
          safeSendEvent("status", { event: "twelve_error", message: (err as Error)?.message ?? String(err) });
          scheduleTwelveReconnect("ws_error");
        });

        wsTwelve.on("close", (code, reason) => {
          if (closedByClient) {
            cleanupTwelveWs();
            return;
          }
          safeSendEvent("status", { event: "twelve_closed", code, reason: reason?.toString?.() ?? "" });
          scheduleTwelveReconnect("ws_closed");
        });
      };

      // ─────────────────────────────────────────────────────────
      // 정리 및 연결 시작
      // ─────────────────────────────────────────────────────────

      const cleanupAll = () => {
        if (sseKeepAliveTimer) clearInterval(sseKeepAliveTimer);
        sseKeepAliveTimer = null;
        if (kisReconnectTimer) clearTimeout(kisReconnectTimer);
        kisReconnectTimer = null;
        if (twelveReconnectTimer) clearTimeout(twelveReconnectTimer);
        twelveReconnectTimer = null;
        cleanupKisWs();
        cleanupTwelveWs();
      };

      req.signal?.addEventListener?.("abort", () => {
        closedByClient = true;
        cleanupAll();
        safeCloseStream();
      });

      // 연결 시작
      if (classified.krx.length > 0) {
        connectKisWs();
      }
      if (classified.global.length > 0) {
        connectTwelveWs();
      }
    },
    cancel() {
      closedByClient = true;
      if (sseKeepAliveTimer) clearInterval(sseKeepAliveTimer);
      sseKeepAliveTimer = null;
      if (kisHeartbeatTimer) clearInterval(kisHeartbeatTimer);
      kisHeartbeatTimer = null;
      if (twelveHeartbeatTimer) clearInterval(twelveHeartbeatTimer);
      twelveHeartbeatTimer = null;
      if (kisReconnectTimer) clearTimeout(kisReconnectTimer);
      kisReconnectTimer = null;
      if (twelveReconnectTimer) clearTimeout(twelveReconnectTimer);
      twelveReconnectTimer = null;
      try {
        wsKis?.close();
      } catch {
        // ignore
      }
      wsKis = null;
      try {
        wsTwelve?.close();
      } catch {
        // ignore
      }
      wsTwelve = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}





