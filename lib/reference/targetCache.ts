import type { AnalysisTargetAnalysis } from "./types";
import { normalizeUrlKey } from "./urlNormalize";

// 분석 대상 캐시 (Step 10-c) — 같은 URL을 같은 프로젝트 도메인 맥락으로 다시
// 분석하면 재사용한다. 분석 대상 브랜드는 공개 정보라 실명 localStorage 저장이
// 허용된다 (마스킹 정책과 일관). ⚠️ 여기에 문서 내용·복원키를 절대 넣지 않는다.
//
// (2026-07-23 수정) 이전 버전은 브랜드 "이름"만으로 캐시해 프로젝트를 완전히
// 넘어 재사용했다 — 그런데 /api/target-analyze 프롬프트는 projectSummary(우리
// 프로젝트 맥락)를 받아 "우리 프로젝트 시사점"까지 답하므로, 프로젝트 도메인이
// 다르면 같은 브랜드라도 분석 내용(특히 implications)이 달라야 정확하다. 이름만
// 같고 실제로는 다른 서비스인 경우(동명이인)도 이름만으로 캐시하면 잘못 섞인다.
// P10 캐시 규칙("브랜드 분석: 정규화 URL + 프로젝트 도메인 + prompt version")대로
// URL+도메인+프롬프트 버전을 키에 넣는다(외부 리뷰로 지적됨).

const KEY = "drg.targetCache.v2"; // v1(이름만 키)과 스키마가 달라 버전을 올림 — 구버전은 자동 miss
const PROMPT_VERSION = "v1"; // /api/target-analyze의 7축 프롬프트가 바뀌면 여기도 올릴 것

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

function cacheKey(name: string, url: string, projectDomain: string): string {
  return [
    name.trim().toLowerCase(),
    normalizeUrlKey(url),
    projectDomain.trim().toLowerCase(),
    PROMPT_VERSION,
  ].join("::");
}

export function getCachedTargetAnalysis(
  name: string,
  url: string,
  projectDomain: string,
): AnalysisTargetAnalysis | null {
  return read()[cacheKey(name, url, projectDomain)] ?? null;
}

export function setCachedTargetAnalysis(
  name: string,
  url: string,
  projectDomain: string,
  analysis: AnalysisTargetAnalysis,
): void {
  const map = read();
  map[cacheKey(name, url, projectDomain)] = analysis;
  window.localStorage.setItem(KEY, JSON.stringify(map));
}

export function daysAgo(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}
