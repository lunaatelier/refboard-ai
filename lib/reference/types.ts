// 레퍼런스 타입 (Phase 3) — data-model.md §5가 단일 기준.
// Step 10-a: 팔레트·무드 / 10-b: 섹션별 레퍼런스 / 10-c: 분석 대상 브랜드 순으로 채운다.

// 팔레트 = 색(1층) + 역할 매핑(2층). 색은 유지한 채 역할 배치만 재배치 가능
// → "색은 좋은데 배치 틀림" 해결 (flow-spec ④).
export interface Palette {
  mode: "light" | "dark";
  primary: string; // 강조·주요 액션
  secondary: string;
  accent: string; // 포인트·CTA
  background: string;
  surface: string; // 카드·패널 배경
  text: string;
  navigation: string; // LNB/GNB 배경 (별도 역할)
}

export type PaletteRole = Exclude<keyof Palette, "mode">;

// 컬러 후보 3세트 — 브랜드컬러 있으면 그 변주, 없으면 신뢰형/혁신형/미니멀형
export interface PaletteOption {
  optionId: string;
  label: string;
  light: Palette;
  dark: Palette;
}

export interface MoodImage {
  url: string;
  source: "unsplash" | "pexels";
  attribution: string;
}

// 무드 후보 (Gemini 생성, 3종 제시 → 선택)
export interface MoodOption {
  id: string;
  label: string; // "신뢰의 블루"
  keywords: string[]; // "신뢰감 있는", "혁신적인" ...
  description: string;
  imageQuery: string; // Unsplash/Pexels 검색어 (영어)
  styleAttributes: {
    radius: "sharp" | "soft";
    density: "compact" | "airy";
    contrast: "high" | "soft";
    typographyNote: string;
  };
}

export interface MoodBoard {
  keywords: string[];
  description: string;
  images: MoodImage[];
}

export interface ReferenceQuery {
  platform: string; // Dribbble, Behance, Mobbin ...
  query: string; // 플랫폼 강점에 매핑된 검색어
  mode: "auto-search" | "copy-keyword";
  url?: string; // auto-search일 때 검색 이동 URL
}

// 레퍼런스 항목 (Step 10, data-model §5) — 문서형 레퍼런스는 저작권 민감 → usage/license 구분.
// 크롤러를 쓰지 않으므로(CLAUDE.md §7) 항목은 사용자가 플랫폼 검색에서 찾은 URL을 직접 붙여 수집한다.
export interface ReferenceItem {
  platform: string; // URL에서 자동 인식 (등록 플랫폼 매칭, 아니면 호스트명)
  title?: string;
  sourceUrl: string;
  usage: "inspiration-only" | "embeddable"; // 참고만(기본·안전) / 산출물 삽입 가능
  licenseNote?: string; // embeddable일 때 라이선스 확인 근거 기록 권장
  thumbnail?: string;
}

// 섹션별 결정 (Step 10-b)
export interface SectionReference {
  sectionId: string;
  layoutPattern: string; // 사용자 선택 확정
  searchQuery: string; // 이 섹션의 대표 검색어 (Gemini 생성, 편집 가능)
  platformQueries: ReferenceQuery[];
  references?: ReferenceItem[]; // 수집한 레퍼런스 (usage/권리 포함)
  images?: MoodImage[]; // 이 섹션 검색어로 가져온 레퍼런스 이미지 (전역 무드보드와 별개)
}

// 분석 대상 브랜드 (Step 10-c) — 경쟁사·롤모델·벤치마킹 브랜드·공개 투자사 포함.
// 소스 3갈래: 설계서 자동추출(spec) / 사용자 직접입력(manual) / Gemini 추천(gemini).
export type AnalysisTargetSource = "spec" | "manual" | "gemini";

// 1단계(넓게 훑기) 목록 항목 — 가벼움
export interface AnalysisTargetListItem {
  id: string;
  name: string; // 공개 정보라 실명 저장 OK
  url: string;
  source: AnalysisTargetSource;
  oneLineSummary: string;
  analysisStatus: "listed" | "analyzing" | "analyzed";
  adopted: boolean; // 분석됨 ≠ 채택
}

// 2단계(깊게) 분석 결과 — 7개 축
export interface AnalysisTargetAnalysis {
  id: string; // AnalysisTargetListItem.id 계승
  name: string;
  depth: "deep"; // very-deep(스크린샷 멀티모달)은 스크린샷 API 도입 후
  layoutStrategy: string; // 1. 레이아웃 전략
  colorVisualStrategy: string; // 2. 컬러·비주얼 전략
  componentPattern: string; // 3. 컴포넌트 패턴
  painPoints: string[]; // 4. 페인포인트
  wowPoints: string[]; // 5. 와우포인트
  estimatedIntent: string; // 6. 추정 의도
  implications: string; // 7. 우리 프로젝트 시사점
  sourceUrl: string; // grounding 출처 (환각 방지)
  confidence: "추천"; // 확정 아님 — "추정 포함, 확인 필요"
  analyzedAt: string; // 캐시용 ("N일 전 분석" 표시)
}

// 이미지 힌트 (Step 11 + Step 19) — 프롬프트+타입 표출 기본, 키 설정 시 실제 생성까지.
export interface ImageHint {
  area: string; // 적용 영역 (예: "표지 키비주얼", "연혁 섹션")
  scale: "hero" | "section" | "icon"; // 표지급 / 섹션 삽화 / 아이콘
  prompt: string; // 이미지 생성 프롬프트 (영어 — 다른 도구에 바로 사용 가능)
  direction: string; // 일러스트/3D/사진 방향
  aspectRatio?: string;
  // 원본 이미지 참고 금지 플래그 (실사용#20 — 제안서 템플릿 케이스)
  sourceReferenceMode: "use-source-image" | "text-only-ignore-source";
  generatedImageUrl?: string; // Step 19 — NVIDIA NIM 생성 결과 (data URL)
}

// 대표 페이지 추천 (Step 11) — "표지 ≠ 대표" 2종 분리. Phase 4 ConceptOutputSelection의 씨앗.
export interface RepresentativePages {
  visualPageId?: string; // 시각 대표 (보통 cover — 첫인상·키비주얼)
  contentPageId?: string; // 내용 대표 (content/metrics — 정보구조가 드러나는 페이지)
}

// ── 확정 결정 계약 (개선 지시서 §6, data-model.md §5.1이 단일 기준) ──
// ReferenceResult(위)는 편집 중인 작업 상태. 사용자가 실제로 채택한 결정만
// 남긴 불변 스냅샷(ConfirmedReferenceBrief)은 별도로 둔다 — 미선택 검색
// 결과·미채택 분석이 컨셉 생성에 섞이지 않게 하기 위함.

export type AdoptionStatus = "applied" | "reference-only" | "excluded";
export type AdoptionAspect =
  | "layout"
  | "color"
  | "typography"
  | "image-tone"
  | "interaction"
  | "content-density";
export type SectionReferencePriority = "high-impact" | "inherited" | "optional";
export type DecisionSource = "user" | "inherited" | "ai";
export type Freshness = "current" | "stale";

// 채택 카드 출처. usage는 항상 inspiration-only — 산출물에 자동 삽입하지 않는다.
export interface ReferenceCandidate {
  provider: "inspo" | "manual";
  providerId?: string;
  title?: string;
  sourceUrl: string;
  thumbnailUrl?: string;
  patterns: string[];
  colors: string[];
  usage: "inspiration-only";
  fetchedAt: string;
}

export interface DecisionMeta {
  source: DecisionSource;
  freshness: Freshness;
  basedOnHash: string;
}

export interface WorkflowRevision {
  analysisHash: string;
  directionHash?: string;
  briefHash?: string;
  promptVersion: string;
}

export interface ReferenceAdoption {
  adoptionId: string;
  pageId: string;
  sectionId: string;
  reference: ReferenceCandidate;
  status: AdoptionStatus;
  aspects: AdoptionAspect[];
  note: string;
  decision: DecisionMeta;
}

export interface DirectionOption {
  directionId: string;
  label: string;
  paletteOptionId: string;
  moodOptionId: string;
  imageCandidates: MoodImage[];
  selectedImageUrls: string[];
  avoidDirections: string[];
}

// 브랜드 분석 출처 검증 (P6) — 모델이 JSON에 쓴 sourceUrl 문자열을 그대로 신뢰하지 않는다.
export interface VerifiedSource {
  url: string;
  status: "official" | "supporting" | "unverified";
  groundingCited: boolean;
  domainVerified: boolean;
  fetchedAt: string;
}

export interface BrandDecision {
  targetId: string;
  name: string;
  adoptedPatterns: string[];
  avoidedPatterns: string[];
  verifiedSources: VerifiedSource[];
}

// 이미지 생성 결과의 data URL을 워크플로 JSON에 직접 넣지 않는다 — assetId만 보유,
// 실제 바이너리는 별도 Blob store(IndexedDB)에 둔다.
export interface ImageNeedDecision {
  required: boolean;
  role: "hero" | "section" | "icon";
  prompt?: string;
  generatedImageAssetId?: string;
}

export interface PageReferenceDecision {
  pageId: string;
  pageTitle: string;
  purposeSummary: string;
  sections: Array<{
    sectionId: string;
    sectionTitle: string;
    priority: SectionReferencePriority;
    layoutPattern: string;
    decision: DecisionMeta;
    adoptions: ReferenceAdoption[];
    imageNeed?: ImageNeedDecision;
  }>;
}

export interface ConfirmedReferenceBrief {
  version: "2.0";
  confirmedAt: string;
  revision: WorkflowRevision;
  direction: {
    paletteOptionId: string; // 최초 후보의 출처
    editedPaletteOption: PaletteOption; // 역할 재배치 편집 결과
    paletteMode: "light" | "dark"; // 확정한 기본 모드
    moodId: string;
    moodKeywords: string[];
    typographyDirection: string;
    selectedMoodImages: MoodImage[];
    styleAttributes: MoodOption["styleAttributes"];
    avoidDirections: string[];
  };
  pages: PageReferenceDecision[];
  brandDecisions: BrandDecision[];
}

// Phase 3 결과 — 프로젝트 전체 결정(팔레트/무드)은 위, 섹션별은 bySectionId(10-b).
// 진행 중 단계별로 채워지므로 필드는 optional로 열어둔다.
export interface ReferenceResult {
  paletteOptions?: PaletteOption[];
  // "이 컬러로 3세트 재생성"에 쓴 키 컬러 — 카드별 개별 재생성 때 같은 브랜드 기준으로 재사용.
  paletteBrandHex?: string;
  // 선택한 옵션의 편집본 (역할 재배치 반영). selectedPalette = editedOption[mode].
  editedPaletteOption?: PaletteOption;
  paletteMode?: "light" | "dark";
  moodOptions?: MoodOption[];
  selectedMoodId?: string;
  globalMood?: MoodBoard; // 선택 무드 + 이미지
  bySectionId?: Record<string, SectionReference>; // 섹션별 (Step 10-b)
  analysisTargetList?: AnalysisTargetListItem[]; // 1단계 목록 (누적, 사라지지 않음)
  targetAnalyses?: Record<string, AnalysisTargetAnalysis>; // id → 깊은 분석 (누적)
  imageHints?: ImageHint[]; // Step 11
  representative?: RepresentativePages; // Step 11 (Phase 4에서 계승)
  referenceConfirmed?: boolean; // ④ 전체 확정 (Step 10-c)
  // ── 확정 결정 계약 (P1) ──
  directionOptions?: DirectionOption[];
  selectedDirectionId?: string;
  referenceAdoptions?: Record<string, ReferenceAdoption>; // key: adoptionId
  selectedMoodImageUrls?: string[];
  avoidDirections?: string[];
  confirmedBrief?: ConfirmedReferenceBrief;
  revision?: WorkflowRevision; // 마이그레이션 기간 optional — confirmBrief가 생성 시 채운다
  baseContentVariantId?: string; // 콘텐츠 변형이 2개 이상일 때 사용자가 고른 기준 변형(§6.7)
}
