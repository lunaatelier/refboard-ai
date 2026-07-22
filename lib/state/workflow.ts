// WorkflowState — 일반 워크플로 상태. 마스킹된 것만 담는다 (data-model.md §2).
// 원문·복원키는 여기 절대 넣지 않는다 → SecureClientMemory (Step 3에서 추가).

export type Step =
  | "upload"
  | "masking"
  | "analysis"
  | "reference"
  | "concept"
  | "design-md";

export const STEP_ORDER: Step[] = [
  "upload",
  "masking",
  "analysis",
  "reference",
  "concept",
  "design-md",
];

export const STEP_LABELS: Record<Step, string> = {
  upload: "업로드",
  masking: "마스킹 검수",
  analysis: "분석 결과",
  reference: "레퍼런스·무드",
  concept: "컨셉 3안",
  "design-md": "디자인 MD",
};

import type { DocumentPurpose } from "../analysis/documentPurpose";
import type { ProjectAnalysis, ProjectDirective } from "../analysis/types";
import type { ConceptJson } from "../concept/types";
import type {
  ExtractedAnalysisTarget,
  MaskingGroupSummary,
} from "../masking/types";
import type { ReferenceResult } from "../reference/types";

export interface WorkflowState {
  currentStep: Step;
  completedSteps: Step[];
  // 프로젝트별 서버 호출 예산(P10-B)을 세는 데 쓰는 비식별 키. 분석 착수 시
  // 한 번만 발급되고 이후 계속 유지된다 — 새로고침해도 같은 프로젝트로 이어지게
  // IndexedDB 스냅샷에도 포함한다(lib/state/persistence.ts). 민감 정보 아님.
  projectId?: string;
  // 재활용 모드 (Step 13). 미설정 = "raw-document" (일반 경로).
  // "analysis-json" = 저장된 분석 JSON으로 시작 → 마스킹 건너뛰고 ④ 직행, 복원키 없음.
  sourceType?: "raw-document" | "analysis-json";
  maskedText?: string; // 마스킹 확정 후에만 존재 — analysis 이후 단계의 보안 게이트 키
  // 확정 시점의 kind별 비민감 요약(raw 없음) — 검수 화면이 카드 골격을 유지한 채
  // "적용/유지/제외 + 토큰"으로 접어 보여주는 데 쓴다.
  maskingSummary?: MaskingGroupSummary[];
  // 마스킹 검수에서 "유지"로 확정된 공개 엔티티 (실명 = 공개 정보라 허용)
  extractedAnalysisTargets?: ExtractedAnalysisTarget[];
  documentPurpose?: DocumentPurpose; // 업로드 직후 로컬 판정 (Step 8, 실사용#14)
  projectDirective?: ProjectDirective[]; // 전역 지시 — 이후 모든 프롬프트에 주입 (Step 8)
  analysis?: ProjectAnalysis; // Phase 2 (마스킹된 내용만 보유)
  references?: ReferenceResult; // Phase 3 (Step 10-a부터 점진적으로 채움)
  conceptJson?: ConceptJson; // Phase 4 (SSoT — maskedContent만 보유)
}

export const initialWorkflowState: WorkflowState = {
  currentStep: "upload",
  completedSteps: [],
};
