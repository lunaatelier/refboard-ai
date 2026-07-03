import type { MaskMapping } from "./types";

// 복원 — 클라이언트 전용 (mappings = SecureClientMemory).
// 결과 화면 실명 미리보기·실명본 다운로드의 렌더 시점에만 사용한다.
// 서버 코드에서 import 금지.
export function restore(maskedText: string, mappings: MaskMapping[]): string {
  let out = maskedText;
  for (const m of mappings) {
    out = out.split(m.token).join(m.raw);
  }
  return out;
}
