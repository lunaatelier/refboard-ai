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
  return { axis: "pattern", label: `레이아웃 · ${label}`, query };
}

function moodIntent(direction: DirectionOption): SectionQueryIntent {
  const query = direction.keywords.slice(0, 2).join(" ").trim() || direction.label;
  return { axis: "mood", label: `분위기 · ${direction.label}`, query };
}

function industryIntent(analysis: ProjectAnalysis): SectionQueryIntent {
  const formatQuery = DOMAIN_DESIGN_QUERY[analysis.domain] ?? DOMAIN_DESIGN_QUERY.generic;
  // 레이아웃 용어만 검색되는 문제를 피하려고, 분석 태그 중 영문 키워드(VLM, AI,
  // SaaS 등)를 우선 결합한다. 영문 태그가 없으면 사용자가 확인한 업무 영역을 쓴다.
  const englishContext = analysis.tags
    .filter((tag) => /^[\x20-\x7E]+$/.test(tag.trim()))
    .slice(0, 2)
    .join(" ")
    .trim();
  const businessContext = analysis.businessDomains?.slice(0, 2).join(" ").trim() ?? "";
  const context = englishContext || businessContext;
  const query = [context, formatQuery].filter(Boolean).join(" ");
  const label = businessContext
    ? `서비스 분야 · ${businessContext}`
    : `서비스 분야 · ${context || formatQuery}`;
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
  const industry = industryIntent(analysis);
  const designIntents: SectionQueryIntent[] = [
    // 첫 화면에서는 배치 방식만 보여주는 pattern보다 프로젝트 내용이 들어간
    // 서비스 분야 검색을 기본값으로 사용한다.
    industry,
    pattern,
    ...(direction ? [moodIntent(direction)] : []),
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
