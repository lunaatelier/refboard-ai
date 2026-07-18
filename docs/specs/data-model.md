# 데이터 모델 명세

> 상위 컨텍스트: `CLAUDE.md`. 이 문서는 제품 A 전체의 데이터 타입·계보·상태 객체의 단일 기준이다.
> Phase 1~5가 공유하는 데이터 계약을 정의한다.

> **⚠️ 이 문서는 "최종 목표 모델"이다 — 지금 한 번에 다 구현하는 게 아니다.**
> `implementation-steps.md`의 각 스텝은 **"타입은 그 기능을 만드는 스텝에서 추가"** 원칙을 따른다.
> 즉 여기 있는 타입 중 상당수는 **아직 미구현**이며, 어느 스텝에서 등장하는지는 각 필드/타입 옆 `(Step N)` 주석을 본다.
> Step 3/4(마스킹 코어)를 구현할 때 이 문서의 Step 6·8·9·11·12·13 전용 필드까지 한 번에 만들지 않는다 — 해당 스텝에서만 채운다.

---

## 1. 핵심 원칙

1. **Concept JSON은 단일 원천(SSoT)** — HTML/PPT/PDF/디자인 MD는 모두 여기서 파생된다.
2. **마스킹 상태 영속** — 저장되는 모든 콘텐츠는 `maskedContent`(마스킹본)다. 실명 복원본은 타입에 존재하지 않으며, 클라이언트 렌더 시점에만 `mappings`로 생성된다.
3. **contentType ≠ layoutPattern** — "내용의 성격"과 "표현 방식"은 별개 축(N:M). 둘 다 유지한다.
4. **Section은 후보→확정** — Phase 2에서 후보로 생성, 사용자 확정 후 Phase 3 입력.
5. **데이터 계보** — 같은 `sectionId`가 Phase 2→3→4를 관통한다.
6. **이 문서는 최종 모델, 구현은 스텝별** — 타입 존재 ≠ 지금 구현 대상. `(Step N)` 표기를 따른다.

---

## 2. 상태 객체 (보안 등급 분리)

```typescript
// ── 일반 워크플로 상태: 마스킹된 것만. 평범하게 다뤄도 안전. ──
interface WorkflowState {
  currentStep: Step;
  completedSteps: Step[];
  sourceType?: "raw-document" | "analysis-json";  // (Step 13) 미설정 시 기본 "raw-document"
  maskedText?: string;          // 마스킹됨
  extractedAnalysisTargets?: ExtractedAnalysisTarget[];  // (Step 4/6) 마스킹서 "유지"로 확정된 공개 엔티티
  projectDirective?: ProjectDirective[];             // (Step 8) 전역 지시
  analysis?: ProjectAnalysis;   // Phase 2
  references?: ReferenceResult; // Phase 3
  conceptJson?: ConceptJson;    // Phase 4 (maskedContent만 보유)
  outputConfig?: OutputConfig;  // (Step 12) 출력 프리셋
}

// ── 민감 메모리: 원문·복원키. 격리·최소수명·영속화 금지. ──
interface SecureClientMemory {
  parsedText?: string;          // 원문 — 마스킹 확정 후 즉시 폐기
  mappings?: MaskMapping[];     // 복원키(토큰↔실명) — 새로고침 시 소멸
}

type Step =
  | "upload" | "masking" | "analysis"
  | "reference" | "concept" | "design-md";
```

**SecureClientMemory 취급 규칙:** `parsedText`, `mappings`, `Detection.raw`는 모두 민감 등급. localStorage·sessionStorage·URL·서버 요청·로그에 절대 포함 금지. 상세는 `CLAUDE.md` §4.4.

**단계 접근 가드:**
```typescript
function canAccessStep(target: Step, state: WorkflowState): boolean {
  // 완료된 단계이거나 바로 다음 허용 단계만 true.
  // 예: maskedText 없으면 'analysis' 이후 전부 차단 (보안 게이트).
  // sourceType 미설정 = "raw-document"로 취급(Step 13 이전 항상 이 분기).
  // 재활용(Step 13): sourceType === "analysis-json" && analysis 있으면
  //   masking 건너뛰고 reference 접근 허용 (maskedText 없어도).
}
```

**재활용 모드 4구분 (Step 13 + Step 14):**
- 일반: `raw-document` 시작 → 실명본 다운로드 가능(mappings 있음).
- 재활용: `analysis-json` 시작 → 마스킹본만(복원키 없음).
- 같은 세션 재활용: `analysis-json`이라도 mappings가 아직 메모리에 있으면 실명본 가능.
- 복원키 파일 재활용 (Step 14): `analysis-json` 시작 + 함께 저장했던 복원키 파일 가져오기 → `exportId` 일치 검증 후 mappings 메모리 복구 = 실명본 가능.

**복원키 파일 (Step 14) — 클라이언트 전용 직렬화:**
```typescript
// lib/state/recoveryKey.ts — ⚠️ 실명 포함. 서버 미전송, 브라우저에서만 생성·해석.
interface RecoveryKeyExport {
  format: "drg-recovery-key";
  version: number;
  savedAt: string;
  exportId: string;        // 분석 JSON(AnalysisExport)과 같은 값 = 같은 문서의 짝
  mappings: MaskMapping[];
}
```
- CLAUDE.md §4.4 "영속화 금지"의 유일한 예외 — 사용자 명시 액션(버튼)일 때만.
- 분석 JSON과 복원키 파일은 세션 내 동일 `exportId`를 공유한다(짝 검증 기준).

---

## 3. 마스킹 타입 (Phase 1)

```typescript
type SensitiveKind =
  | "email" | "phone" | "url" | "ip" | "apikey" | "rrn"
  | "company" | "client" | "product"
  | "personName"           // (실사용 검증#3/#5/#19/#27) 작성자·CEO·담당자 등 개인 실명
  | "businessRegNo"        // (#12) 사업자등록번호 000-00-00000
  | "certificationNo"      // (#16) 신용평가·인증서 등 발급번호 (예: GC1-2023-02618)
  | "address"              // (#17) 도로명주소·상세주소
  // 민감 수치 (Step 6). 개인정보는 아니나 외부 유출 위험.
  | "financialMetric"   // 투자금·매출·ARR·영업이익
  | "businessMetric"    // 고객 수·사용자 수·성장률
  | "internalKpi";      // 내부 KPI

// 엔티티 민감도 등급 (Step 6). CLAUDE.md §4.1.1과 일치.
// 기밀(기본 가림): customer, investor, partner, internalKpi
// 공개(사용자 확인 후 실명 유지 가능): competitor, benchmarkBrand, roleModel, publicReference
type AnalysisTargetKind =
  | "customer" | "investor" | "partner"
  | "competitor" | "benchmarkBrand" | "roleModel" | "publicReference";

// 민감 수치 마스킹 모드 (Step 6)
type NumericMaskingMode = "exact-mask" | "range-generalize" | "keep";

interface NumericDetection {
  kind: "financialMetric" | "businessMetric" | "internalKpi";
  raw: string;              // "누적 투자금 35억"
  generalized?: string;     // "수십억 원대 투자 유치" (range-generalize 시)
  mode: NumericMaskingMode; // 기본: 투자금·매출·ARR=exact / 고객수·성장률=range / 공개확정 시만 keep
  // 주의: 숫자 지표는 "후보 탐지". 최종 민감 여부·모드는 사용자 검수로 확정.
  // (#15) 다년도 재무제표처럼 "표 전체"가 수치덩어리인 경우, 문장 단위가 아니라
  // 표 인식 시 행/열 단위로 NumericDetection을 다건 생성한다 (표 구조 보존 원칙).
}

// (#13/#29 실사용 검증) 더미/플레이스홀더 패턴 — 탐지는 하되 "확정 아님, 더미 추정" 배지로 구분.
// 검수 화면에서 기본 미체크(마스킹 제외 후보)로 표시해 사용자 확인 부담을 줄인다.
type DummyConfidence = "likely-dummy" | "uncertain" | "likely-real";

interface DummyPatternRule {
  kind: SensitiveKind;
  pattern: RegExp;
  // 예:
  //   phone:  /010-0000-\d{4}/, /000-0000-0000/         → likely-dummy
  //   email:  /^(none|noreply|no-?reply|norply)@/i       → likely-dummy
  //   businessRegNo: 순차 숫자(123-12-12345 형태)         → uncertain
  confidence: DummyConfidence;
}

// (#1/#6/#7 실사용 검증) URL 마스킹 예외 규칙.
// 기본은 가림(내부 URL 추정)이나, 아래 조건이면 "유지 후보"로 분류해 검수에서 구분 표시.
interface UrlMaskingRule {
  url: string;
  reason: "benchmark-source" | "public-citation" | "internal-tool";
  // benchmark-source/public-citation: 도메인이 AnalysisTargetKind가 benchmarkBrand/competitor로
  //   태깅된 브랜드의 도메인과 일치 → 유지 후보 (예: streetlightdata.com, ptvgroup.tech)
  // internal-tool: 사내 협업툴 URL 패턴(atlassian.net, notion.so, slack.com 등 사내 워크스페이스) → 가림 확정
  suggestedAction: "keep" | "mask";
}

interface Detection {
  id: string;
  kind: SensitiveKind;
  raw: string;          // ⚠️ 민감: 매칭된 원문 조각. 검수 동안만 유지, 확정 후 정리.
  start: number;
  end: number;
  source: "rule" | "dictionary" | "manual";
  enabled: boolean;
  // 회사명일 때 엔티티 등급 태깅 (Step 4는 가림/유지 2분, Step 6에서 6종 확장)
  entityKind?: AnalysisTargetKind;
  keepPlaintext?: boolean;   // true = 공개 엔티티로 실명 유지(외부 전송 허용)
  dummyConfidence?: DummyConfidence;  // (#13/#29) 더미로 추정되면 표시, 검수 부담 경감
  // (#28 실사용 검증) 법정 의무고지 정보(개인정보 보호책임자 등)는 "실수 유출"과 다른 카테고리.
  // Gemini 전송 시엔 동일하게 가리되, 최종 산출물에는 이 필드가 true면
  // "[담당자명] — 최종본에 직접 입력 필요" 자리로 표시한다(AI가 생성하지 않음).
  isLegallyRequiredDisclosure?: boolean;
}

// (#27 실사용 검증) 인명은 프로젝트 단위가 아니라 "영구 사전"으로 등록.
// 같은 실무자가 여러 클라이언트 프로젝트에 반복 등장하는 경우가 실사용 검증 10건 중 3건에서 확인됨.
// lib/dictionary/store.ts에 personName 카테고리를 추가하고, 이 카테고리만 프로젝트 경계를 넘어 유지한다.
interface PersistentPersonDictionaryEntry {
  id: string;
  name: string;
  addedFromProjectId?: string;   // 최초 등록된 프로젝트 (참고용, 필수 아님)
  scope: "global";                // personName은 항상 global — 프로젝트별 사전과 분리 저장
}

interface MaskMapping {       // ⚠️ 민감: SecureClientMemory 전용
  token: string;              // "[회사A]" / "[담당자A]" / "[주소A]"
  raw: string;                // "가상전자" / "가상담당자A" / "서울시 ..."
  kind: SensitiveKind;
}

// (#32 실사용 검증) 파일명 자체가 마스킹 대상이 될 수 있다.
// 예: "..._수정본_가상담당자A.pptx" — 본문이 아니라 파일명에 인명이 노출.
// 업로드 시 파일명도 detect() 대상에 포함하고, 업로드 목록·로그 등 어디에도
// 원본 파일명을 그대로 표시하지 않는다. 표시용 이름은 마스킹된 별칭으로 대체.
interface UploadedFileMeta {
  originalFileName: string;    // ⚠️ 민감 취급 — SecureClientMemory급. 화면에 노출 금지.
  displayName: string;         // 마스킹된 표시명 (예: "화면정의서_[담당자A].pptx")
}
```

// ── 검수 중 타입: raw 포함(민감). WorkflowState에 넣지 말 것. ──
interface DraftMaskResult {
  detections: Detection[];    // raw 포함 → 검수 UI에서만 사용
  numericDetections?: NumericDetection[];  // (Step 6에서 추가) Step 3/4 마스킹 코어 v1엔 없음/미포함
  previewMaskedText: string;  // 미리보기용
}

// ── 확정 후 타입: raw 없음. 이것만 다음 단계로. ──
interface FinalMaskResult {
  maskedText: string;         // 외부로 나가는 유일한 텍스트
  mappings: MaskMapping[];    // → SecureClientMemory로 격리 (WorkflowState 아님)
  // detections 없음 — raw 유입 차단. 확정 시 Draft→Final 변환하며 raw 폐기.
}

// 마스킹에서 유지(실명)로 확정된 공개 엔티티 목록 → "분석 대상 브랜드" 소스로 연결
// (이름 주의: "경쟁사"만이 아니라 롤모델·투자사 등도 포함되므로 Competitor가 아닌 AnalysisTarget)
interface ExtractedAnalysisTarget {
  name: string;
  entityKind: AnalysisTargetKind;  // competitor / benchmarkBrand / roleModel / publicReference ...
}

// 이미지 자산 (Step 9). 이미지 opt-in 분석 경로.
interface ImageAsset {
  assetId: string;
  sourceSlide?: number;              // PPT 계보
  thumbnail?: string;
  selectedForAnalysis: boolean;      // 기본 false (텍스트만이 기본값)
  excludedReason?: ExclusionReason;
  excludedNote?: string;
  sensitivityHint?: "none" | "possible" | "high";  // 민감 가능성 힌트
}

// 이미지 전송 동의 상태 (Step 9)
interface ImageConsent {
  consented: boolean;                // 명시적 동의
  consentedAssetIds: string[];       // 동의한 이미지만 전송
  // 멀티모달 응답은 저장 전 마스킹 엔진 재통과(실명 재유입 차단). 저장은 항상 masked 기준.
}
```

**타입 분리 이유:** `Detection.raw`는 민감(원문 조각). `MaskResult`에 detections가 남으면 구현자가 실수로 `WorkflowState`에 넣을 수 있다. 그래서 **검수 중(Draft, raw 있음)**과 **확정 후(Final, raw 없음)**를 타입으로 분리해 실수를 컴파일 단계에서 막는다.

---

## 4. 분석 타입 (Phase 2)

```typescript
interface ProjectAnalysis {
  title: string;
  description: string;
  domain: DomainHint;         // 아래
  domainConfidence: number;   // 낮으면 사용자 선택 우선
  targetUser: string;
  tags: string[];
  projectType: string;        // 브로셔/홈페이지/광고/이벤트 등 (셀렉트 수정 가능)
  brandColors?: string[];     // 로고/브랜드컬러 있으면 자동, 수정 가능
  projectDirective?: ProjectDirective[];  // 전역 지시 (Step 8)
  pages: Page[];
  parentSiteRelation?: ParentSiteRelation;  // (실사용#31, Step 10) 부모-자식 사이트 관계 후보
}

// 부모-자식 사이트 관계 (실사용#31, flow-spec ④). 분석 단계에서 AI가 후보 제시,
// 사용자 확정 시에만 레퍼런스 검색이 "부모 사이트를 관리하는 CMS 백오피스"로 좁혀진다.
interface ParentSiteRelation {
  relatedProjectId?: string;  // 향후 프로젝트 저장소 도입 시 연결 (현재 미사용)
  relationNote: string;       // 예: "[회사A] 대민 홈페이지의 콘텐츠를 관리하는 백오피스로 추정"
  confirmed: boolean;         // AI 후보(false) → 사용자 확정(true)일 때만 반영
}

type DomainHint =
  | "marketing-web" | "dashboard-ops" | "mobile-app"
  | "document" | "generic";

// 페이지 역할 (Step 7). 문서형 대표 페이지 추천에 사용.
type PageRole =
  | "cover" | "section-divider" | "content"
  | "case-study" | "metrics" | "team" | "appendix" | "contact";

// 제외 사유 (Step 8). 기록이 아니라 "후속 프롬프트 차단 조건"으로 사용.
type ExclusionReason =
  | "sensitive" | "out-of-scope" | "low-priority"
  | "duplicate" | "quality-issue" | "user-choice" | "other";

// 전역 지시 (Step 8 + Step 15). scope 미지정/빈 배열 = 전체 적용.
// 지정 시 buildDirectiveBlock(directives, scope)가 호출처 단계와 일치하는 지시만 주입.
// scope ↔ 호출처: analysis=/api/analyze, reference=targets-list·target-analyze·section-queries,
// mood=/api/mood·image-hints, concept=/api/concept, output=프롬프트 미주입(컨셉 단계 리마인더 표시).
interface ProjectDirective {
  text: string;                                        // "ESG 강조"
  scope?: DirectiveScope[];  // "analysis" | "reference" | "mood" | "concept" | "output"
  priority?: "normal" | "high";
}

interface Page {
  pageId: string;
  pageTitle: string;
  pageRole: PageRole;         // Step 7
  sourceSlides?: number[];    // PPT 계보: 이 페이지가 온 슬라이드 번호 (Step 7)
  sourceDocumentId?: string;  // (실사용#4/#8) 문서 자체 화면ID/요구사항ID (예: "RUC-UI-MAI", "DBM-001")
                               // 있으면 자동생성 pageId 대신 추적성 위해 함께 보관
  selected: boolean;          // 사용자가 최대 5개 선택
  excludedReason?: ExclusionReason;  // 제외 시 사유 (Step 8) → 후속 프롬프트 차단 조건
  excludedNote?: string;      // 선택적 메모
  sections: Section[];        // 후보 → 확정
}

interface Section {
  sectionId: string;
  sectionTitle: string;
  contentSummary: string;     // 마스킹된 본문 요약
  contentType: ContentType;   // 내용의 성격 (Gemini 판정)
  recommendedLayout: LayoutPattern;  // 추천 표현 방식 (후보)
  referenceQueries: ReferenceQuery[];
  imageHints: string[];
  sourceSlides?: number[];    // PPT 계보 (Step 7)
  sourceAssetIds?: string[];  // 참고한 이미지 자산 id (Step 7/9)
  sourceDocumentId?: string;  // (실사용#4/#8) 문서 자체 ID. 예: 요구사항ID "REQ-F-007" 등 복수면 배열도 가능
  confidence?: number;        // 섹션 분할 신뢰도
  status: "candidate" | "confirmed";  // 사용자 확정 여부
  // (실사용#9) 문서 내 리뷰 코멘트("[김재범 9/25] ...")는 미결 이슈 정보로 가치 있음.
  // 삭제하지 않고 별도 필드로 보존해 컨셉 단계에서 "이 섹션은 아직 논의중" 표시에 활용.
  unresolvedNotes?: string[]; // 마스킹된 리뷰코멘트 원문 (인명은 마스킹, 내용은 유지)
}

// 내용의 성격 (확장 가능 — enum 닫지 말 것). 도메인별 세트는 product-a-flow-spec ③ 참조.
type ContentType =
  | "history" | "business-model" | "pricing"
  | "feature" | "team" | string;

// 표현 방식 (확장 가능 — enum 닫지 말 것)
type LayoutPattern =
  | "timeline" | "comparison-table" | "card-grid"
  | "hero" | "stat-band" | "flow-diagram" | string;
```

**제외 = 차단 조건 (Step 8):** `excludedReason`은 기록용이 아니다. Phase 3 이후 모든 프롬프트에 selectedPages·confirmedSections만 넣고, 제외 페이지는 "Excluded pages must not be used as source material. Reason: ..."로 명시해 AI가 참조하지 못하게 한다.

**contentType ↔ layoutPattern 관계 (N:M):**
같은 `business-model`이라도 `comparison-table` 또는 `flow-diagram`으로 표현 가능. 그래서 둘은 분리. Gemini가 `contentType`을 판정하면 `layoutPattern` 후보를 제안하고, 사용자가 Phase 3~4에서 선택한다.
- `contentType` = 분석 결과 (Phase 2 시점)
- `layoutPattern` = 선택 결과 (Phase 3~4 시점)

**★ 사용자 확정 게이트:** Phase 2가 만든 후보 Section을 사용자가 병합/삭제/수정하여 `status: "confirmed"`로 만든 것만 Phase 3 입력이 된다. 기획서에 깔끔한 헤더가 없을 수 있으므로 이 게이트는 필수.

---

## 5. 레퍼런스 타입 (Phase 3)

```typescript
interface ReferenceQuery {
  platform: string;           // Dribbble, Behance, Mobbin ...
  query: string;              // 플랫폼 강점에 매핑된 검색어
  mode: "auto-search" | "copy-keyword";  // 자동이동 vs 키워드복사
  url?: string;               // auto-search일 때 검색 이동 URL
}

interface ReferenceResult {
  // 프로젝트 전체 결정 (섹션 무관 — 팔레트/무드는 프로젝트 1개)
  globalMood: MoodBoard;
  selectedPalette: Palette;             // 확정 팔레트 (역할매핑+모드)
  paletteOptions: PaletteOption[];      // 3세트 후보
  selectedMoodId?: string;
  adoptedAnalysisTargets: AnalysisTargetAnalysis[];  // 채택한 분석 대상 브랜드 (전체 레벨)
  analysisTargetList: AnalysisTargetListItem[];      // 1단계 목록(누적, 프로젝트 전체)
  // 섹션별 결정
  bySectionId: Record<string, SectionReference>;
}

interface SectionReference {
  sectionId: string;
  layoutPattern: LayoutPattern;   // 사용자 선택 확정
  platformQueries: ReferenceQuery[];
  references: ReferenceItem[];    // 레퍼런스 항목 (usage/권리 포함)
  imageHints: ImageHint[];
  // 분석 대상 브랜드·팔레트·무드는 프로젝트 전체(ReferenceResult)로 이동 — 섹션마다 흩어지지 않음
}

// 레퍼런스 항목 (Step 10). 문서형 레퍼런스는 저작권 민감 → usage/license 구분.
interface ReferenceItem {
  platform: string;
  title?: string;
  sourceUrl: string;
  usage: "inspiration-only" | "embeddable";  // 참고만 / 산출물 삽입 가능
  licenseNote?: string;
  thumbnail?: string;
}

// 분석 대상 브랜드 소스 3갈래: 설계서 자동추출(공개 엔티티 태깅) / 사용자 직접입력 / Gemini 추천
// (경쟁사·롤모델·벤치마킹 브랜드·공개 투자사 등을 모두 포함 — "경쟁사"로 한정하지 않음)
type AnalysisTargetSource = "spec" | "manual" | "gemini";

// 1단계(넓게 훑기) 목록 항목 — 가벼움
interface AnalysisTargetListItem {
  id: string;
  name: string;
  url: string;
  source: AnalysisTargetSource;
  oneLineSummary: string;         // 한 줄 특징
  thumbnail?: string;             // favicon/메타이미지 (스크린샷 아님 — 할당량 절약)
  analysisStatus: "listed" | "analyzing" | "analyzed";  // 대기/분석중/완료
  adopted: boolean;               // 채택 여부 (분석됨 ≠ 채택)
}

// 2단계(깊게) 분석 결과 — 7개 축
interface AnalysisTargetAnalysis {
  id: string;                     // AnalysisTargetListItem.id 계승
  name: string;                   // 공개 정보라 실명 저장 OK
  screenshot?: string;            // 무료 API 캡처, 소진 시 없음(링크 폴백)
  depth: "deep" | "very-deep";    // very-deep = 스크린샷 멀티모달 포함
  layoutStrategy: string;         // 1. 레이아웃 전략
  colorVisualStrategy: string;    // 2. 컬러·비주얼 전략
  componentPattern: string;       // 3. 컴포넌트 패턴
  painPoints: string[];           // 4. 페인포인트 (약점)
  wowPoints: string[];            // 5. 와우포인트 (배울 점)
  estimatedIntent: string;        // 6. 추정 의도
  implications: string;           // 7. 우리 프로젝트 시사점
  sourceUrl: string;              // grounding 출처 (환각 방지)
  confidence: "추천";             // 확정 아님 — "추정 포함, 확인 필요"
  analyzedAt: string;             // 캐시용 (프로젝트 넘어 재활용 시 "N일 전" 표시)
}

interface MoodBoard {
  keywords: string[];             // "신뢰감 있는", "혁신적인" ...
  description: string;
  images: MoodImage[];            // Unsplash/Pexels API
}

interface MoodImage {
  url: string;
  source: "unsplash" | "pexels";
  attribution: string;
}

// 팔레트 = 색(1층) + 역할 매핑(2층). 사용자가 역할 배치를 드롭다운으로 재배치.
// 색은 유지한 채 "블루를 LNB에 쓸까 Accent에 쓸까"를 편집 → "색은 좋은데 배치 틀림" 해결.
interface Palette {
  mode: "light" | "dark";         // 모드별로 팔레트를 가짐 (UiStructure.mode와 연동)
  // 역할 → 색 매핑 (편집 가능)
  primary: string;                // 강조·주요 액션
  secondary: string;
  accent: string;                 // 포인트·CTA
  background: string;             // 배경
  surface: string;                // 카드·패널 배경
  text: string;                   // 본문 글자
  navigation: string;             // LNB/GNB 배경 (별도 역할 — "LNB 블루" 같은 배치 제어)
}

// 컬러 후보는 3세트 제시 → 사용자가 1세트 선택 후 위 역할 매핑을 편집
interface PaletteOption {
  optionId: string;
  label: string;                  // "신뢰형" / "혁신형" / "미니멀형" (또는 브랜드 변주)
  light: Palette;
  dark: Palette;                  // 다크/라이트 쌍으로 보유
}

interface ImageHint {
  area: string;                   // 적용 영역
  scale: "hero" | "section" | "icon";  // 표지급 / 섹션 삽화 / 아이콘 (Step 11)
  prompt: string;                 // 이미지 생성 프롬프트 (텍스트 제공)
  direction: string;              // 일러스트/3D/사진 방향
  aspectRatio?: string;           // "16:9", "1:1" 등
  // NVIDIA 생성 이미지 참조 (후순위 — 없으면 프롬프트만). data URL을 워크플로 상태에
  // 직접 넣지 않고(§6.6) lib/state/imageAssetStore.ts의 Blob store id만 보관한다.
  generatedImageAssetId?: string;
}
```

**스킨 프리뷰:** 팔레트·무드(KeyVisual) 확정 후, 프리뷰 컴포넌트의 테두리·배경·장식 SVG 패턴에 무드를 즉각 반영(순서: 팔레트·무드 확정 → 스킨 적용).

---

## 5.1 확정 결정 계약 (P0 개정 — `docs/refboard-ai-phase2-4-improvement-final.md` §6 반영)

> 아직 미구현. 실제 추가는 P1에서 진행하며, 여기서는 타입 계약만 이 문서(단일 기준)에 먼저 반영한다.

§5의 `ReferenceResult`/`SectionReference`는 **편집 중인 작업 상태**다. 사용자가 실제로 채택한 결정만 남긴 **불변 스냅샷**이 별도로 필요하다 — 그래야 미선택 검색 결과·미채택 분석이 컨셉 생성에 섞이지 않는다.

```typescript
type AdoptionStatus = "applied" | "reference-only" | "excluded";
type AdoptionAspect = "layout" | "color" | "typography" | "image-tone" | "interaction" | "content-density";
type SectionReferencePriority = "high-impact" | "inherited" | "optional";
type DecisionSource = "user" | "inherited" | "ai";
type Freshness = "current" | "stale";

interface ReferenceAdoption {
  adoptionId: string;
  pageId: string;
  sectionId: string;
  reference: ReferenceCandidate;  // provider: "inspo" | "manual", usage: "inspiration-only" 고정
  status: AdoptionStatus;
  aspects: AdoptionAspect[];
  note: string;
  decision: { source: DecisionSource; freshness: Freshness; basedOnHash: string };
}

interface PageReferenceDecision {
  pageId: string;
  pageTitle: string;
  purposeSummary: string;
  sections: Array<{
    sectionId: string;
    sectionTitle: string;
    priority: SectionReferencePriority;
    layoutPattern: string;
    decision: { source: DecisionSource; freshness: Freshness; basedOnHash: string };
    adoptions: ReferenceAdoption[];
    imageNeed?: ImageNeedDecision;
  }>;
}

interface VerifiedSource {  // 모델이 JSON에 쓴 sourceUrl 문자열을 그대로 신뢰하지 않는다 — P6
  url: string;
  status: "official" | "supporting" | "unverified";
  groundingCited: boolean;
  domainVerified: boolean;
  fetchedAt: string;
}

interface BrandDecision {
  targetId: string;
  name: string;
  adoptedPatterns: string[];
  avoidedPatterns: string[];
  verifiedSources: VerifiedSource[];
}

interface ImageNeedDecision {  // data URL을 워크플로 JSON에 직접 넣지 않는다 — Blob store id만 보유
  required: boolean;
  role: "hero" | "section" | "icon";
  prompt?: string;
  generatedImageAssetId?: string;
}

interface WorkflowRevision {
  analysisHash: string;
  directionHash?: string;
  briefHash?: string;
  promptVersion: string;
}

interface ConfirmedReferenceBrief {
  version: "2.0";
  confirmedAt: string;
  revision: WorkflowRevision;
  direction: {
    paletteOptionId: string;
    editedPaletteOption: PaletteOption;   // 역할 재배치 편집 결과
    paletteMode: "light" | "dark";
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
```

**적용 팔레트 계산 규칙:** 컨셉에 전달하는 최종 팔레트는 항상 `editedPaletteOption[paletteMode]`. `paletteOptionId`만으로는 사용자의 역할 재배치 편집이 사라진다.

**무효화 규칙:** 상위 결정(글로벌 방향, 선택 페이지/섹션)이 바뀌면 하위 결과를 삭제하지 않고 `freshness: "stale"`로만 표시한다. hash는 정렬된 안전 DTO의 canonical JSON에서 계산하며 `confirmedAt`·`briefHash` 자신은 입력에서 제외한다. 상세 무효화 매트릭스는 개선 지시서 §6.5를 단일 기준으로 참조한다(중복 기술하지 않음).

---

## 6. 컨셉 타입 (Phase 4) — Concept JSON (SSoT)

```typescript
interface ConceptJson {
  projectTitle: string;
  version?: "2.0";                 // (P0 개정, 미구현) 없으면 구버전(sourceBasis 없음) — 타입 분리 대신 필드+builder 강제
  sourceBasis?: ConfirmedReferenceBrief;  // (P0 개정, 미구현) §5.1 — 컨셉 생성에 쓴 확정 브리프 스냅샷
  options: ConceptOption[];       // 3안
  outputSelection: ConceptOutputSelection;  // 대표 페이지·출력 구성
  baseContentVariantId?: string;  // (P0 개정, 미구현) §5.1 — 기존 콘텐츠 변형이 있을 때 구조 3안 생성에 쓴 기준 변형
}

// 표지(비주얼 대표)와 내용 대표를 분리 (Step 11). "표지 ≠ 대표".
interface ConceptOutputSelection {
  visualRepresentativePageId?: string;   // 보통 cover — 첫인상·키비주얼용
  contentRepresentativePageId?: string;  // content/metrics — 정보구조를 보여주는 대표
  includedSubPageIds: string[];          // 컨셉서에 넣을 서브 (체크박스 선택)
  outputPreset: OutputPreset;
}

// 출력 프리셋 (Step 12). 컨셉서 밀도 제어.
type OutputPreset = "summary" | "proposal" | "detailed";

interface OutputConfig {
  preset: OutputPreset;
  includeMaskedContent: boolean;
  includeReferenceRationale: boolean;
  includeSectionMapping: boolean;
  includeSubPages: string[];
  // 요약형: 3안 비교+대표페이지 / 제안형: 3안+표지·대표·선택서브 / 상세형: 섹션매핑·근거·이미지힌트까지
}

interface ConceptOption {
  optionId: string;
  conceptKeywords: ConceptAxis[]; // 3축 컨셉서 (사용성/일관성/효율성 등)
  designBasis: DesignBasis;       // Phase 3 확정 팔레트·무드·타이포 방향 (구조화 — Phase 5 변환의 기반)
  uiStructure: UiStructure;       // 전체 UI 방향
  keyVisual: KeyVisual;           // 전체 비주얼 방향
  pages: ConceptPage[];           // 페이지별 구성
  basedOnVariantLabel?: string;   // (P0 개정, 미구현) 구조 3안 생성에 쓴 "기준" 콘텐츠 변형 라벨
  contentVariantMappings?: Record<string, ConceptPage[]>;  // (P0 개정, 미구현) key: contentVariantId — 온디맨드로 생성한 비기준 변형만 누적. §개선 지시서 §6.7
}

// Phase 3에서 확정한 디자인 결정을 줄글이 아니라 구조화된 데이터로 계승한다.
// Phase 5(디자인 MD 변환)가 이 필드를 그대로 매핑만 하면 되게 하는 것이 목적
// (CLAUDE.md §6 "Phase 4 Concept JSON은 컬러·타이포·무드를 구조화된 데이터로 보유").
interface DesignBasis {
  palette: Palette;             // Phase 3 확정 팔레트(역할 매핑 반영, 이 옵션이 채택한 모드 기준)
  moodKeywords: string[];       // Phase 3에서 선택한 MoodBoard.keywords 계승
  typographyDirection: string;  // 선택 무드의 styleAttributes.typographyNote 계승(옵션별 보강 가능)
}

interface ConceptAxis {           // 컨셉서 3축 포맷
  no: string;                     // "01"
  title: string;                  // "사용성 (Usability)"
  category: string;               // "UX Strategy | 사용자 경험 중심"
  description: string;
}

interface UiStructure {           // 전체 방향
  mode: "dark" | "light";
  navPosition: "top" | "left";    // GNB 위치 변주
  infoStructure: string;
  layoutConcept: string;
}

interface KeyVisual {             // 전체 비주얼 방향
  imageTone: string;
  illustrationStyle: string;      // 일러스트/3D/사진
  backgroundPattern: string;
  decorativeElements: string;
}

interface ConceptPage {
  pageId: string;
  pageTitle: string;
  sections: ConceptSection[];
}

interface ConceptSection {
  sectionId: string;              // Phase 2의 sectionId 계승
  sectionTitle: string;
  contentType: ContentType;       // 내용 성격
  layoutPattern: LayoutPattern;   // 표현 방식 (이 섹션의 구체 패턴)
  contentMapping: ContentMapping;
}

interface ContentMapping {
  maskedContent: string;          // ✅ 저장은 마스킹본만
  sourceSectionId: string;        // 원본 추적
  targetArea:                     // 화면 영역
    | "hero-title" | "feature-card" | "timeline" | "table" | string;
  // displayContent 필드 없음 — 렌더 시점에 restore(maskedContent, mappings)로만 생성
}
```

**컨셉 = 3안 × 3축:** 각 ConceptOption은 DesignBasis(Phase 3 확정 팔레트·무드·타이포의 구조화 계승) + UiStructure(레이아웃/네비/정보구조) + KeyVisual(이미지톤/일러스트·3D·사진/배경/장식) + Content Mapping(페이지·섹션별 본문 배치)으로 구성. 단순 "무드 3개"가 아니다.

**렌더링:** ConceptJson → 클라이언트 렌더러 4종(HTML/PPT/PDF/MD). PPT는 `pptxgenjs`, PDF는 `jsPDF`/`pdf-lib`. 서버 렌더링 없음. 기본 마스킹본, 실명본은 명시적 선택 시 클라에서 복원.

---

## 7. 데이터 계보 (Lineage)

같은 식별자가 Phase를 관통하며 진화한다. `sectionId`가 추적 키.

```
 Phase 2 (분석)         Phase 3 (수집)          Phase 4 (종합)
─────────────────────────────────────────────────────────────
 Page               →  (레퍼런스 부착)       →  ConceptPage
 Section(candidate) →  Section(confirmed)    →  ConceptSection
   .sectionId       →    .sectionId(동일)    →    .sectionId(동일)  ← 추적키
   .contentType     →    .contentType        →    .contentType
   .recommendedLayout→   .layoutPattern(선택)→    .layoutPattern
   .contentSummary  →    ─                   →    .contentMapping.maskedContent
   .referenceQueries→    .platformQueries    →    (컨셉 근거로 참조)
                    →    Palette/Mood        →    ConceptOption.designBasis (구조화)
                                                   →  ConceptOption.keyVisual (서술)
```

핵심: Phase 2의 한 Section이 Phase 4의 ConceptSection으로 자란다. `sectionId`가 동일하게 유지되어 어느 단계에서든 출처를 역추적할 수 있다.

---

## 8. 표준 디자인 MD 스키마 (Phase 5) — 외부 계약

Phase 5는 `ConceptJson`을 입력받아 **이 레포 밖에서 정의된 표준 디자인 MD 스키마**로 변환한다.
- Concept JSON(내부 SSoT) ≠ 표준 MD 스키마(외부 계약). 둘은 다른 스키마.
- 표준 MD 스키마 필드 정의는 Phase 4 완료 후 ~ Phase 5 착수 직전에 별도 확정(추측 금지).
- MD 렌더러는 Concept JSON의 한 renderer로 구현(다른 산출물과 동일한 SSoT에서 파생).
