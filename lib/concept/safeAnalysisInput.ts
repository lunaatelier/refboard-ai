import type { ProjectAnalysis } from "../analysis/types";
import type { SafeConceptAnalysisInput } from "./types";

// Gemini 프롬프트에 실제로 들어가는 내용을 만드는 안전 파생 DTO (§3.6). 선택된
// 페이지·확정 섹션의 마스킹 콘텐츠만 남긴다 — 제외 페이지·후보 섹션은 애초에
// 프롬프트에 닿지 않는다.
// baseContentVariantId를 주면 그 변형 하나만 포함한다(§6.7 — 구조 3안 생성은
// 기준 변형 하나만 참고하고, 나머지 변형은 온디맨드 매핑에서 별도로 다룬다).
export function buildSafeConceptAnalysisInput(
  analysis: ProjectAnalysis,
  baseContentVariantId?: string,
): SafeConceptAnalysisInput {
  const variants = analysis.existingContentVariants ?? [];
  const selectedVariants = baseContentVariantId
    ? variants.filter((v) => v.variantId === baseContentVariantId)
    : variants;

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
    ...(selectedVariants.length > 0
      ? {
          existingContentVariants: selectedVariants.map((v) => ({
            variantId: v.variantId,
            label: v.label,
            contentSummary: v.contentSummary,
          })),
        }
      : {}),
  };
}
