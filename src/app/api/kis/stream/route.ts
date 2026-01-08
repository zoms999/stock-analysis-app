/**
 * 한국투자증권 KIS Developers WebSocket → SSE 프록시
 *
 * 국내주식 실시간 체결가를 WebSocket으로 수신하여 브라우저에 SSE로 전달합니다.
 *
 * GET /api/kis/stream?symbols=005930,000660,035720
 *
 * 참고:
 * - TwelveData 스트림 (/api/twelvedata/stream)과 동일한 패턴
 * - symbols 파라미터: 쉼표로 구분된 6자리 종목코드 (예: 005930)
 * - KRX:005930 형태도 지원 (자동 정규화)
 */

import { NextResponse } from "next/server";
import WebSocket from "ws";
import {
  getApprovalKey,
  KIS_TR_CODES,
  buildSubscribeMessage,
  parseRealtimePrice,
  normalizeKrxSymbol,
} from "@/lib/api/kis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * symbols 파라미터 정규화
 * - "005930,KRX:000660" → ["005930", "000660"]
 */
function normalizeSymbolsParam(symbols: string): string[] {
  const list = symbols
    .split(",")
    .map((s) => normalizeKrxSymbol(s.trim()))
    .filter((s): s is string => s !== null);

  // 중복 제거 및 최대 20개 제한 (KIS 권장)
  return Array.from(new Set(list)).slice(0, 20);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolsRaw = searchParams.get("symbols")?.trim() ?? "";

  if (!symbolsRaw) {
    return NextResponse.json({ error: "Missing query parameter: symbols" }, { status: 400 });
  }

  const symbols = normalizeSymbolsParam(symbolsRaw);
  if (symbols.length === 0) {
    return NextResponse.json(
      { error: "No valid KRX symbols provided. Use 6-digit codes like 005930" },
      { status: 400 }
    );
  }

  // WebSocket 접속키 및 Base URL 발급
  let approvalKey: string;
  let wsBase: string;
  try {
    const config = await getApprovalKey();
    approvalKey = config.approvalKey;
    wsBase = config.wsBase;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `KIS 인증 실패: ${message}` }, { status: 500 });
  }

  const encoder = new TextEncoder();
  let ws: WebSocket | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let sseKeepAliveTimer: NodeJS.Timeout | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let reconnectAttempt = 0;
  let closedByClient = false;
  let streamClosed = false;

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
      safeSendEvent("status", { event: "connected", symbols, provider: "kis" });

      // SSE keep-alive (15초마다)
      sseKeepAliveTimer = setInterval(() => {
        safeSend(`: keep-alive ${Date.now()}\n\n`);
      }, 15_000);

      const cleanupWs = () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        if (sseKeepAliveTimer) clearInterval(sseKeepAliveTimer);
        sseKeepAliveTimer = null;
        try {
          ws?.close();
        } catch {
          // ignore
        }
        ws = null;
      };

      const scheduleReconnect = (reason: string) => {
        if (closedByClient || streamClosed) return;
        cleanupWs();
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectAttempt += 1;
        const delay = Math.min(30_000, 1000 * Math.pow(2, Math.min(reconnectAttempt, 5)));
        safeSendEvent("status", { event: "reconnecting", attempt: reconnectAttempt, delayMs: delay, reason });
        reconnectTimer = setTimeout(() => connectWs(), delay);
      };

      const connectWs = async () => {
        if (closedByClient || streamClosed) return;
        cleanupWs();

        // 재연결 시 접속키 갱신
        try {
          const config = await getApprovalKey();
          approvalKey = config.approvalKey;
          wsBase = config.wsBase;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          safeSendEvent("status", { event: "auth_error", message });
          scheduleReconnect("auth_error");
          return;
        }

        // KIS WebSocket 연결
        ws = new WebSocket(wsBase);

        ws.on("open", () => {
          reconnectAttempt = 0;
          safeSendEvent("status", { event: "ws_connected", symbols });

          // 각 종목 구독 요청
          for (const symbol of symbols) {
            const msg = buildSubscribeMessage(approvalKey, KIS_TR_CODES.KR_EXEC, symbol, "1");
            ws?.send(msg);
          }

          safeSendEvent("status", { event: "subscribed", symbols });

          // keep-alive ping (30초마다)
          heartbeatTimer = setInterval(() => {
            try {
              ws?.ping();
            } catch {
              // ignore
            }
          }, 30_000);
        });

        ws.on("message", (buf) => {
          const raw = typeof buf === "string" ? buf : buf.toString("utf-8");

          // JSON 응답 (구독 확인 등)
          if (raw.startsWith("{")) {
            try {
              const json = JSON.parse(raw);
              safeSendEvent("status", json);
            } catch {
              safeSendEvent("message", { raw });
            }
            return;
          }

          // 실시간 체결가 파싱
          const price = parseRealtimePrice(raw);
          if (price) {
            // TwelveData 형식과 호환되도록 변환
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

        ws.on("error", (err) => {
          safeSendEvent("status", { event: "ws_error", message: (err as Error)?.message ?? String(err) });
          scheduleReconnect("ws_error");
        });

        ws.on("close", (code, reason) => {
          if (closedByClient) {
            cleanupWs();
            safeCloseStream();
            return;
          }
          safeSendEvent("status", { event: "ws_closed", code, reason: reason?.toString?.() ?? "" });
          scheduleReconnect("ws_closed");
        });
      };

      // 클라이언트 연결 종료 시 정리
      req.signal?.addEventListener?.("abort", () => {
        closedByClient = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = null;
        cleanupWs();
        safeCloseStream();
      });

      connectWs();
    },
    cancel() {
      closedByClient = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      if (sseKeepAliveTimer) clearInterval(sseKeepAliveTimer);
      sseKeepAliveTimer = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      try {
        ws?.close();
      } catch {
        // ignore
      }
      ws = null;
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





