import type { Page, PageRole, ProjectAnalysis } from "../analysis/types";
import type { PageMetaOverride } from "./types";

// 페이지 보드 요약 (P5-1) — Page/Section은 분석 원본이고 analysisHash에 들어가므로
// 여기에 파생값(목적/핵심 대상 요약)을 직접 추가하지 않는다. 대신 순수 함수로
// 매번 다시 계산한다 — AI 호출 없음(§3.4 결정론적 조합 우선, 새 Gemini 호출 안 씀).

export interface PageBoardSummary {
  purposeSummary: string;
  audienceSummary: string;
  confirmedSectionCount: number;
  contentSummary: string; // 확정 섹션 요약을 이어붙인 핵심 콘텐츠 요약
}

const PAGE_ROLE_PURPOSE: Record<PageRole, string> = {
  cover: "첫인상과 핵심 가치 제안 전달",
  "section-divider": "다음 섹션으로의 전환·구분",
  content: "핵심 기능·서비스 정보 전달",
  "case-study": "실제 사례를 통한 신뢰 확보",
  metrics: "핵심 지표·성과 제시",
  team: "팀·조직 소개",
  appendix: "부가 정보·참고 자료 제공",
  contact: "문의·연락 경로 제공",
};

function summarizeContent(page: Page): string {
  const confirmed = page.sections.filter((s) => s.status === "confirmed");
  if (confirmed.length === 0) return "확정된 섹션이 없습니다.";
  return confirmed
    .map((s) => s.contentSummary)
    .filter((s) => s.trim() !== "")
    .join(" · ");
}

// 로컬 규칙만으로 즉시 계산 — pageRole 템플릿 + targetUser + 확정 섹션 요약.
export function derivePageBoardSummary(
  page: Page,
  analysis: ProjectAnalysis,
): PageBoardSummary {
  const confirmedSectionCount = page.sections.filter(
    (s) => s.status === "confirmed",
  ).length;
  return {
    purposeSummary: PAGE_ROLE_PURPOSE[page.pageRole] ?? "정보 전달",
    audienceSummary: analysis.targetUser || "지정된 타겟 없음",
    confirmedSectionCount,
    contentSummary: summarizeContent(page),
  };
}

// override가 있으면 그 값을, 없으면 파생값을 그대로 쓴다.
export function resolvePageBoardSummary(
  page: Page,
  analysis: ProjectAnalysis,
  override?: PageMetaOverride,
): PageBoardSummary {
  const derived = derivePageBoardSummary(page, analysis);
  return {
    ...derived,
    purposeSummary: override?.purposeSummary || derived.purposeSummary,
    audienceSummary: override?.audienceSummary || derived.audienceSummary,
  };
}
