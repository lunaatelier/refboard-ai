import type {
  DomainHint,
  Page,
  PageRole,
  ProjectAnalysis,
  Section,
} from "./types";

// Gemini 응답(느슨한 JSON)을 ProjectAnalysis로 정규화 — isomorphic 순수 함수.
// ID 부여, enum 보정, 기본 선택(최대 5페이지), 섹션 status=candidate.

const DOMAINS: DomainHint[] = [
  "marketing-web",
  "dashboard-ops",
  "mobile-app",
  "document",
  "generic",
];

const PAGE_ROLES: PageRole[] = [
  "cover",
  "section-divider",
  "content",
  "case-study",
  "metrics",
  "team",
  "appendix",
  "contact",
];

/* eslint-disable @typescript-eslint/no-explicit-any */
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function numArray(v: unknown): number[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const nums = v.filter((x): x is number => typeof x === "number");
  return nums.length > 0 ? nums : undefined;
}

export const MAX_SELECTED_PAGES = 5;

export function normalizeAnalysis(raw: any): ProjectAnalysis {
  const rawPages: any[] = Array.isArray(raw?.pages) ? raw.pages : [];

  const pages: Page[] = rawPages.map((p, pi) => {
    const rawSections: any[] = Array.isArray(p?.sections) ? p.sections : [];
    const sections: Section[] = rawSections.map((s, si) => ({
      sectionId: `p${pi + 1}-s${si + 1}`,
      sectionTitle: str(s?.sectionTitle, `섹션 ${si + 1}`),
      contentSummary: str(s?.contentSummary),
      contentType: str(s?.contentType, "content"),
      recommendedLayout: str(s?.recommendedLayout, "card-grid"),
      sourceSlides: numArray(s?.sourceSlides),
      ...(str(s?.sourceDocumentId) ? { sourceDocumentId: str(s.sourceDocumentId) } : {}),
      confidence: Math.min(1, Math.max(0, num(s?.confidence, 0.5))),
      status: "candidate" as const,
      ...(strArray(s?.unresolvedNotes).length > 0
        ? { unresolvedNotes: strArray(s.unresolvedNotes) }
        : {}),
    }));

    const role = str(p?.pageRole) as PageRole;
    return {
      pageId: `p${pi + 1}`,
      pageTitle: str(p?.pageTitle, `페이지 ${pi + 1}`),
      pageRole: PAGE_ROLES.includes(role) ? role : "content",
      sourceSlides: numArray(p?.sourceSlides),
      ...(str(p?.sourceDocumentId) ? { sourceDocumentId: str(p.sourceDocumentId) } : {}),
      selected: pi < MAX_SELECTED_PAGES,
      sections,
    };
  });

  const domain = str(raw?.domain) as DomainHint;

  return {
    title: str(raw?.title, "제목 없음"),
    description: str(raw?.description),
    domain: DOMAINS.includes(domain) ? domain : "generic",
    domainConfidence: Math.min(1, Math.max(0, num(raw?.domainConfidence, 0.5))),
    targetUser: str(raw?.targetUser),
    tags: strArray(raw?.tags),
    projectType: str(raw?.projectType, "미분류"),
    ...(strArray(raw?.brandColors).length > 0
      ? { brandColors: strArray(raw.brandColors) }
      : {}),
    pages,
    existingContentVariants: (Array.isArray(raw?.existingContentVariants)
      ? raw.existingContentVariants
      : []
    ).map((v: any, i: number) => ({
      variantId: `var-${i + 1}`,
      label: str(v?.label, `변형 ${i + 1}`),
      sourceSlides: numArray(v?.sourceSlides),
      contentSummary: str(v?.contentSummary),
    })),
    detectedCaseStudies: (Array.isArray(raw?.detectedCaseStudies)
      ? raw.detectedCaseStudies
      : []
    ).map((c: any) => ({
      name: str(c?.name),
      sourceSlides: numArray(c?.sourceSlides),
      extractedNote: str(c?.extractedNote),
      sourceUrls: strArray(c?.sourceUrls),
    })),
  };
}
