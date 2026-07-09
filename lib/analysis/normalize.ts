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

// 배경/테마 색을 브랜드 컬러로 오인하는 걸 막는 2차 방어선. Gemini 프롬프트가
// "브랜드 컬러 언급이 있을 때만"이라고만 지시해도, 문서에 유일하게 등장하는
// hex가 "배경: #0f172a"처럼 배경/테마 설명에 붙은 것일 수 있다 — 이 경우 원문
// 문맥(sourceText)에서 hex 주변 라벨을 재검사해 배경/테마 전용 언급이면 제외한다.
// (palette.ts의 무채색 시드 필터와는 별개 지점 — 여기서 걸러지지 않으면
// palette.ts가 "짙은 남색"처럼 채도는 있지만 명도가 낮은 색을 그대로 시드로 받는다.)
const BACKGROUND_LABEL_PATTERN =
  /(배경|바탕|테마|다크\s*모드|톤\s*앤\s*매너|background|theme|dark\s*mode)/i;
const BRAND_LABEL_PATTERN =
  /(브랜드|로고|아이덴티티|시그니처|brand|logo|identity|corporate identity|\bci\b)/i;
const HEX_CONTEXT_WINDOW = 40;

function isBackgroundOnlyMention(hex: string, sourceText: string): boolean {
  const digits = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(digits)) return false;
  const re = new RegExp(`#?${digits}`, "gi");
  let match: RegExpExecArray | null;
  let sawMention = false;
  while ((match = re.exec(sourceText))) {
    sawMention = true;
    const windowStart = Math.max(0, match.index - HEX_CONTEXT_WINDOW);
    const context = sourceText.slice(windowStart, match.index);
    const isBackground = BACKGROUND_LABEL_PATTERN.test(context);
    const isBrand = BRAND_LABEL_PATTERN.test(context);
    // 이 등장 위치가 배경 라벨이 아니거나, 더 가까이 브랜드 라벨이 있으면
    // 이 hex는 최소 한 번은 "진짜 브랜드 컬러"로 쓰인 것 → 유지.
    if (!isBackground || isBrand) return false;
  }
  // 문서에서 아예 찾을 수 없으면(형식 차이 등) 보수적으로 유지한다.
  return sawMention;
}

// Gemini가 반환한 brandColors 후보 중 "배경/테마" 설명에서만 등장한 색을 제거.
export function filterBrandColorCandidates(
  colors: string[],
  sourceText: string,
): string[] {
  if (!sourceText) return colors;
  return colors.filter((c) => !isBackgroundOnlyMention(c, sourceText));
}

export function normalizeAnalysis(raw: any, sourceText = ""): ProjectAnalysis {
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
    ...(() => {
      const brandColors = filterBrandColorCandidates(
        strArray(raw?.brandColors),
        sourceText,
      );
      return brandColors.length > 0 ? { brandColors } : {};
    })(),
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
    // 부모-자식 사이트 관계 (실사용#31) — AI 후보는 항상 confirmed: false로 시작.
    // 사용자가 분석 결과 화면에서 확정해야만 레퍼런스 검색에 반영된다.
    ...(str(raw?.parentSiteRelation?.relationNote)
      ? {
          parentSiteRelation: {
            relationNote: str(raw.parentSiteRelation.relationNote),
            confirmed: false,
          },
        }
      : {}),
  };
}
