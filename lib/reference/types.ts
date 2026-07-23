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

// (2026-07-23 수정) sourceUrl/usage/fetchedAt 추가 — P10 라이선스·출처 규칙("모든 외부
// 후보에 provider, sourceUrl, usage, fetchedAt을 저장한다")을 ReferenceCandidate만
// 지키고 있었고 무드 이미지(Unsplash/Pexels)는 url(이미지 자산)만 있어 출처 페이지
// 링크·조회 시각이 없었다(외부 리뷰로 지적됨). sourceUrl은 이미지 자산 URL(url)이
// 아니라 provider의 사진 상세 페이지 링크 — Unsplash/Pexels 둘 다 어트리뷰션 시
// 사진 페이지로 링크하도록 요구한다.
export interface MoodImage {
  url: string;
  source: "unsplash" | "pexels";
  attribution: string;
  sourceUrl: string;
  usage: "inspiration-only";
  fetchedAt: string;
}

// 방향 카드 공통 스타일 속성 (P3) — MoodOption.styleAttributes와 DirectionOption이 공유.
export interface DirectionStyleAttributes {
  radius: "sharp" | "soft";
  density: "compact" | "airy";
  contrast: "high" | "soft";
}

// 제목/본문 타이포 샘플 (P3) — 실제 폰트 로딩 없이, 예시 문구+방향 설명으로 표현.
export interface TypographySample {
  sampleText: string; // 렌더링용 한국어 예시 문구
  note: string; // 방향 설명 한 줄 (예: "굵은 산세리프, 타이트한 자간")
}

export interface TypographyDirection {
  title: TypographySample;
  body: TypographySample;
}

// 무드 후보 (Gemini 생성, 3종 제시 → 선택)
export interface MoodOption {
  id: string;
  label: string; // "신뢰의 블루"
  keywords: string[]; // "신뢰감 있는", "혁신적인" ...
  description: string;
  imageQuery: string; // Unsplash/Pexels 검색어 (영어)
  // P3 — 팔레트·무드를 1:1로 묶는다. 3개 무드가 가능한 한 서로 다른 팔레트
  // 후보를 쓰도록 normalizeMoodPaletteAssignment()가 정규화한다.
  paletteOptionId: string;
  typography: TypographyDirection; // P3 — 제목/본문 타이포 샘플
  styleAttributes: DirectionStyleAttributes & {
    typographyNote: string; // 하위 호환 — DesignBasis.typographyDirection이 이 필드를 그대로 씀
  };
  recommendedDirections: string[]; // P3 — 이 무드와 어울리는 방향 조언 (최대 3개)
  avoidDirections: string[]; // P3 — 이 무드와 어울리지 않는 방향 조언 (최대 3개)
}

export interface ReferenceQuery {
  platform: string; // Dribbble, Behance, Mobbin ...
  query: string; // 플랫폼 강점에 매핑된 검색어
  mode: "auto-search" | "copy-keyword";
  url?: string; // auto-search일 때 검색 이동 URL
}

// 수집한 레퍼런스 (Step 10, P5-4) — 문서형 레퍼런스는 저작권 민감 → usage/license 구분.
// 크롤러를 쓰지 않으므로(CLAUDE.md §7) 항목은 사용자가 플랫폼 검색에서 찾은 URL을 직접 붙여 수집한다.
// P5 kickoff 리뷰(§[[refboard-ai-pending-work]]) 결정: 배열 인덱스로 mutate하던 옛
// ReferenceItem[] 대신 안정 id를 가진다 — 채택(ReferenceAdoption) 생성 시 이 id가
// ReferenceCandidate.providerId로 그대로 흘러가 재적용/해제를 안정적으로 추적한다.
// (2026-07-23 수정) provider/fetchedAt 추가 — P10 라이선스·출처 규칙("모든 외부 후보에
// provider, sourceUrl, usage, fetchedAt을 저장한다")을 CollectedReference만 못 지키고
// 있었다(외부 리뷰로 지적됨). 둘 다 optional — 이 필드가 생기기 전 저장된 항목(IndexedDB
// 스냅샷)엔 없으므로, 읽을 때는 아래 resolveCollectedReferenceProvider를 거친다.
export interface CollectedReference {
  id: string; // 안정 식별자 — 배열 위치가 바뀌어도 유지
  platform: string; // URL에서 자동 인식 (등록 플랫폼 매칭, 아니면 호스트명)
  title?: string;
  sourceUrl: string;
  usage: "inspiration-only" | "embeddable"; // 참고만(기본·안전) / 산출물 삽입 가능
  licenseNote?: string; // embeddable일 때 라이선스 확인 근거 기록 권장
  thumbnail?: string;
  provider?: string; // 항상 "manual" — 크롤러 없이 사용자가 URL을 직접 붙여 수집(§7)
  fetchedAt?: string; // 이 항목을 수집(붙여넣기)한 시각
}

// 구버전 데이터(provider 필드 생기기 전)는 platform 값을 provider처럼 취급한다.
export function resolveCollectedReferenceProvider(item: CollectedReference): string {
  return item.provider ?? item.platform;
}

// 섹션별 결정 (Step 10-b)
export interface SectionReference {
  sectionId: string;
  layoutPattern: string; // 사용자 선택 확정
  searchQuery: string; // 이 섹션의 대표 검색어 (Gemini 생성, 편집 가능)
  platformQueries: ReferenceQuery[];
  collectedReferences?: CollectedReference[]; // 수집한 레퍼런스 (usage/권리 포함, 채택 전 원재료)
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
  sourceUrl: string; // 모델이 JSON에 직접 적은 참고용 출처 — 환각 가능, 신뢰 근거로 쓰지 않는다(§3.5)
  // P6 — 실제 Gemini grounding citation + 도메인 관계 + 안전 fetch로 검증한 출처.
  // 구버전 캐시(targetCache)에는 없을 수 있어 optional.
  verifiedSources?: VerifiedSource[];
  confidence: "추천"; // 확정 아님 — "추정 포함, 확인 필요"
  analyzedAt: string; // 캐시용 ("N일 전 분석" 표시)
}

// 이미지 힌트 (Step 11 + Step 19) — 프롬프트+타입 표출 기본, 키 설정 시 실제 생성까지.
export interface ImageHint {
  // sectionKey(pageId, sectionId)(P7) — area 문자열/배열 순서가 아니라 이 키로
  // 섹션과 안정적으로 연결한다. 편집값 보존·개별 재생성·confirmBrief 연결 전부 이 키 기준.
  key: string;
  area: string; // 적용 영역 (예: "표지 키비주얼", "연혁 섹션")
  scale: "hero" | "section" | "icon"; // 표지급 / 섹션 삽화 / 아이콘
  prompt: string; // 이미지 생성 프롬프트 (영어 — 다른 도구에 바로 사용 가능)
  direction: string; // 일러스트/3D/사진 방향
  aspectRatio?: string;
  // 원본 이미지 참고 금지 플래그 (실사용#20 — 제안서 템플릿 케이스)
  sourceReferenceMode: "use-source-image" | "text-only-ignore-source";
  // Step 19 — NVIDIA NIM 생성 결과. data URL을 워크플로 상태에 직접 넣지 않고
  // (§6.6) lib/state/imageAssetStore.ts의 Blob store를 가리키는 id만 보관한다.
  generatedImageAssetId?: string;
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
// "rule" = 로컬 키워드 휴리스틱(P5-2)의 추천 — 실제 AI 호출이 아니므로 "ai"와 구분한다.
export type DecisionSource = "user" | "inherited" | "ai" | "rule";
export type Freshness = "current" | "stale";

// 섹션 우선순위 작업 상태 (P5-2) — 확정 스냅샷(PageReferenceDecision)과 달리
// 편집 중에 사용자가 승격/강등한 결정을 여기 저장한다. 명시적 결정이 없으면
// confirmBrief.ts가 기존 휴리스틱(적용 레퍼런스 있으면 고영향)으로 폴백한다.
export interface SectionPriorityEntry {
  priority: SectionReferencePriority;
  source: DecisionSource;
}

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

// 이미지 역할 (P3) — 무드보드 템플릿에서 위계 있게 배치하기 위한 태그.
// 대표(hero) 1장 + 보조(supporting) 2~3장을 기본으로 삼되, 디테일/텍스처/
// 레이아웃은 사용자가 필요할 때만 재배정한다.
export type ImageRole = "hero" | "supporting" | "detail" | "texture" | "layout";

export interface DirectionImageCandidate {
  url: string;
  source: "unsplash" | "pexels";
  attribution: string;
  sourceUrl: string;
  usage: "inspiration-only";
  fetchedAt: string;
  role: ImageRole;
  selected: boolean; // 최대 4장까지 selected=true (후보는 최대 6장)
  order: number; // 선택된 이미지 표시 순서
}

// 팔레트+무드를 1:1로 묶은 방향 카드 (P3). 3안 중 정확히 1안을 선택한다.
export interface DirectionOption {
  directionId: string;
  label: string; // 방향명
  description: string; // 한 줄 설명
  paletteOptionId: string;
  moodOptionId: string;
  keywords: string[]; // 최대 5개
  typography: TypographyDirection;
  styleAttributes: DirectionStyleAttributes;
  imageCandidates: DirectionImageCandidate[]; // 최대 6장
  // AI가 제안하는 방향 조언 문구 — 사용자가 이미지 재생성 때 쓰는 제외
  // 키워드(ReferenceResult.avoidDirections)와는 다른, 카드에 표시되는 조언 텍스트.
  recommendedDirections: string[];
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
    styleAttributes: DirectionStyleAttributes;
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
  editedPaletteOption?: PaletteOption; // 선택된 방향의 팔레트 편집본 (역할 재배치 반영)
  paletteMode?: "light" | "dark";
  moodOptions?: MoodOption[];
  bySectionId?: Record<string, SectionReference>; // 섹션별 (Step 10-b)
  analysisTargetList?: AnalysisTargetListItem[]; // 1단계 목록 (누적, 사라지지 않음)
  targetAnalyses?: Record<string, AnalysisTargetAnalysis>; // id → 깊은 분석 (누적)
  imageHints?: ImageHint[]; // Step 11
  representative?: RepresentativePages; // Step 11 (Phase 4에서 계승)
  referenceConfirmed?: boolean; // ④ 전체 확정 (Step 10-c)
  // ── 확정 결정 계약 (P1) ──
  directionOptions?: DirectionOption[];
  selectedDirectionId?: string; // 방향 3안 중 선택된 1안 — 팔레트/무드/이미지 선택의 단일 출처(P3-5)
  referenceAdoptions?: Record<string, ReferenceAdoption>; // key: adoptionId
  confirmedBrief?: ConfirmedReferenceBrief;
  revision?: WorkflowRevision; // 마이그레이션 기간 optional — confirmBrief가 생성 시 채운다
  baseContentVariantId?: string; // 콘텐츠 변형이 2개 이상일 때 사용자가 고른 기준 변형(§6.7)
  // ── 페이지 보드 (P5) ──
  pageMetaById?: Record<string, PageMetaOverride>; // key: pageId — 파생 요약의 사용자 덮어쓰기
  sectionDecisionsByKey?: Record<string, SectionPriorityEntry>; // key: `${pageId}::${sectionId}`
  // ── 브랜드 분석 채택 (P6) ──
  brandDecisionOverrides?: Record<string, BrandDecisionOverride>; // key: AnalysisTargetListItem.id
  // ── 이미지 힌트 게이팅 (P7) ── key: sectionKey(pageId, sectionId)
  // 사용자가 명시적으로 켜거나 끈 "새 이미지 필요" 결정만 여기 남는다. 값이 없는
  // 섹션은 lib/reference/imageHints.ts의 defaultImageNeed(contentType) 휴리스틱을
  // 그대로 표시값으로 쓴다 — 그래서 사용자가 끈 false는 휴리스틱이 절대 되살리지 않는다.
  imageNeedByKey?: Record<string, boolean>;
  // ── 결정 검토 — 출처 미확인 인지 (P8) ── key: AnalysisTargetListItem.id
  // 값은 boolean이 아니라 lib/reference/reviewStatus.ts의
  // unverifiedSourceFingerprint(verifiedSources) 결과 문자열이다. 재분석으로 출처
  // 구성이 바뀌면 지문이 달라져 예전 인지가 자동으로 무효화된다.
  unverifiedSourceAcks?: Record<string, string>;
}

// 결정 검토 화면 (P8) — evaluateReviewStatus의 결과. required는 확정을 막고,
// stale은 안내만 하며 재확정 버튼 자체는 막지 않는다(재확정하면 해결되므로),
// optional은 정보 제공용으로 확정에 영향을 주지 않는다.
export type ReviewIssueSeverity = "required" | "stale" | "optional";

export interface ReviewIssue {
  id: string;
  severity: ReviewIssueSeverity;
  message: string;
  tabId?: "palette-mood" | "section-refs" | "targets" | "image-hints";
  targetId?: string; // 출처 인지 이슈에서 Review 탭의 인지 체크박스와 연결
}

export interface ReviewStatus {
  issues: ReviewIssue[];
  canConfirm: boolean;
  // references.confirmedBrief가 이미 있고, 그 이후 상태가 바뀌어 재확정이 필요함
  // (차단 아님 — 재확정 버튼을 누르면 그대로 해소된다).
  priorConfirmationStale: boolean;
}

// 페이지 보드 목적/핵심 대상 요약의 사용자 덮어쓰기 (P5-1) — Page 원본(분석 결과,
// analysisHash에 들어감)은 건드리지 않고 여기 별도로 둔다. 없으면
// lib/reference/pageBoard.ts의 로컬 파생값을 그대로 쓴다.
export interface PageMetaOverride {
  purposeSummary?: string;
  audienceSummary?: string;
}

// 가져올 점/피할 점 사용자 편집 상태 (P6) — 심층 분석 직후 wowPoints/painPoints로
// 한 번만 시드하고(lib/reference/brandDecision.ts), 이후 사용자가 체크 해제·직접
// 추가한 결과만 여기 남는다. confirmBrief.ts가 이 값을 BrandDecision으로 옮긴다.
export interface BrandDecisionOverride {
  adoptedPatterns: string[];
  avoidedPatterns: string[];
}

// React의 setState처럼 "현재 값을 함수로 받아 다음 값을 반환"하는 형태도 허용한다.
// await 이후 onChange를 호출하는 탭들이 요청 시작 시점의 스냅샷이 아니라 flush
// 시점의 최신 references를 기준으로 병합하게 하기 위함(§2.9/§6.5 — 늦게 도착한
// 응답이 그 사이 다른 탭에서 바뀐 값을 덮어쓰는 문제 방지).
export type ReferenceResultUpdater =
  | ReferenceResult
  | ((prev: ReferenceResult) => ReferenceResult);
