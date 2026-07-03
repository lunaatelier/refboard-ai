import type { ProjectAnalysis } from "../analysis/types";
import type { RepresentativePages } from "../reference/types";
import type {
  ConceptJson,
  ConceptOption,
  ConceptPage,
  ConceptSection,
} from "./types";

// Gemini 컨셉 응답 정규화 (Step 12-a) — isomorphic 순수 함수.
// sectionId 계보 유지가 핵심: Phase 2의 sectionId가 그대로 ConceptSection으로 이어진다.

/* eslint-disable @typescript-eslint/no-explicit-any */
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export function normalizeConcept(
  raw: any,
  analysis: ProjectAnalysis,
  representative: RepresentativePages,
): ConceptJson {
  const validSectionIds = new Set(
    analysis.pages.flatMap((p) => p.sections.map((s) => s.sectionId)),
  );
  const validPageIds = new Set(analysis.pages.map((p) => p.pageId));

  const rawOptions: any[] = Array.isArray(raw?.options) ? raw.options : [];
  const options: ConceptOption[] = rawOptions.slice(0, 3).map((o, oi) => {
    const rawPages: any[] = Array.isArray(o?.pages) ? o.pages : [];
    const pages: ConceptPage[] = rawPages
      .filter((p) => validPageIds.has(str(p?.pageId)))
      .map((p) => {
        const rawSections: any[] = Array.isArray(p?.sections) ? p.sections : [];
        const sections: ConceptSection[] = rawSections
          .filter((s) => validSectionIds.has(str(s?.sectionId)))
          .map((s) => ({
            sectionId: str(s.sectionId),
            sectionTitle: str(s?.sectionTitle, "섹션"),
            contentType: str(s?.contentType, "content"),
            layoutPattern: str(s?.layoutPattern, "card-grid"),
            contentMapping: {
              maskedContent: str(s?.contentMapping?.maskedContent),
              sourceSectionId: str(
                s?.contentMapping?.sourceSectionId,
                str(s.sectionId),
              ),
              targetArea: str(s?.contentMapping?.targetArea, "content"),
            },
          }));
        return {
          pageId: str(p.pageId),
          pageTitle: str(p?.pageTitle, "페이지"),
          sections,
        };
      });

    const axes = (Array.isArray(o?.conceptKeywords) ? o.conceptKeywords : [])
      .slice(0, 3)
      .map((a: any, ai: number) => ({
        no: str(a?.no, String(ai + 1).padStart(2, "0")),
        title: str(a?.title, `축 ${ai + 1}`),
        category: str(a?.category),
        description: str(a?.description),
      }));

    return {
      optionId: str(o?.optionId, `option-${oi + 1}`),
      label: str(o?.label, `${["A", "B", "C"][oi]}안`),
      ...(str(o?.basedOnVariantLabel)
        ? { basedOnVariantLabel: str(o.basedOnVariantLabel) }
        : {}),
      conceptKeywords: axes,
      uiStructure: {
        mode: o?.uiStructure?.mode === "dark" ? "dark" : "light",
        navPosition: o?.uiStructure?.navPosition === "left" ? "left" : "top",
        infoStructure: str(o?.uiStructure?.infoStructure),
        layoutConcept: str(o?.uiStructure?.layoutConcept),
      },
      keyVisual: {
        imageTone: str(o?.keyVisual?.imageTone),
        illustrationStyle: str(o?.keyVisual?.illustrationStyle),
        backgroundPattern: str(o?.keyVisual?.backgroundPattern),
        decorativeElements: str(o?.keyVisual?.decorativeElements),
      },
      pages,
    };
  });

  const selectedIds = analysis.pages
    .filter((p) => p.selected)
    .map((p) => p.pageId);

  return {
    projectTitle: analysis.title,
    options,
    outputSelection: {
      visualRepresentativePageId: representative.visualPageId,
      contentRepresentativePageId: representative.contentPageId,
      // 대표 2종을 제외한 나머지 선택 페이지 = 서브 후보 (기본 전부 포함)
      includedSubPageIds: selectedIds.filter(
        (id) =>
          id !== representative.visualPageId &&
          id !== representative.contentPageId,
      ),
      outputPreset: "proposal",
    },
  };
}
