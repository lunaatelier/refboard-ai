// hash 기반 최신성 판정 (§6.5) — 상위 결정이 바뀌면 하위 결과를 삭제하지 않고
// "최신 아님(stale)"으로만 표시한다. 이 파일은 판정 로직만 담당하며, 실제로
// 어떤 화면에 배지를 그릴지는 해당 UI(P3/P5)가 결정한다.

export interface RevisionSnapshot {
  analysisHash: string;
  directionHash?: string;
  briefHash?: string;
}

export type StaleReason = "analysis-changed" | "direction-changed" | "brief-changed";

// snapshot = 결과가 만들어질 때 기준으로 삼았던 hash, current = 지금 다시 계산한 hash.
// 필드가 한쪽에만 있으면(예: 아직 방향을 안 정한 시점의 결과) 비교하지 않는다 —
// 없는 값끼리 비교해 오탐(false positive)으로 stale 처리하지 않기 위함.
export function computeStaleReasons(
  snapshot: RevisionSnapshot,
  current: RevisionSnapshot,
): StaleReason[] {
  const reasons: StaleReason[] = [];
  if (snapshot.analysisHash !== current.analysisHash) {
    reasons.push("analysis-changed");
  }
  if (
    snapshot.directionHash !== undefined &&
    current.directionHash !== undefined &&
    snapshot.directionHash !== current.directionHash
  ) {
    reasons.push("direction-changed");
  }
  if (
    snapshot.briefHash !== undefined &&
    current.briefHash !== undefined &&
    snapshot.briefHash !== current.briefHash
  ) {
    reasons.push("brief-changed");
  }
  return reasons;
}

export function isStale(
  snapshot: RevisionSnapshot,
  current: RevisionSnapshot,
): boolean {
  return computeStaleReasons(snapshot, current).length > 0;
}

// 비동기 응답을 병합해도 되는지 판정 — "상위 hash가 현재 값과 일치하지 않는 응답은
// 화면 상태에 병합하지 않는다"(§6.5)를 재사용 가능한 이름으로 노출한다.
export function shouldApplyResponse(
  expectedHash: string,
  currentHash: string,
): boolean {
  return expectedHash === currentHash;
}
