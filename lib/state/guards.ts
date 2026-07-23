import { STEP_ORDER, type Step, type WorkflowState } from "./workflow";

// 단계 접근 가드 (data-model.md §2). UI 잠금과 별개로 로직에서도 검증하는 이중 방어.
// - 완료한 단계는 언제든 재방문 가능.
// - 미완료 단계는 모든 선행 단계가 완료됐을 때만 진입 가능.
// - 보안 게이트: maskedText 없이는 analysis 이후 전부 차단 (마스킹 하드 게이트).
export function canAccessStep(target: Step, state: WorkflowState): boolean {
  // 업로드는 새 프로젝트를 시작하는 진입점이므로 진행 이력과 무관하게 항상 연다.
  if (target === "upload") return true;

  // 새로고침으로 복구한 원문 프로젝트에는 분석 결과만 남고, 마스킹 원문과
  // 확정된 maskedText는 의도적으로 남지 않는다. 이 상태에서 완료 이력만 보고
  // 마스킹 화면을 다시 열면 "검수할 문서가 없습니다"라는 막다른 화면이 된다.
  if (
    target === "masking" &&
    !!state.analysis &&
    !state.maskedText &&
    state.sourceType !== "analysis-json"
  ) {
    return false;
  }

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
