import type { ConceptJson } from "./types";

// version "2.0"으로 표시된 컨셉은 sourceBasis(확정 브리프 스냅샷)를 반드시 가져야
// 한다. 구버전(version 없음)은 sourceBasis가 없어도 통과한다 — 타입은 하나로 두고
// 이 함수가 "신규 생성 결과에서만 필수" 규칙을 강제한다(P0 결정 — V1/V2 타입 분리
// 대신 필드+builder 강제, 기존 fixture·테스트를 깨뜨리지 않기 위함).
export function assertConceptJsonInvariant(
  concept: Pick<ConceptJson, "version" | "sourceBasis">,
): void {
  if (concept.version === "2.0" && !concept.sourceBasis) {
    throw new Error(
      "version 2.0 컨셉은 sourceBasis(확정 브리프 스냅샷)가 반드시 있어야 합니다.",
    );
  }
}
