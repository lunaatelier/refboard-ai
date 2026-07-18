import { TOKEN_BASE } from "./rules";
import type {
  Detection,
  DraftMaskResult,
  FinalMaskResult,
  MaskingGroupSummary,
  MaskingTokenContext,
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
): { maskedText: string; mappings: MaskMapping[]; replacements: Replacement[] } {
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

  return { maskedText, mappings, replacements };
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
  const { maskedText, mappings } = buildMask(
    text,
    detections,
    numericDetections,
    seedMappings,
  );
  return { maskedText, mappings };
}

const EXCERPT_RADIUS = 60;
const SLIDE_MARKER_RE = /--- 슬라이드 (\d+) ---/g;

// pptx 소스에서만 존재하는 "--- 슬라이드 N ---" 마커 기준으로, 해당 위치가
// 속한 슬라이드 번호를 찾는다 (app/page.tsx의 slideHasSensitiveHint와 동일 규칙).
function slideAt(text: string, pos: number): number | undefined {
  SLIDE_MARKER_RE.lastIndex = 0;
  let current: number | undefined;
  let match: RegExpExecArray | null;
  while ((match = SLIDE_MARKER_RE.exec(text))) {
    if (match.index > pos) break;
    current = Number(match[1]);
  }
  return current;
}

// 문맥 창 — 줄바꿈이 반경 안에 있으면 그 줄 경계까지, 없으면 고정 반경으로 자른다.
function excerptWindow(text: string, start: number, end: number): { from: number; to: number } {
  let from = Math.max(0, start - EXCERPT_RADIUS);
  let to = Math.min(text.length, end + EXCERPT_RADIUS);
  const leftBreak = text.lastIndexOf("\n", start);
  if (leftBreak >= from) from = leftBreak + 1;
  const rightBreak = text.indexOf("\n", end);
  if (rightBreak >= 0 && rightBreak <= to) to = rightBreak;
  return { from, to };
}

// 창 안의 문맥에 실제 치환 목록을 다시 적용해 마스킹된 상태로만 반환한다.
// 창 경계가 어떤 치환 구간을 관통해도, 그 구간의 창 안쪽 부분은 항상 토큰
// 텍스트로 대체되므로 raw 조각이 노출되는 경우는 없다.
function maskWindow(text: string, from: number, to: number, replacements: Replacement[]): string {
  const windowText = text.slice(from, to);
  const local = replacements
    .filter((r) => r.start < to && r.end > from)
    .map((r) => ({
      start: Math.max(r.start, from) - from,
      end: Math.min(r.end, to) - from,
      text: r.text,
    }))
    .sort((a, b) => a.start - b.start);
  let out = windowText;
  for (const r of [...local].reverse()) {
    out = out.slice(0, r.start) + r.text + out.slice(r.end);
  }
  const prefix = from > 0 ? "…" : "";
  const suffix = to < text.length ? "…" : "";
  return prefix + out.trim() + suffix;
}

// 확정 직전(원문·raw 폐기 전)에 호출 — kind별 카드 골격을 유지하기 위한
// 비민감 요약을 만든다. raw는 절대 포함하지 않는다(토큰·개수·마스킹된 문맥만).
export function summarizeMasking(
  text: string,
  detections: Detection[],
  numericDetections: NumericDetection[],
  mappings: MaskMapping[],
): MaskingGroupSummary[] {
  const groups = new Map<string, MaskingGroupSummary>();

  const ensure = (kind: Detection["kind"]): MaskingGroupSummary => {
    let g = groups.get(kind);
    if (!g) {
      g = {
        kind,
        totalCount: 0,
        appliedCount: 0,
        keptCount: 0,
        skippedCount: 0,
        tokens: [],
        uncertainCount: 0,
        uncertainKeptCount: 0,
        tokenContexts: [],
      };
      groups.set(kind, g);
    }
    return g;
  };

  for (const d of detections) {
    const g = ensure(d.kind);
    g.totalCount++;
    if (!d.enabled) g.skippedCount++;
    else if (d.keepPlaintext) g.keptCount++;
    else g.appliedCount++;
    if (d.dummyConfidence === "uncertain") {
      g.uncertainCount++;
      if (d.enabled && d.keepPlaintext) g.uncertainKeptCount++;
    }
  }

  for (const n of numericDetections) {
    const g = ensure(n.kind);
    g.totalCount++;
    if (n.mode === "keep") g.keptCount++;
    else g.appliedCount++;
  }

  // 토큰(치환 결과)은 실제 적용 순서를 보존하려 mappings를 kind별로 나눠 채운다.
  for (const m of mappings) {
    groups.get(m.kind)?.tokens.push(m.token);
  }
  // range-generalize는 토큰이 아닌 치환 문구라 mappings에 없다 — 별도로 채운다.
  for (const n of numericDetections) {
    if (n.mode === "range-generalize") {
      ensure(n.kind).tokens.push(n.generalized ?? "비공개 수치");
    }
  }

  // 토큰별 컨텍스트(P2) — 같은 (kind, raw) 매핑 시드를 넘겨 실제 확정 시와
  // 동일한 토큰이 재생성되도록 한 뒤, replacements로 문맥 창을 마스킹한다.
  const { replacements } = buildMask(text, detections, numericDetections, mappings);

  for (const m of mappings) {
    const applied = detections.filter(
      (d) => d.kind === m.kind && d.raw === m.raw && isMaskable(d),
    );
    if (applied.length === 0) continue; // 이 문서에 없는(다른 문서에서 넘어온) 시드 매핑
    const first = applied.reduce((a, b) => (a.start < b.start ? a : b));
    const occurrenceCount = detections.filter(
      (d) => d.kind === m.kind && d.raw === m.raw,
    ).length;
    const { from, to } = excerptWindow(text, first.start, first.end);
    ensure(m.kind).tokenContexts.push({
      token: m.token,
      kind: m.kind,
      slide: slideAt(text, first.start),
      occurrenceCount,
      maskedExcerpt: maskWindow(text, from, to, replacements),
    });
  }

  for (const n of numericDetections) {
    if (n.mode === "keep") continue;
    const token =
      n.mode === "exact-mask"
        ? (mappings.find((m) => m.kind === n.kind && m.raw === n.raw)?.token ?? n.raw)
        : (n.generalized ?? "비공개 수치");
    const { from, to } = excerptWindow(text, n.start, n.end);
    ensure(n.kind).tokenContexts.push({
      token,
      kind: n.kind,
      slide: slideAt(text, n.start),
      occurrenceCount: 1,
      maskedExcerpt: maskWindow(text, from, to, replacements),
    });
  }

  return [...groups.values()];
}
