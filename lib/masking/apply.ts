import { TOKEN_BASE } from "./rules";
import type {
  Detection,
  DraftMaskResult,
  FinalMaskResult,
  MaskMapping,
  NumericDetection,
} from "./types";

// 치환 + 복원매핑 생성 (phase1-masking-spec §5) — isomorphic 순수 함수.
// 같은 raw = 같은 토큰, 다른 raw = kind별 알파벳 인덱싱([회사A], [회사B]...).
// 뒤에서 앞으로 치환해 인덱스 밀림 방지.
//
// 수치 마스킹 (Step 6):
// - exact-mask       → 토큰([투자금A]) + 복원매핑 (실명본에서 복원 가능)
// - range-generalize → "수십억 원대" 문구 치환. 복원매핑을 만들지 않는다 —
//                      같은 문구가 여러 수치에서 나올 수 있어 복원이 모호해지므로,
//                      실명본에서도 일반화 문구를 유지한다(안전한 방향으로 실패).
// - keep             → 원문 유지 (사용자가 공개 확정한 경우만)

function alphaIndex(n: number): string {
  // 0→A, 1→B, ... 25→Z, 26→AA ...
  let s = "";
  let i = n;
  do {
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return s;
}

function isMaskable(d: Detection): boolean {
  return d.enabled && !d.keepPlaintext;
}

interface Replacement {
  start: number;
  end: number;
  text: string;
}

function buildMask(
  text: string,
  detections: Detection[],
  numericDetections: NumericDetection[] = [],
  seedMappings: MaskMapping[] = [],
): { maskedText: string; mappings: MaskMapping[] } {
  const active = detections.filter(isMaskable);

  // 같은 (kind, raw) → 같은 토큰.
  // seedMappings(기존 복원키)로 시드하면 재마스킹 시 같은 실명 = 같은 토큰이 유지되고
  // 새 실명은 이어지는 인덱스([회사B]...)를 받아 토큰 충돌이 없다 (Step 9 응답 재마스킹).
  const tokenByKey = new Map<string, string>();
  const countByKind = new Map<string, number>();
  const mappings: MaskMapping[] = [...seedMappings];
  for (const m of seedMappings) {
    tokenByKey.set(`${m.kind} ${m.raw}`, m.token);
    countByKind.set(m.kind, (countByKind.get(m.kind) ?? 0) + 1);
  }

  const tokenFor = (kind: Detection["kind"], raw: string): string => {
    const key = `${kind} ${raw}`;
    const existing = tokenByKey.get(key);
    if (existing) return existing;
    const idx = countByKind.get(kind) ?? 0;
    countByKind.set(kind, idx + 1);
    const token = `[${TOKEN_BASE[kind]}${alphaIndex(idx)}]`;
    tokenByKey.set(key, token);
    mappings.push({ token, raw, kind });
    return token;
  };

  const replacements: Replacement[] = [];

  for (const d of active) {
    replacements.push({ start: d.start, end: d.end, text: tokenFor(d.kind, d.raw) });
  }

  for (const n of numericDetections) {
    if (n.mode === "keep") continue;
    replacements.push({
      start: n.start,
      end: n.end,
      text:
        n.mode === "exact-mask"
          ? tokenFor(n.kind, n.raw)
          : (n.generalized ?? "비공개 수치"),
    });
  }

  replacements.sort((a, b) => a.start - b.start);

  let maskedText = text;
  for (const r of [...replacements].reverse()) {
    maskedText = maskedText.slice(0, r.start) + r.text + maskedText.slice(r.end);
  }

  return { maskedText, mappings };
}

// 검수 중 미리보기 — Detection(raw 포함)을 그대로 유지. 검수 UI에서만 사용.
export function createDraft(
  text: string,
  detections: Detection[],
  numericDetections: NumericDetection[] = [],
): DraftMaskResult {
  return {
    detections,
    numericDetections,
    previewMaskedText: buildMask(text, detections, numericDetections).maskedText,
  };
}

// 확정 — raw 없는 FinalMaskResult만 반환. 호출 측은 이후 원문·Detection[]을 즉시 폐기한다.
export function finalizeMask(
  text: string,
  detections: Detection[],
  numericDetections: NumericDetection[] = [],
  seedMappings: MaskMapping[] = [],
): FinalMaskResult {
  return buildMask(text, detections, numericDetections, seedMappings);
}
