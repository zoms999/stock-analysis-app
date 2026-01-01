import { NextResponse } from "next/server";
import WebSocket from "ws";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeSymbolsParam(symbols: string) {
  const list = symbols
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(list)).slice(0, 100); // 안전 제한
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

      const wsUrl = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(apiKey)}`;
      ws = new WebSocket(wsUrl);

      ws.on("open", () => {
        // Subscribe message format per Twelve Data docs
        ws?.send(
          JSON.stringify({
            action: "subscribe",
            params: { symbols: symbols.join(",") },
          })
        );

        sendEvent("status", { event: "subscribed", symbols });

        // keep-alive: ping every 10s (doc recommends heartbeat; ping works with ws)
        heartbeatTimer = setInterval(() => {
          try {
            ws?.ping();
          } catch {
            // ignore
          }
        }, 10_000);
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
        sendEvent("status", { event: "error", message: (err as any)?.message ?? String(err) });
      });

      ws.on("close", (code, reason) => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        sendEvent("status", { event: "closed", code, reason: reason?.toString?.() ?? "" });
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
    cancel() {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
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


