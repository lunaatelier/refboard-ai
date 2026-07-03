import type { AnalysisTargetKind } from "./types";

// 엔티티 민감도 등급 (Step 6, CLAUDE.md §4.1.1)
// 기밀 = 기본 가림 / 공개 = 사용자가 확정한 것만 실명 외부 전송 허용.
// AI 자동 판단 금지 — 등급 확정은 항상 사용자.

export const CONFIDENTIAL_ENTITY_KINDS: AnalysisTargetKind[] = [
  "customer",
  "investor",
  "partner",
];

export const ENTITY_KIND_LABELS: Record<AnalysisTargetKind, string> = {
  customer: "우리 고객사 (기밀·가림)",
  investor: "투자사 (기밀·가림)",
  partner: "비공개 협력사 (기밀·가림)",
  competitor: "경쟁사 (공개·유지 가능)",
  benchmarkBrand: "벤치마킹 브랜드 (공개·유지 가능)",
  roleModel: "롤모델 (공개·유지 가능)",
  publicReference: "공개 참고 (공개·유지 가능)",
};

export function isPublicEntityKind(kind: AnalysisTargetKind): boolean {
  return !CONFIDENTIAL_ENTITY_KINDS.includes(kind);
}
