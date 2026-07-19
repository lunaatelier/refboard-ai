import type { Page, Section } from "../analysis/types";
import type { SectionPriorityEntry } from "./types";

// 섹션 우선순위 로컬 추천 (P5-2) — AI 호출 없이 contentType/layout/제목 키워드로
// 고영향 후보 3~5개를 추천한다(§3.4 결정론적 조합 우선). 사용자가 이미 내린
// 결정은 절대 덮어쓰지 않는다 — 이 모듈은 "빈 자리만 채우는" 역할만 한다.

export function sectionKey(pageId: string, sectionId: string): string {
  return `${pageId}::${sectionId}`;
}

// 히어로/핵심 기능/CTA/데이터 시각화류 — spec 예시("히어로, 핵심 기능, 데이터
// 시각화 등")를 contentType·recommendedLayout·sectionTitle에 매칭한다.
const HIGH_IMPACT_PATTERN =
  /hero|cta|feature|pricing|chart|data-table|stat-band|comparison|testimonial|business-model|kpi|dashboard|metric/i;

function matchesHighImpact(s: Section): boolean {
  return HIGH_IMPACT_PATTERN.test(
    `${s.contentType} ${s.recommendedLayout} ${s.sectionTitle}`,
  );
}

// 확정 섹션 중 고영향 후보 sectionId — 패턴에 걸리는 섹션 우선, 가능하면
// 최소 3개까지 채우되(문서 순서로 보충) 최대 5개를 넘지 않는다.
export function recommendHighImpactSectionIds(page: Page): string[] {
  const confirmed = page.sections.filter((s) => s.status === "confirmed");
  const matched = confirmed.filter(matchesHighImpact).map((s) => s.sectionId);
  const remaining = confirmed
    .filter((s) => !matchesHighImpact(s))
    .map((s) => s.sectionId);
  const target = Math.min(
    5,
    Math.max(matched.length, Math.min(3, confirmed.length)),
  );
  return [...matched, ...remaining].slice(0, target);
}

// 아직 명시적 결정이 없는 확정 섹션에만 규칙 추천을 채워 넣는다. 이미 존재하는
// 항목(사용자 승격/강등 포함)은 그대로 둔다 — 페이지를 다시 열 때마다 호출해도
// 안전하다(멱등).
export function seedSectionPriorities(
  page: Page,
  existing: Record<string, SectionPriorityEntry> = {},
): Record<string, SectionPriorityEntry> {
  const recommended = new Set(recommendHighImpactSectionIds(page));
  const next = { ...existing };
  for (const s of page.sections) {
    if (s.status !== "confirmed") continue;
    const key = sectionKey(page.pageId, s.sectionId);
    if (next[key]) continue;
    next[key] = {
      priority: recommended.has(s.sectionId) ? "high-impact" : "inherited",
      source: "rule",
    };
  }
  return next;
}
