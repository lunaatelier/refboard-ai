import { hexToHsl } from "../reference/palette";
import type { ExplicitRequirement } from "./types";

// 문서 명시 요구사항(explicitRequirements) 해석 헬퍼 — 게이트 1 정정.
// 배경/모드 요구는 "버리는" 게 아니라 하류 단계(팔레트 생성·컨셉 mode)의
// 제약 신호로 쓴다. isomorphic 순수 함수.

// 팔레트 dark 배경 앵커로 쓸 대표 배경색 1개 (여러 개면 첫 번째).
export function pickBackgroundColorRequirement(
  requirements: ExplicitRequirement[] = [],
): string | undefined {
  return requirements.find((r) => r.kind === "background-color" && r.value)
    ?.value;
}

// 문서가 명시적으로 다크(또는 라이트) 모드를 요구하는지 판정 — concept 단계에서
// uiStructure.mode를 옵션마다 자유 선택하지 못하게 고정하는 신호로 쓴다.
// 1) kind:"mode" 값이 있으면 그대로 사용
// 2) 없으면 명시된 배경색의 명도로 추정 (매우 어둡/매우 밝을 때만)
export function deriveForcedMode(
  requirements: ExplicitRequirement[] = [],
): "dark" | "light" | undefined {
  const modeReq = requirements.find((r) => r.kind === "mode" && r.value);
  if (modeReq?.value === "dark" || modeReq?.value === "light") {
    return modeReq.value;
  }
  const bg = pickBackgroundColorRequirement(requirements);
  if (bg) {
    const hsl = hexToHsl(bg);
    if (hsl && hsl.l < 0.35) return "dark";
    if (hsl && hsl.l > 0.75) return "light";
  }
  return undefined;
}
