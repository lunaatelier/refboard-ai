import { finalizeMask } from "./apply";
import { detect } from "./detect";
import type { DictionaryEntry, FinalMaskResult, MaskMapping } from "./types";

// 응답 재마스킹 (Step 9, 필수) — 멀티모달/AI 응답이 실명(로고·회사명 등)을
// 다시 뱉을 수 있으므로, 저장 전 마스킹 엔진을 한 번 더 통과시킨다.
//
// 기존 복원키(existingMappings)를 두 용도로 쓴다:
// 1) 사전 시드 — 기존에 가린 실명이 응답에 재등장하면 다시 탐지되도록
// 2) 토큰 시드 — 같은 실명 = 같은 토큰, 새 실명 = 이어지는 인덱스 (충돌 방지)

const DICT_SEEDABLE = ["company", "client", "product", "personName"] as const;

export function remaskText(
  text: string,
  dictionary: DictionaryEntry[],
  existingMappings: MaskMapping[],
): FinalMaskResult {
  const seedDict: DictionaryEntry[] = existingMappings
    .filter((m) =>
      (DICT_SEEDABLE as readonly string[]).includes(m.kind),
    )
    .map((m, i) => ({
      id: `remask-seed-${i}`,
      value: m.raw,
      kind: m.kind === "personName" ? "person" : (m.kind as "company" | "client" | "product"),
      scope: "project" as const,
    }));

  const detections = detect(text, [...dictionary, ...seedDict]);
  return finalizeMask(text, detections, [], existingMappings);
}
