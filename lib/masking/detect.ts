import { classifyDummy, MASK_RULES } from "./rules";
import type { Detection, DictionaryEntry, SensitiveKind } from "./types";

// 탐지 엔진 (phase1-masking-spec §4) — isomorphic 순수 함수.
// 1) 정규식 규칙 매칭 → 2) 사전 매칭 → 3) 인덱스 겹침 제거(넓은 범위 우선) → 4) start 정렬

const DICT_KIND_MAP: Record<DictionaryEntry["kind"], SensitiveKind> = {
  company: "company",
  client: "client",
  product: "product",
  person: "personName",
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Candidate {
  kind: SensitiveKind;
  raw: string;
  start: number;
  end: number;
  source: "rule" | "dictionary";
}

export function detect(
  text: string,
  dictionary: DictionaryEntry[] = [],
): Detection[] {
  const candidates: Candidate[] = [];

  for (const rule of MASK_RULES) {
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      candidates.push({
        kind: rule.kind,
        raw: m[0],
        start: m.index,
        end: m.index + m[0].length,
        source: "rule",
      });
      if (m[0].length === 0) regex.lastIndex++; // 빈 매치 무한루프 방지
    }
  }

  for (const entry of dictionary) {
    if (!entry.value) continue;
    const regex = new RegExp(escapeRegExp(entry.value), "g");
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      candidates.push({
        kind: DICT_KIND_MAP[entry.kind],
        raw: m[0],
        start: m.index,
        end: m.index + m[0].length,
        source: "dictionary",
      });
    }
  }

  // 겹침 제거: 넓은 범위 우선 (예: URL 안의 IP는 URL이 이김)
  const sorted = [...candidates].sort(
    (a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start,
  );
  const kept: Candidate[] = [];
  for (const c of sorted) {
    const overlaps = kept.some((k) => c.start < k.end && k.start < c.end);
    if (!overlaps) kept.push(c);
  }
  kept.sort((a, b) => a.start - b.start);

  return kept.map((c, i) => {
    const dummyConfidence = classifyDummy(c.kind, c.raw);
    return {
      id: `det-${i}`,
      kind: c.kind,
      raw: c.raw,
      start: c.start,
      end: c.end,
      source: c.source,
      // 더미 추정 항목은 기본 미적용(검수 부담 경감, 실사용#13/#29) — 사용자가 최종 판단
      enabled: dummyConfidence !== "likely-dummy",
      ...(dummyConfidence ? { dummyConfidence } : {}),
      // 법정 의무고지 (실사용#28): 개인정보 보호책임자 등. 외부 전송 시 가림은 동일,
      // 최종 산출물에서 "직접 입력 필요" 자리로 표시하기 위한 태깅.
      ...(isLegalDisclosureContext(text, c) ? { isLegallyRequiredDisclosure: true } : {}),
    };
  });
}

const LEGAL_DISCLOSURE_KINDS: SensitiveKind[] = ["personName", "email", "phone"];
const LEGAL_CONTEXT = /개인\s*정보\s*보호\s*책임자|정보\s*보호\s*최고\s*책임자/;

function isLegalDisclosureContext(text: string, c: Candidate): boolean {
  if (!LEGAL_DISCLOSURE_KINDS.includes(c.kind)) return false;
  return LEGAL_CONTEXT.test(text.slice(Math.max(0, c.start - 60), c.start));
}
