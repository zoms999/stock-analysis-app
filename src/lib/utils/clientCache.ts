// src/lib/utils/clientCache.ts
// - sessionStorage 기반 TTL 캐시(메인 리스트 같은 클라이언트 페이지 최적화용)
// - SSR/서버 환경에서는 메모리 캐시만 사용

type CacheEnvelope<T> = {
  v: T;
  exp: number; // epoch ms
};

const mem = new Map<string, CacheEnvelope<any>>();

function now() {
  return Date.now();
}

export function clientCacheGet<T>(key: string): T | null {
  const m = mem.get(key);
  if (m && m.exp > now()) return m.v as T;
  if (m) mem.delete(key);

  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.exp !== "number" || parsed.exp <= now()) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    // hot path: 메모리에도 넣어둬서 같은 탭 내 반복 파싱 최소화
    mem.set(key, parsed as any);
    return parsed.v ?? null;
  } catch {
    return null;
  }
}

export function clientCacheSet<T>(key: string, value: T, ttlMs: number) {
  const env: CacheEnvelope<T> = { v: value, exp: now() + ttlMs };
  mem.set(key, env as any);

  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(env));
  } catch {
    // storage quota/blocked -> 메모리 캐시만 사용
  }
}



