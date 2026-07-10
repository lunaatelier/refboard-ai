// 컨셉 타입 (Phase 4) — Concept JSON = 단일 원천(SSoT). data-model.md §6이 기준.
// HTML/PPT/PDF/디자인 MD 모든 산출물은 이 JSON 하나에서 파생된다.

import type { ContentType, LayoutPattern } from "../analysis/types";
import type { Palette } from "../reference/types";

export type OutputPreset = "summary" | "proposal" | "detailed";

export interface ConceptJson {
  projectTitle: string;
  options: ConceptOption[]; // 3안
  outputSelection: ConceptOutputSelection;
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
  basedOnVariantLabel?: string; // 기존 변형 1:1 매핑 시 (실사용#24)
  conceptKeywords: ConceptAxis[]; // 3축 컨셉서
  uiStructure: UiStructure;
  keyVisual: KeyVisual;
  pages: ConceptPage[];
  // 웹+모바일 별도 산출물 요구 대응 (실사용#25). 미지정 시 pages = 웹 단일 세트.
  platforms?: { web?: ConceptPage[]; mobile?: ConceptPage[] };
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

// data-model.md §6/§12 DesignBasis — 컨셉 확정 시점에 Phase 3(ReferenceResult)에서
// 선택된 팔레트·무드·타이포 방향을 ConceptOption 안에 스냅샷으로 굳힌 것.
// Phase 5(디자인 MD 렌더러)가 ConceptJson 하나만 읽고도 colors.semantic 등을 채우게 하는 근거.
//
// ⚠️ 아직 실제 ConceptOption(위)에는 없다 — Phase 4 컨셉 생성(app/api/concept/route.ts,
// normalize.ts)이 ReferenceResult.selectedPalette/globalMood를 스냅샷으로 채워 넣는 배선은
// 별도 작업이다(design-system-schema.md §12 "제품 A 측 반영 필요" 액션). 그 전까지 Phase 5
// 렌더러 입력 계약으로 이 타입을 쓴다 — lib/concept/mockConceptJson.ts가 fixture로 사용.
export interface DesignBasis {
  palette: Palette;
  moodKeywords: string[];
  typographyDirection: string;
}

export type ConceptOptionWithDesignBasis = ConceptOption & {
  designBasis: DesignBasis;
};

export type ConceptJsonWithDesignBasis = Omit<ConceptJson, "options"> & {
  options: ConceptOptionWithDesignBasis[];
};
