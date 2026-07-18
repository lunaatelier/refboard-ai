import type { ProjectAnalysis } from "../analysis/types";
import type { SafeConceptAnalysisInput } from "./types";

// ProjectAnalysis 전체를 컨셉 API에 그대로 넘기지 않기 위한 안전 파생 DTO (§3.6).
// 선택된 페이지·확정 섹션의 마스킹 콘텐츠만 남긴다 — 제외 페이지·후보 섹션은
// 애초에 프롬프트에 닿지 않는다.
export function buildSafeConceptAnalysisInput(
  analysis: ProjectAnalysis,
): SafeConceptAnalysisInput {
  return {
    title: analysis.title,
    description: analysis.description,
    domain: analysis.domain,
    ...(analysis.businessDomains ? { businessDomains: analysis.businessDomains } : {}),
    projectType: analysis.projectType,
    targetUser: analysis.targetUser,
    pages: analysis.pages
      .filter((p) => p.selected)
      .map((page) => ({
        pageId: page.pageId,
        pageTitle: page.pageTitle,
        sections: page.sections
          .filter((s) => s.status === "confirmed")
          .map((section) => ({
            sectionId: section.sectionId,
            sectionTitle: section.sectionTitle,
            contentType: section.contentType,
            maskedContent: section.contentSummary,
          })),
      })),
  };
}
