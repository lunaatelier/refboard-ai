import type { Detection, SensitiveKind } from "./types";

// 검수 화면 "단어 직접 추가" — 원문에서 해당 단어의 모든 출현을 manual Detection으로 만든다.
// 기존 탐지와 겹치는 구간은 건너뛴다 (겹침 시 기존 탐지 우선).
export function detectWordOccurrences(
  text: string,
  word: string,
  kind: SensitiveKind,
  existing: Detection[] = [],
): Detection[] {
  const trimmed = word.trim();
  if (!trimmed) return [];

  const found: Detection[] = [];
  let from = 0;
  let n = 0;
  while (true) {
    const start = text.indexOf(trimmed, from);
    if (start < 0) break;
    const end = start + trimmed.length;
    const overlaps = existing.some((d) => start < d.end && d.start < end);
    if (!overlaps) {
      found.push({
        id: `man-${start}-${n++}`,
        kind,
        raw: trimmed,
        start,
        end,
        source: "manual",
        enabled: true,
      });
    }
    from = end;
  }
  return found;
}
