// 가져올 점/피할 점 사용자 채택 (P6, 개선 지시서 P6 item 9) — 순수 함수만.
// 심층 분석 직후 wowPoints/painPoints로 한 번만 시드하고(멱등, sectionPriority.ts와
// 같은 패턴), 이후 사용자가 체크 해제·직접 추가한 결과만 편집 상태에 남는다.

import type { AnalysisTargetAnalysis, BrandDecisionOverride } from "./types";

export type BrandPatternField = "adoptedPatterns" | "avoidedPatterns";

// 이미 시드된(또는 사용자가 편집한) 항목은 절대 덮어쓰지 않는다.
export function seedBrandDecision(
  targetId: string,
  deep: AnalysisTargetAnalysis,
  existing: Record<string, BrandDecisionOverride>,
): Record<string, BrandDecisionOverride> {
  if (existing[targetId]) return existing;
  return {
    ...existing,
    [targetId]: {
      adoptedPatterns: [...deep.wowPoints],
      avoidedPatterns: [...deep.painPoints],
    },
  };
}

export function togglePattern(
  override: BrandDecisionOverride,
  field: BrandPatternField,
  pattern: string,
): BrandDecisionOverride {
  const list = override[field];
  const next = list.includes(pattern)
    ? list.filter((p) => p !== pattern)
    : [...list, pattern];
  return { ...override, [field]: next };
}

export function addCustomPattern(
  override: BrandDecisionOverride,
  field: BrandPatternField,
  pattern: string,
): BrandDecisionOverride {
  const trimmed = pattern.trim();
  if (!trimmed || override[field].includes(trimmed)) return override;
  return { ...override, [field]: [...override[field], trimmed] };
}
