export interface CandleData {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

import { fetchYahooCandles } from "./yahoo";

export type TwelvePriceEvent = {
  event: "price";
  symbol: string;
  price: string;
  timestamp: number;
  volume?: string;
};

type CacheEntry = {
  expiresAt: number;
  data: CandleData[];
};

// ✅ 클라이언트(브라우저)에서 동일 심볼/interval 중복 호출을 합치고(TTL 캐시) 요청량을 완화
const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CandleData[]>>();

/**
 * Twelve Data 캔들 데이터를 내부 REST 프록시(`/api/twelvedata/candles`)로부터 가져옵니다.
 */
export async function fetchTwelveDataCandles(symbol: string, interval: string): Promise<CandleData[]> {
  const s0 = symbol?.trim();
  const itv = interval?.trim();
  const normalizeSymbol = (raw: string) => {
    // KRX:005930 / XKRX:005930 → 005930:KRX
    const mKr = raw.match(/^(KRX|XKRX)\s*:\s*(\d{6})$/i);
    if (mKr) return `${mKr[2]}:KRX`;
    return raw;
  };
  const s = normalizeSymbol(s0);
  const key = `${s}|${itv}`;

  // ✅ 한국 주식(예: 005930.KS/005930.KQ)은 Twelve Data 플랜 제한이 걸리는 경우가 많아
  //    바로 Yahoo 프록시로 폴백합니다.
  if (s.endsWith(".KS") || s.endsWith(".KQ")) {
    try {
      return await fetchYahooCandles(s, itv);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      // Yahoo 429가 잦아서 사용자에게 명확한 안내를 제공합니다.
      if (msg.includes("429") || msg.includes("요청이 많아")) {
        throw new Error("현재 데이터 제공자(Yahoo) 요청이 많아 일시적으로 차트를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.");
      }
      throw e;
    }
  }

  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.data;

  const pending = inFlight.get(key);
  if (pending) return await pending;

  const promise = (async () => {
    const url = `/api/twelvedata/candles?symbol=${encodeURIComponent(s)}&interval=${encodeURIComponent(itv)}`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const details =
        (errorData as any)?.details ||
        (errorData as any)?.message ||
        (errorData as any)?.error ||
        "";
      const msg = String(details || `Twelve Data API Error: ${res.statusText}`);

      // 분당 크레딧 초과 등은 그대로 메시지를 노출(사용자에게 원인 제공)
      if (msg.includes("API credits") || msg.includes("current minute")) {
        throw new Error(msg);
      }

      // ✅ Pro 플랜 제한/심볼 제한이면 Yahoo로 재시도(가능한 경우)
      const isProLimited = msg.includes("Pro (Pro plan)") || msg.includes("starting with Pro");
      const baseKr = s.replace(/:KRX$/i, "");
      const looksLikeKrNumber = /^\d{6}$/.test(baseKr);
      const isKrxSymbol = s.toUpperCase().endsWith(":KRX");
      if (isProLimited && looksLikeKrNumber) {
        // 사용자가 "KRX로 Twelve Data에서 된다"는 케이스는 맞지만,
        // 실제로는 플랜 제한일 수 있어 명확히 안내합니다.
        if (isKrxSymbol) {
          throw new Error(
            "KRX 종목(예: 005930:KRX)은 Twelve Data에서 지원하지만 현재 플랜에서는 제한됩니다. (Pro 요금제 필요)"
          );
        }
        // 숫자 6자리만 들어온 경우엔 Yahoo로 폴백 시도
        try {
          return await fetchYahooCandles(`${baseKr}.KS`, itv);
        } catch {
          return await fetchYahooCandles(`${baseKr}.KQ`, itv);
        }
      }

      throw new Error(msg);
    }

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("잘못된 데이터 형식입니다.");

    const candles = data as CandleData[];
    cache.set(key, { expiresAt: Date.now() + TTL_MS, data: candles });
    return candles;
  })();

  inFlight.set(key, promise);
  return await promise.finally(() => inFlight.delete(key));
}

/**
 * Twelve Data 실시간 가격 스트림(SSE) 구독.
 * - 서버가 Twelve Data WebSocket에 붙고, 클라이언트에는 SSE(EventSource)로 중계합니다.
 * - API 키는 브라우저로 노출되지 않습니다.
 */
export function subscribeTwelveDataPrices(
  symbols: string[],
  onPrice: (msg: TwelvePriceEvent) => void,
  onError?: (err: unknown) => void
) {
  const normalized = Array.from(
    new Set(
      symbols
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
    )
  );

  if (normalized.length === 0) return { close: () => {} };

  const url = `/api/twelvedata/stream?symbols=${encodeURIComponent(normalized.join(","))}`;
  const es = new EventSource(url);

  const handlePrice = (ev: MessageEvent) => {
    try {
      const data = JSON.parse(String(ev.data)) as TwelvePriceEvent;
      if (data?.event === "price" && typeof data.symbol === "string") {
        onPrice(data);
      }
    } catch (e) {
      onError?.(e);
    }
  };

  const handleError = (e: Event) => {
    onError?.(e);
  };

  es.addEventListener("price", handlePrice as any);
  es.addEventListener("error", handleError as any);

  return {
    close: () => {
      es.removeEventListener("price", handlePrice as any);
      es.removeEventListener("error", handleError as any);
      es.close();
    },
  };
}
