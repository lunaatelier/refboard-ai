// 컨셉 타입 (Phase 4) — Concept JSON = 단일 원천(SSoT). data-model.md §6이 기준.
// HTML/PPT/PDF/디자인 MD 모든 산출물은 이 JSON 하나에서 파생된다.

import type {
  ContentType,
  LayoutPattern,
  ProjectAnalysis,
  ProjectDirective,
} from "../analysis/types";
import type {
  ConfirmedReferenceBrief,
  MoodImage,
  Palette,
} from "../reference/types";
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
  // 서버 계약에는 없다 — 클라이언트가 "컨셉 3안 생성" 응답을 받을 때마다 1회
  // 새로 발급해 붙인다(P1 item12 보완). 같은 브리프로 다시 생성해도 매번 새
  // 값이라, briefHash만으로는 구분 못 하는 "동일 입력 재생성"까지 구분해낸다.
  generationId?: string;
}

// React의 setState처럼 "현재 값을 함수로 받아 다음 값을 반환"하는 형태도 허용한다.
// 온디맨드 콘텐츠 매핑(§6.7, P1 item12)처럼 await 이후 onChange를 호출하는 지점이
// 요청 시작 시점의 스냅샷이 아니라 flush 시점의 최신 concept을 기준으로 병합하게
// 하기 위함 — lib/reference/types.ts의 ReferenceResultUpdater와 같은 이유
// (§2.9/§6.5 — 늦게 도착한 응답이 그 사이 재생성된 컨셉을 덮어쓰는 문제 방지).
export type ConceptJsonUpdater = ConceptJson | ((prev: ConceptJson) => ConceptJson);

// Gemini 프롬프트에 실제로 들어가는 내용의 형태(내부 문서화·해시 계산용) —
// buildSafeConceptAnalysisInput()의 출력. 클라이언트→서버는 같은 신뢰 경계라
// ConceptRequest.analysis는 전체 ProjectAnalysis를 받는다(아래) — normalizeConcept의
// 위조 pageId/sectionId 필터링은 분석 결과 전체 목록이 있어야 가능하다. "외부
// 전송 금지"(§3.6)는 Gemini(외부 API)로 나가는 내용에 적용되는 것이지, 클라이언트→
// 자사 서버 요청에는 적용되지 않는다.
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
  // 기존 콘텐츠 변형 — 이미 마스킹된 요약이라 안전 DTO에 포함해도 된다(§6.7).
  existingContentVariants?: Array<{
    variantId: string;
    label: string;
    contentSummary: string;
  }>;
}

export interface ConceptRequest {
  analysis: ProjectAnalysis;
  directives: ProjectDirective[];
  referenceBrief: ConfirmedReferenceBrief;
  representative: RepresentativePages;
  // 콘텐츠 변형이 있을 때 구조 3안 생성에 쓸 기준 변형. 기존 useVariants(1:1 매핑
  // 플래그)는 폐기 — §6.7 온디맨드 규칙 참고.
  baseContentVariantId?: string;
}

// 온디맨드 콘텐츠 매핑 전용 — 구조 3안 생성 API와 별도 경량 요청(§6.7).
// uiStructure/keyVisual/designBasis/layoutPattern은 이미 확정된 pages로 넘겨
// "재사용"하고, 서버는 contentMapping.maskedContent만 다시 쓴다.
export interface ContentVariantMappingRequest {
  analysis: ProjectAnalysis;
  directives?: ProjectDirective[];
  contentVariantId: string;
  pages: ConceptPage[];
}

// 캐시 키 개념: conceptOptionId + contentVariantId + generationId. 실제로는 결과를
// ConceptOption.contentVariantMappings[contentVariantId]에 저장하므로(옵션으로
// 이미 스코프됨), 컨셉 전체가 재생성되면(같은 브리프로 다시 생성해도 generationId는
// 매번 새로 발급된다) contentVariantMappings도 통째로 교체돼 자연히 무효화된다 —
// 별도 캐시 저장소를 두지 않는다. 단, "요청 시작 ~ 응답 도착" 사이에 재생성이
// 끼어드는 경우까지는 이 구조적 교체만으로 막을 수 없어(응답이 함수형 onChange로
// 늦게 병합될 때는 이미 새 컨셉이 들어와 있음) generationId를 요청 시점에 같이
// 캡처해 응답 병합 시점에 비교한다(ConceptWorkspace.tsx의 isStaleContentVariantResult).

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
  // key: contentVariantId — 온디맨드로 생성한 비기준 변형의 페이지만 누적(§6.7).
  // promptVersion을 함께 저장해, 배포로 콘텐츠 변형 프롬프트가 바뀐 뒤 IndexedDB에서
  // 복구된 옛 매핑을 새 프롬프트 버전 없이 그대로 재사용하지 않게 한다.
  contentVariantMappings?: Record<string, { pages: ConceptPage[]; promptVersion: string }>;
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
  // 아래 둘은 P9-B에서 추가됐다. optional인 이유: 이전에 생성된 ConceptJson(구버전
  // 픽스처·저장 데이터)에는 없다 — 렌더러는 없으면 빈 배열로 취급한다.
  moodImages?: MoodImage[]; // 확정 브리프에서 선택한 무드 이미지 (프리뷰 히어로에 사용)
  avoidDirections?: string[]; // 확정 브리프의 금지 방향
}

// 구버전 테스트/렌더러 import 호환용 별칭. 이제 ConceptOption 자체가 designBasis를 가진다.
export type ConceptOptionWithDesignBasis = ConceptOption;
export type ConceptJsonWithDesignBasis = ConceptJson;
