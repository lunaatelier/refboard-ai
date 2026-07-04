import { STEP_ORDER, type Step, type WorkflowState } from "./workflow";

// 단계 접근 가드 (data-model.md §2). UI 잠금과 별개로 로직에서도 검증하는 이중 방어.
// - 완료한 단계는 언제든 재방문 가능.
// - 미완료 단계는 모든 선행 단계가 완료됐을 때만 진입 가능.
// - 보안 게이트: maskedText 없이는 analysis 이후 전부 차단 (마스킹 하드 게이트).
export function canAccessStep(target: Step, state: WorkflowState): boolean {
  if (state.completedSteps.includes(target)) return true;

  const targetIdx = STEP_ORDER.indexOf(target);
  if (targetIdx < 0) return false;

  const prerequisitesDone = STEP_ORDER.slice(0, targetIdx).every((s) =>
    state.completedSteps.includes(s),
  );
  if (!prerequisitesDone) return false;

  if (targetIdx >= STEP_ORDER.indexOf("analysis") && !state.maskedText) {
    // 재활용 (Step 13): 분석 JSON 시작이면 마스킹 없이 reference 이후 접근 허용.
    // 저장된 JSON은 마스킹된 상태라(실명 없음) 보안 게이트를 이미 통과한 데이터다.
    const recycled = state.sourceType === "analysis-json" && !!state.analysis;
    if (!recycled) return false;
  }

  return true;
}
