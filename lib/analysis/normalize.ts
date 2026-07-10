import type {
  DomainHint,
  ExplicitRequirement,
  ExplicitRequirementKind,
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

// contentType/recommendedLayout은 열린 유니온이라 코드 내 고정 매핑을 두지 않는다
// (실사용#14) — Gemini가 표시 라벨(contentTypeLabel 등)을 안 주면 이 fallback으로
// kebab-case slug를 사람이 읽는 형태로 바꾼다. normalizeAnalysis뿐 아니라 저장된
// 분석 JSON 재활용(구버전 — 라벨 필드 자체가 없음) 렌더링에도 그대로 쓸 수 있도록
// 렌더 시점(AnalysisResult.tsx)에서 호출한다.
export function humanizeSlug(slug: string): string {
  if (!slug) return slug;
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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

// businessDomain(구버전, string 단일값) → businessDomains(신버전, string[]) 호환 레이어
// (실사용#11). Gemini 응답 파싱(normalizeAnalysis)뿐 아니라 저장된 분석 JSON 재활용
// 경로(lib/state/recycle.ts의 parseAnalysisImport — normalizeAnalysis를 거치지 않고
// 저장된 analysis를 직접 캐스팅함)에서도 반드시 이 함수를 통해 읽어야 구버전 저장
// 파일(businessDomain: string)이 재활용 시 깨지지 않는다.
export function normalizeBusinessDomains(
  raw: { businessDomains?: unknown; businessDomain?: unknown } | null | undefined,
): string[] | undefined {
  const value = raw?.businessDomains;
  const arr = Array.isArray(value)
    ? strArray(value)
    : typeof value === "string" && value
      ? [value]
      : [];
  if (arr.length > 0) return arr;
  const legacy = str(raw?.businessDomain);
  return legacy ? [legacy] : undefined;
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

const REQUIREMENT_KINDS: ExplicitRequirementKind[] = [
  "background-color",
  "mode",
  "layout",
  "other",
];

// Gemini가 반환한 explicitRequirements 원본을 정규화.
function normalizeExplicitRequirements(raw: unknown): ExplicitRequirement[] {
  const list: any[] = Array.isArray(raw) ? raw : [];
  return list
    .map((r) => ({
      kind: REQUIREMENT_KINDS.includes(r?.kind) ? (r.kind as ExplicitRequirementKind) : "other",
      text: str(r?.text),
      ...(str(r?.value) ? { value: str(r.value) } : {}),
      ...(numArray(r?.sourceSlides) ? { sourceSlides: numArray(r.sourceSlides) } : {}),
    }))
    .filter((r) => r.text);
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
      ...(str(s?.contentTypeLabel) ? { contentTypeLabel: str(s.contentTypeLabel) } : {}),
      ...(str(s?.recommendedLayoutLabel)
        ? { recommendedLayoutLabel: str(s.recommendedLayoutLabel) }
        : {}),
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
  const businessDomains = normalizeBusinessDomains(raw);

  // brandColors: 배경/테마 라벨로만 등장한 hex는 여전히 제외한다(순수 브랜드/로고 컬러만).
  // 단, 제외된 색은 "버리지" 않고 explicitRequirements(background-color)로 옮긴다 (게이트 1 정정).
  const rawBrandColors = strArray(raw?.brandColors);
  const keptBrandColors = filterBrandColorCandidates(rawBrandColors, sourceText);
  const droppedBackgroundColors = rawBrandColors.filter(
    (c) => !keptBrandColors.includes(c),
  );

  const explicitRequirements = normalizeExplicitRequirements(raw?.explicitRequirements);
  // 2차 방어선: Gemini가 explicitRequirements로 이미 보고하지 않았다면, brandColors에서
  // 걸러낸 배경색을 자동으로 채워 넣는다 (색 정보 유실 방지).
  const alreadyReported = new Set(
    explicitRequirements
      .filter((r) => r.kind === "background-color" && r.value)
      .map((r) => r.value!.toLowerCase()),
  );
  for (const c of droppedBackgroundColors) {
    if (alreadyReported.has(c.toLowerCase())) continue;
    explicitRequirements.push({
      kind: "background-color",
      text: `배경 색상으로 언급됨 (자동 감지): ${c}`,
      value: c,
    });
  }

  return {
    title: str(raw?.title, "제목 없음"),
    description: str(raw?.description),
    domain: DOMAINS.includes(domain) ? domain : "generic",
    domainConfidence: Math.min(1, Math.max(0, num(raw?.domainConfidence, 0.5))),
    ...(str(raw?.domainConfidenceReason) ? { domainConfidenceReason: str(raw.domainConfidenceReason) } : {}),
    ...(businessDomains ? { businessDomains } : {}),
    targetUser: str(raw?.targetUser),
    tags: strArray(raw?.tags),
    projectType: str(raw?.projectType, "미분류"),
    ...(keptBrandColors.length > 0 ? { brandColors: keptBrandColors } : {}),
    ...(explicitRequirements.length > 0 ? { explicitRequirements } : {}),
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
    // 부모-자식 사이트 관계 (실사용#31) — 읽기 전용 근거로 표시, 사용자가 제외할 수만 있다.
    ...(str(raw?.parentSiteRelation?.relationNote)
      ? {
          parentSiteRelation: {
            relationNote: str(raw.parentSiteRelation.relationNote),
          },
        }
      : {}),
  };
}
