import type { OgMeta } from "../parse/html";
import { normalizeUrlKey } from "./urlNormalize";

// OG 메타 서버 캐시 (P10 캐시 규칙 "OG 메타: 정규화 URL"). 지금까지 /api/og-preview는
// 캐시가 전혀 없어서 같은 URL(여러 섹션이 같은 레퍼런스를 참고하는 경우 흔함)을
// 조회할 때마다 매번 재요청했다 — 외부 리뷰로 지적됨.
//
// TTL을 두는 이유: OG 메타(제목·썸네일)는 대상 페이지가 개편되면 바뀔 수 있어
// 무기한 캐시하면 오래된 정보가 계속 나온다. 세션 하나 안에서는 사실상 항상
// 캐시가 맞고, 장기적으로는 최신화되는 값이면 충분하다.
//
// 지금은 target-analyze/providerBudget과 같은 이유로 서버 메모리 1차 구현이다
// (Vercel 서버리스 다중 인스턴스에서는 완전한 공유가 아님).

interface CacheEntry {
  meta: OgMeta;
  cachedAt: number;
}

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500; // 무한 증가 방지 — 넘으면 가장 오래된 항목부터 정리

const store = new Map<string, CacheEntry>();

export function getCachedOgMeta(url: string): OgMeta | null {
  const key = normalizeUrlKey(url);
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry.meta;
}

export function setCachedOgMeta(url: string, meta: OgMeta): void {
  const key = normalizeUrlKey(url);
  if (!store.has(key) && store.size >= MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) store.delete(oldestKey);
  }
  store.set(key, { meta, cachedAt: Date.now() });
}
