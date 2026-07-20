import type { DomainHint, ProjectAnalysis, Section } from "../analysis/types";
import type { DirectionOption } from "./types";
import { humanizeSlug } from "../analysis/normalize";

// 섹션 검색어 3축 로컬 생성기 (P4-1) — AI 호출 없이 즉시 계산한다(§3.4 결정론적
// 조합 우선). 기존 /api/section-queries(Gemini)는 이 기본값 위에 얹는 선택적
// "AI로 다듬기" 단계로 역할이 바뀐다(개선 지시서 P4).

export type SectionQueryAxis = "pattern" | "mood" | "industry";

export interface SectionQueryIntent {
  axis: SectionQueryAxis;
  label: string;
  query: string;
}

export interface SectionQuerySet {
  designIntents: SectionQueryIntent[];
  imageQueries: string[];
}

// 사진 API(Unsplash/Pexels)로 보내는 검색어에는 화면/레이아웃 용어가 섞이면
// 안 된다(P4 완료 기준) — 디자인 검색어(패턴축)는 이 단어를 포함해도 되지만
// 이미지 검색어를 만들 때는 반드시 걸러낸다.
const UI_TERM_BLOCKLIST =
  /\b(hero|section|card|grid|layout|website|page|dashboard)\b/gi;

export function stripUiTerms(text: string): string {
  return text.replace(UI_TERM_BLOCKLIST, " ").replace(/\s+/g, " ").trim();
}

const DOMAIN_DESIGN_QUERY: Record<DomainHint, string> = {
  "marketing-web": "corporate website",
  "dashboard-ops": "dashboard ui",
  "mobile-app": "mobile app ui",
  document: "business presentation",
  generic: "product website",
};

// 업종축의 사진 검색어 — 위 디자인 검색어는 UI 용어를 포함해 사진 API에 못
// 쓰므로, 실제로 촬영 가능한 장면으로 별도 매핑한다.
const DOMAIN_IMAGE_SUBJECT: Record<DomainHint, string> = {
  "marketing-web": "modern office team",
  "dashboard-ops": "control room monitors",
  "mobile-app": "person using smartphone",
  document: "business meeting presentation",
  generic: "modern workspace",
};

function patternIntent(section: Section): SectionQueryIntent {
  const slug = section.recommendedLayout || section.contentType || "content";
  const label = section.recommendedLayoutLabel || humanizeSlug(slug);
  const query = slug.replace(/-/g, " ").toLowerCase().trim();
  return { axis: "pattern", label: `패턴 · ${label}`, query };
}

function moodIntent(direction: DirectionOption): SectionQueryIntent {
  const query = direction.keywords.slice(0, 2).join(" ").trim() || direction.label;
  return { axis: "mood", label: `무드 · ${direction.label}`, query };
}

function industryIntent(analysis: ProjectAnalysis): SectionQueryIntent {
  const query = DOMAIN_DESIGN_QUERY[analysis.domain] ?? DOMAIN_DESIGN_QUERY.generic;
  const label = analysis.businessDomains?.[0]
    ? `업종 · ${analysis.businessDomains[0]}`
    : `업종 · ${query}`;
  return { axis: "industry", label, query };
}

// direction이 아직 선택되지 않았으면 무드축은 만들지 않는다(추측 금지) — 나머지
// 두 축(패턴/업종)은 분석 결과만으로 항상 계산 가능하다.
export function buildSectionQuerySet(
  section: Section,
  analysis: ProjectAnalysis,
  direction?: DirectionOption,
): SectionQuerySet {
  const pattern = patternIntent(section);
  const designIntents: SectionQueryIntent[] = [
    pattern,
    ...(direction ? [moodIntent(direction)] : []),
    industryIntent(analysis),
  ];

  const imageCandidates = [
    direction ? stripUiTerms(direction.keywords.join(" ")) : "",
    DOMAIN_IMAGE_SUBJECT[analysis.domain] ?? DOMAIN_IMAGE_SUBJECT.generic,
    stripUiTerms(pattern.query),
  ].filter((q) => q.trim() !== "");

  return {
    designIntents,
    imageQueries: Array.from(new Set(imageCandidates)),
  };
}
