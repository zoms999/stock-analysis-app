import { NextResponse } from "next/server";
import WebSocket from "ws";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// WS에서 자주 쓰는 크립토/페어 심볼 보정(홈 카드에 저장된 티커 포맷과의 차이 보정)
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

function normalizeSymbolForTwelveWs(raw: string) {
  const s = raw.trim();

  // KRX:005930 / XKRX:005930 → 005930:KRX
  const mKr = s.match(/^(KRX|XKRX)\s*:\s*(\d{6})$/i);
  if (mKr) return `${mKr[2]}:KRX`;

  // BTC-USD / EUR-USD → BTC/USD / EUR/USD
  if (/^[A-Za-z0-9]+-[A-Za-z]{3,6}$/.test(s)) return s.replace("-", "/");

  // ETH (같은 단일 코인 티커) → ETH/USD (명확한 경우만)
  if (/^[A-Za-z]{2,6}$/.test(s) && CRYPTO_BASE_TO_USD.has(s.toUpperCase())) {
    return `${s.toUpperCase()}/USD`;
  }

  return s;
}

function normalizeSymbolsParam(symbols: string) {
  const list = symbols
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(list.map(normalizeSymbolForTwelveWs))).slice(0, 100); // 안전 제한
}

/**
 * Twelve Data WebSocket → SSE 프록시
 *
 * - 브라우저는 EventSource(SSE)로 접속합니다.
 * - 서버가 Twelve Data WS에 접속할 때 API 키를 사용하므로, 키가 브라우저로 노출되지 않습니다.
 *
 * GET /api/twelvedata/stream?symbols=AAPL,BTC/USD,EUR/USD
 *
 * 참고 문서(WS 연결/subscribe 포맷):
 * - https://support.twelvedata.com/en/articles/5620516-how-to-stream-the-data
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolsRaw = searchParams.get("symbols")?.trim() ?? "";

  if (!symbolsRaw) {
    return NextResponse.json({ error: "Missing query parameter: symbols" }, { status: 400 });
  }

  const symbols = normalizeSymbolsParam(symbolsRaw);
  if (symbols.length === 0) {
    return NextResponse.json({ error: "No valid symbols provided" }, { status: 400 });
  }

  const apiKey = process.env.TWELVEDATA_API_KEY ?? process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Twelve Data API key is not configured" }, { status: 500 });
  }

  const encoder = new TextEncoder();
  let ws: WebSocket | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let sseKeepAliveTimer: NodeJS.Timeout | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let reconnectAttempt = 0;
  let closedByClient = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const sendEvent = (event: string, data: unknown) => {
        send(`event: ${event}\n`);
        send(`data: ${JSON.stringify(data)}\n\n`);
      };

      // SSE 기본 설정
      send("retry: 2000\n\n");
      sendEvent("status", { event: "connected", symbols });

      // ✅ 프록시/브라우저가 조용히 연결을 끊지 않도록 SSE keep-alive 전송
      sseKeepAliveTimer = setInterval(() => {
        try {
          send(`: keep-alive ${Date.now()}\n\n`);
        } catch {
          // ignore
        }
      }, 15_000);

      const wsUrl = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(apiKey)}`;

      const cleanupWs = () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        try {
          ws?.close();
        } catch {
          // ignore
        }
        ws = null;
      };

      const scheduleReconnect = (reason: string) => {
        if (closedByClient) return;
        cleanupWs();
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectAttempt += 1;
        const delay = Math.min(30_000, 1000 * Math.pow(2, Math.min(reconnectAttempt, 5))); // 2s,4s,8s.. (cap)
        sendEvent("status", { event: "reconnecting", attempt: reconnectAttempt, delayMs: delay, reason });
        reconnectTimer = setTimeout(() => connectWs(), delay);
      };

      const connectWs = () => {
        if (closedByClient) return;
        cleanupWs();
        ws = new WebSocket(wsUrl);

        ws.on("open", () => {
          reconnectAttempt = 0;
          // Subscribe message format per Twelve Data docs
          ws?.send(
            JSON.stringify({
              action: "subscribe",
              params: { symbols: symbols.join(",") },
            })
          );

          sendEvent("status", { event: "subscribed", symbols });

          // keep-alive: ping every 10s
          heartbeatTimer = setInterval(() => {
            try {
              ws?.ping();
            } catch {
              // ignore
            }
          }, 10_000);
        });

        // ws가 101 업그레이드 대신 HTTP 200/4xx 등을 돌려줄 때(키/플랜/엔드포인트 문제)
        (ws as any).on("unexpected-response", (_req: any, res: any) => {
          const statusCode = res?.statusCode;
          const headers = res?.headers;
          let body = "";
          try {
            res.on("data", (c: Buffer) => (body += c.toString("utf-8")));
            res.on("end", () => {
              const trimmed = body.slice(0, 1500);
              sendEvent("status", {
                event: "ws_unexpected_response",
                statusCode,
                headers,
                body: trimmed,
              });
              scheduleReconnect("unexpected-response");
            });
          } catch {
            sendEvent("status", { event: "ws_unexpected_response", statusCode, headers });
            scheduleReconnect("unexpected-response");
          }
        });

        ws.on("message", (buf) => {
          const raw = typeof buf === "string" ? buf : buf.toString("utf-8");
          try {
            const msg = JSON.parse(raw);
            const ev = typeof msg?.event === "string" ? msg.event : "message";
            // 주로 subscribe-status / price 이벤트가 옵니다.
            sendEvent(ev === "price" ? "price" : "status", msg);
          } catch {
            sendEvent("message", { raw });
          }
        });

        ws.on("error", (err) => {
          sendEvent("status", { event: "ws_error", message: (err as any)?.message ?? String(err) });
          // error 뒤 close가 오지 않는 케이스를 대비해 재연결 예약
          scheduleReconnect("ws_error");
        });

        ws.on("close", (code, reason) => {
          if (closedByClient) {
            cleanupWs();
            try {
              controller.close();
            } catch {
              // ignore
            }
            return;
          }
          sendEvent("status", { event: "ws_closed", code, reason: reason?.toString?.() ?? "" });
          scheduleReconnect("ws_closed");
        });
      };

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
      // same-origin 앱이라도 개발 편의상 열어둠
      "Access-Control-Allow-Origin": "*",
    },
  });
}



