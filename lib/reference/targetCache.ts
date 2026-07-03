import type { AnalysisTargetAnalysis } from "./types";

// 분석 대상 캐시 (Step 10-c) — 프로젝트를 넘어 재활용 ("쿠팡" 분석은 어디서나 동일).
// 분석 대상 브랜드는 공개 정보라 실명 localStorage 저장이 허용된다 (마스킹 정책과 일관).
// ⚠️ 여기에 문서 내용·복원키를 절대 넣지 않는다.

const KEY = "drg.targetCache.v1";

type CacheMap = Record<string, AnalysisTargetAnalysis>;

function read(): CacheMap {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function cacheKey(name: string): string {
  return name.trim().toLowerCase();
}

export function getCachedTargetAnalysis(
  name: string,
): AnalysisTargetAnalysis | null {
  return read()[cacheKey(name)] ?? null;
}

export function setCachedTargetAnalysis(
  name: string,
  analysis: AnalysisTargetAnalysis,
): void {
  const map = read();
  map[cacheKey(name)] = analysis;
  window.localStorage.setItem(KEY, JSON.stringify(map));
}

export function daysAgo(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}
