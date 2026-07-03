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

// ⚠️ 복원키 — SecureClientMemory 전용. 직렬화·전송·스토리지·로그 금지.
export interface MaskMapping {
  token: string; // "[회사A]"
  raw: string; // "삼성전자"
  kind: SensitiveKind;
}

// ── 검수 중: raw 포함(민감). 검수 UI에서만. WorkflowState에 넣지 말 것. ──
export interface DraftMaskResult {
  detections: Detection[];
  previewMaskedText: string;
}

// ── 확정 후: raw 없음. 이것만 다음 단계로. ──
export interface FinalMaskResult {
  maskedText: string; // 외부로 나가는 유일한 텍스트
  mappings: MaskMapping[]; // → SecureClientMemory (WorkflowState 아님)
}

// 파일명도 마스킹 대상 (실사용#32) — 원본 파일명은 화면 어디에도 노출 금지
export interface UploadedFileMeta {
  originalFileName: string; // ⚠️ 민감 취급 — SecureClientMemory급
  displayName: string; // 마스킹된 표시명 (예: "화면정의서_[담당자A].pptx")
}

// 마스킹에서 "유지(실명)"로 확정된 공개 엔티티 → ④ 분석 대상 브랜드 소스로 연결
export interface ExtractedAnalysisTarget {
  name: string; // 공개 정보라 실명 저장 허용
  entityKind: AnalysisTargetKind;
}

// 내 사전 항목 (lib/dictionary는 Step 4에서 — 여기선 탐지 입력 계약만 정의)
export interface DictionaryEntry {
  id: string;
  value: string; // "삼성전자" / "이수빈"
  kind: "company" | "client" | "product" | "person";
  scope: "project" | "global"; // person은 기본 global (실사용#27)
}
