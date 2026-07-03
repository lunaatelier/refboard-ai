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
import type { ExtractedAnalysisTarget } from "../masking/types";
import type { ReferenceResult } from "../reference/types";

export interface WorkflowState {
  currentStep: Step;
  completedSteps: Step[];
  maskedText?: string; // 마스킹 확정 후에만 존재 — analysis 이후 단계의 보안 게이트 키
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
