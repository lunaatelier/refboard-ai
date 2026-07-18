// 마스킹 타입 — data-model.md §3이 단일 기준. 보안 주의점은 phase1-masking-spec.md §2.

export type SensitiveKind =
  | "email"
  | "phone"
  | "url"
  | "ip"
  | "apikey"
  | "rrn"
  | "company"
  | "client"
  | "product"
  | "personName" // 사전 기반 전용 — 정규식으로 탐지 불가
  | "businessRegNo"
  | "certificationNo" // 사전 보조 탐지 (Step 6)
  | "address" // (Step 6)
  | "financialMetric" // (Step 6)
  | "businessMetric" // (Step 6)
  | "internalKpi"; // (Step 6)

// 엔티티 민감도 등급 — Step 3에서는 타입만 선언, 실제 태깅은 Step 4(2분)·Step 6(6종).
// 기밀(기본 가림): customer, investor, partner / 공개(사용자 확인 후 유지 가능): 나머지.
export type AnalysisTargetKind =
  | "customer"
  | "investor"
  | "partner"
  | "competitor"
  | "benchmarkBrand"
  | "roleModel"
  | "publicReference";

// 민감 수치 마스킹 모드 (Step 6)
// range-generalize가 핵심: 완전히 가리면 Gemini가 규모감을 못 읽는다.
// "수십억 원대"면 기밀을 지키며 맥락 유지 (flow-spec ②).
export type NumericMaskingMode = "exact-mask" | "range-generalize" | "keep";

// 숫자 지표는 "후보 탐지"다 — 최종 민감 여부·마스킹 방식은 사용자 검수로 확정.
export interface NumericDetection {
  id: string;
  kind: "financialMetric" | "businessMetric" | "internalKpi";
  raw: string; // "35억" (치환 대상 수치+단위)
  label?: string; // "누적 투자금" (검수 표시용 문맥)
  start: number;
  end: number;
  generalized?: string; // "수십억 원대" (range-generalize 시 치환 문구)
  mode: NumericMaskingMode;
}

export type DummyConfidence = "likely-dummy" | "uncertain" | "likely-real";

// 더미/플레이스홀더 패턴 — 탐지는 하되 "더미 추정" 배지로 구분 (실사용#13/#29)
export interface DummyPatternRule {
  kind: SensitiveKind;
  pattern: RegExp;
  confidence: DummyConfidence;
}

// URL 마스킹 예외 규칙 — 타입만 선언, 구현은 Step 6 (실사용#1/#6/#7)
export interface UrlMaskingRule {
  url: string;
  reason: "benchmark-source" | "public-citation" | "internal-tool";
  suggestedAction: "keep" | "mask";
}

export interface Detection {
  id: string;
  kind: SensitiveKind;
  raw: string; // ⚠️ 민감: 매칭된 원문 조각. 검수 동안만 유지, 확정 후 폐기.
  start: number;
  end: number;
  source: "rule" | "dictionary" | "manual";
  enabled: boolean;
  entityKind?: AnalysisTargetKind; // Step 4/6에서 태깅
  keepPlaintext?: boolean; // true = 공개 엔티티로 실명 유지 (치환 제외)
  dummyConfidence?: DummyConfidence;
  isLegallyRequiredDisclosure?: boolean; // (Step 6, 실사용#28)
}

// 표 헤더 라벨(작성자/소속 등) 기반 자동 탐지 후보 — 정규식 대신 문서의 표
// 구조(헤더 열 이름)로 판단하므로 personName/company를 규칙 없이도 잡을 수 있다.
// 생성처: lib/parse/pptx.ts extractPptxText(). 소비처: lib/masking/detect.ts.
export interface LabeledEntityCandidate {
  kind: "personName" | "company";
  raw: string;
  start: number;
  end: number;
}

// ⚠️ 복원키 — SecureClientMemory 전용. 직렬화·전송·스토리지·로그 금지.
export interface MaskMapping {
  token: string; // "[회사A]"
  raw: string; // "가상전자"
  kind: SensitiveKind;
}

// ── 검수 중: raw 포함(민감). 검수 UI에서만. WorkflowState에 넣지 말 것. ──
export interface DraftMaskResult {
  detections: Detection[];
  numericDetections?: NumericDetection[]; // (Step 6)
  previewMaskedText: string;
}

// ── 확정 후: raw 없음. 이것만 다음 단계로. ──
export interface FinalMaskResult {
  maskedText: string; // 외부로 나가는 유일한 텍스트
  mappings: MaskMapping[]; // → SecureClientMemory (WorkflowState 아님)
}

// 토큰별 컨텍스트 요약 (P2) — raw 없이 "어디서 몇 번 나왔는지"만 확정 직전에
// 계산해 둔다. maskedExcerpt는 원문 주변 문맥을 잘라낸 뒤 같은 자리에서
// 즉시 마스킹까지 적용한 결과다 — 원문 위치·raw는 이 함수 밖으로 나가지 않는다.
export interface MaskingTokenContext {
  token: string; // "[회사A]" — 적용된 토큰(또는 range-generalize 치환 문구)
  kind: SensitiveKind;
  slide?: number; // pptx 소스일 때만 — "--- 슬라이드 N ---" 마커 기준
  occurrenceCount: number; // 문서 내 발생 횟수
  maskedExcerpt: string; // 마스킹된 주변 문장(원문 조각 아님)
}

// 검수 카드 골격 유지용 비민감 요약 — raw 없이 kind/개수/토큰만.
// 확정 직후 WorkflowState에 저장해, 검수 화면이 카드 구조를 그대로 둔 채
// 항목별 상세를 "적용/유지/제외 + 토큰" 요약으로 접을 수 있게 한다.
export interface MaskingGroupSummary {
  kind: SensitiveKind;
  totalCount: number;
  appliedCount: number; // 마스킹 토큰으로 치환됨
  keptCount: number; // "유지"로 확정된 공개 엔티티 (실명 유지)
  skippedCount: number; // 해제했거나 더미로 남겨 미적용
  tokens: string[]; // 적용된 토큰/치환 문구 (예: "[전화A]", "수십억 원대")
  uncertainCount: number; // dummyConfidence "uncertain"인 항목 수 (검토 필요 신호)
  uncertainKeptCount: number; // 그중 "유지"로 확정되어 실명이 그대로 나가는 항목 수
  tokenContexts: MaskingTokenContext[]; // 토큰별 상세(정보 종류·슬라이드·발생횟수·문맥)
}

// 파일명도 마스킹 대상 (실사용#32) — 원본 파일명은 화면 어디에도 노출 금지
export interface UploadedFileMeta {
  originalFileName: string; // ⚠️ 민감 취급 — SecureClientMemory급
  displayName: string; // 마스킹된 표시명 (예: "화면정의서_[담당자A].pptx")
}

// 이미지 자산 (Step 9) — opt-in 분석 경로. 원본 이미지 데이터는 민감 취급(메모리만).
export interface ImageAsset {
  assetId: string;
  sourceSlide?: number; // PPT 계보
  selectedForAnalysis: boolean; // 기본 false (텍스트만이 기본값)
  excludedReason?: string;
  excludedNote?: string;
  sensitivityHint?: "none" | "possible" | "high";
}

// 이미지 전송 동의 상태 (Step 9)
export interface ImageConsent {
  consented: boolean; // 명시적 동의
  consentedAssetIds: string[]; // 동의한 이미지만 전송
  // 멀티모달 응답은 저장 전 마스킹 엔진 재통과(실명 재유입 차단). 저장은 항상 masked 기준.
}

// 마스킹에서 "유지(실명)"로 확정된 공개 엔티티 → ④ 분석 대상 브랜드 소스로 연결
export interface ExtractedAnalysisTarget {
  name: string; // 공개 정보라 실명 저장 허용
  entityKind: AnalysisTargetKind;
}

// 내 사전 항목 (lib/dictionary는 Step 4에서 — 여기선 탐지 입력 계약만 정의)
export interface DictionaryEntry {
  id: string;
  value: string; // "가상전자" / "가상담당자A"
  kind: "company" | "client" | "product" | "person";
  scope: "project" | "global"; // person은 기본 global (실사용#27)
}
