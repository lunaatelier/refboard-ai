// 컨셉 타입 (Phase 4) — Concept JSON = 단일 원천(SSoT). data-model.md §6이 기준.
// HTML/PPT/PDF/디자인 MD 모든 산출물은 이 JSON 하나에서 파생된다.

import type { ContentType, LayoutPattern, ProjectDirective } from "../analysis/types";
import type { ConfirmedReferenceBrief, Palette } from "../reference/types";
import type { RepresentativePages } from "../reference/types";

export type OutputPreset = "summary" | "proposal" | "detailed";

export interface ConceptJson {
  projectTitle: string;
  // 없으면 구버전(sourceBasis 없음)으로 취급 — 타입을 나누지 않고 필드로만 구분(P0 결정).
  version?: "2.0";
  // 타입은 optional이지만, 컨셉 생성 builder는 version "2.0" 결과에서 이 필드를 필수로 강제한다.
  sourceBasis?: ConfirmedReferenceBrief;
  options: ConceptOption[]; // 3안
  outputSelection: ConceptOutputSelection;
  baseContentVariantId?: string; // 콘텐츠 변형이 있을 때 구조 3안 생성에 쓴 기준 변형(§6.7)
}

// ConceptRequest.analysis에 들어가는 안전 파생 DTO. ProjectAnalysis 전체를
// 그대로 전달하지 않는다 — 선택 페이지·확정 섹션의 마스킹 콘텐츠만 포함.
export interface SafeConceptAnalysisInput {
  title: string;
  description: string;
  domain: string;
  businessDomains?: string[];
  projectType: string;
  targetUser: string;
  pages: Array<{
    pageId: string;
    pageTitle: string;
    sections: Array<{
      sectionId: string;
      sectionTitle: string;
      contentType: string;
      maskedContent: string;
    }>;
  }>;
}

export interface ConceptRequest {
  analysis: SafeConceptAnalysisInput;
  directives: ProjectDirective[];
  referenceBrief: ConfirmedReferenceBrief;
  representative: RepresentativePages;
  // 콘텐츠 변형이 있을 때 구조 3안 생성에 쓸 기준 변형. 기존 useVariants(1:1 매핑
  // 플래그)는 폐기 — §6.7 온디맨드 규칙 참고.
  baseContentVariantId?: string;
}

// 온디맨드 콘텐츠 매핑 전용 — 구조 3안 생성 API와 별도 경량 요청(§6.7).
export interface ContentVariantMappingRequest {
  conceptOptionId: string;
  contentVariantId: string;
  briefHash: string; // 캐시 키의 일부 — 동일 조합 재요청 시 API를 재호출하지 않는다
}

// 표지(비주얼 대표)와 내용 대표를 분리 — "표지 ≠ 대표" (Step 11 계승)
export interface ConceptOutputSelection {
  visualRepresentativePageId?: string;
  contentRepresentativePageId?: string;
  includedSubPageIds: string[]; // 컨셉서에 넣을 서브 (체크박스)
  outputPreset: OutputPreset;
}

export interface ConceptOption {
  optionId: string;
  label: string; // "A안 — 신뢰의 블루" (비교 UI용)
  // 구조 3안 생성에 쓴 "기준" 콘텐츠 변형 라벨 (§6.7 — 기존 1:1 매핑 용도에서 의미 재정의)
  basedOnVariantLabel?: string;
  designBasis: DesignBasis; // Phase 3 확정 팔레트·무드·타이포 방향 스냅샷
  conceptKeywords: ConceptAxis[]; // 3축 컨셉서
  uiStructure: UiStructure;
  keyVisual: KeyVisual;
  pages: ConceptPage[];
  // 웹+모바일 별도 산출물 요구 대응 (실사용#25). 미지정 시 pages = 웹 단일 세트.
  platforms?: { web?: ConceptPage[]; mobile?: ConceptPage[] };
  // key: contentVariantId — 온디맨드로 생성한 비기준 변형의 페이지만 누적(§6.7)
  contentVariantMappings?: Record<string, ConceptPage[]>;
}

export interface ConceptAxis {
  no: string; // "01"
  title: string; // "사용성 (Usability)"
  category: string; // "UX Strategy | 사용자 경험 중심"
  description: string;
}

export interface UiStructure {
  mode: "dark" | "light";
  navPosition: "top" | "left";
  infoStructure: string;
  layoutConcept: string;
}

export interface KeyVisual {
  imageTone: string;
  illustrationStyle: string; // 일러스트/3D/사진
  backgroundPattern: string;
  decorativeElements: string;
}

export interface ConceptPage {
  pageId: string; // Phase 2 Page.pageId 계승
  pageTitle: string;
  sections: ConceptSection[];
}

export interface ConceptSection {
  sectionId: string; // Phase 2의 sectionId 계승 (추적 키)
  sectionTitle: string;
  contentType: ContentType;
  layoutPattern: LayoutPattern;
  contentMapping: ContentMapping;
}

export interface ContentMapping {
  maskedContent: string; // ✅ 저장은 마스킹본만. 실명 복원본은 렌더 시점에만 생성.
  sourceSectionId: string;
  targetArea: string; // "hero-title" | "feature-card" | "timeline" | "table" | ...
}

// data-model.md §6/§12 DesignBasis — 컨셉 생성 시점에 Phase 3(ReferenceResult)에서
// 선택된 팔레트·무드·타이포 방향을 ConceptOption 안에 스냅샷으로 굳힌 것.
// Phase 5(디자인 MD 렌더러)가 ConceptJson 하나만 읽고도 colors.semantic 등을 채우게 하는 근거.
export interface DesignBasis {
  palette: Palette;
  moodKeywords: string[];
  typographyDirection: string;
}

// 구버전 테스트/렌더러 import 호환용 별칭. 이제 ConceptOption 자체가 designBasis를 가진다.
export type ConceptOptionWithDesignBasis = ConceptOption;
export type ConceptJsonWithDesignBasis = ConceptJson;
