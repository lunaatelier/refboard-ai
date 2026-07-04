import type { ImageHint } from "../reference/types";
import type { OutputPreset } from "../concept/types";

// 출력 프리셋 (Step 12-b) — 컨셉서 밀도 제어. 볼륨 폭발 방지 (flow-spec ⑤⑥).

export interface RenderConfig {
  preset: OutputPreset;
  visualPageId?: string; // 시각 대표 (표지, 항상 맨 앞)
  contentPageId?: string; // 내용 대표
  includedSubPageIds: string[]; // 선택한 서브만
  imageHints?: ImageHint[]; // detailed에서만 출력
}

export const PRESET_LABELS: Record<OutputPreset, { label: string; desc: string }> = {
  summary: {
    label: "요약형",
    desc: "빠른 내부 공유 — 3안 비교 + 내용 대표 + 핵심 키워드",
  },
  proposal: {
    label: "제안형",
    desc: "클라이언트 제출 — 3안 + 표지·대표·선택 서브 + 디자인 방향",
  },
  detailed: {
    label: "상세형",
    desc: "제작 전달 — 섹션별 콘텐츠 매핑 + 근거 + 이미지 힌트까지",
  },
};

export function presetIncludes(preset: OutputPreset) {
  return {
    subPages: preset !== "summary",
    sectionMapping: preset === "detailed",
    imageHints: preset === "detailed",
  };
}

// 텍스트 변환기 — 마스킹본은 identity, 실명본은 restore(클라이언트 메모리에서만)
export type TextTransform = (text: string) => string;
export const identityTransform: TextTransform = (t) => t;
