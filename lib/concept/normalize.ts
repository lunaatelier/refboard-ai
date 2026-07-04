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

  // 페이지 배열 정규화 — options.pages와 platforms.web/mobile이 같은 규칙을 공유한다
  // (pageId/sectionId 계보 검증 포함).
  const normalizePages = (rawPages: any[]): ConceptPage[] =>
    rawPages
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

  const rawOptions: any[] = Array.isArray(raw?.options) ? raw.options : [];
  const options: ConceptOption[] = rawOptions.slice(0, 3).map((o, oi) => {
    const pages = normalizePages(Array.isArray(o?.pages) ? o.pages : []);

    // 웹+모바일 별도 세트 (실사용#25) — 유효한 세트가 하나라도 있을 때만 포함
    const webPages = normalizePages(
      Array.isArray(o?.platforms?.web) ? o.platforms.web : [],
    );
    const mobilePages = normalizePages(
      Array.isArray(o?.platforms?.mobile) ? o.platforms.mobile : [],
    );
    const platforms =
      webPages.length > 0 || mobilePages.length > 0
        ? {
            ...(webPages.length > 0 ? { web: webPages } : {}),
            ...(mobilePages.length > 0 ? { mobile: mobilePages } : {}),
          }
        : undefined;

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
      ...(platforms ? { platforms } : {}),
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
