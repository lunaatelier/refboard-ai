import type { DummyPatternRule, SensitiveKind } from "./types";

// 정규식 규칙 세트 (phase1-masking-spec §3). 한국 환경 기준.
// isomorphic 주의: Node/브라우저 전용 API 사용 금지 — 순수 데이터만.

export interface MaskRule {
  kind: SensitiveKind;
  regex: RegExp; // g 플래그 필수
}

export const MASK_RULES: MaskRule[] = [
  // url을 email보다 먼저 두지만, 우선순위는 detect의 "넓은 범위 우선"이 결정한다.
  { kind: "url", regex: /https?:\/\/[^\s<>"'\])]+/g },
  {
    kind: "email",
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g,
  },
  // 주민등록번호를 phone보다 먼저 매칭 (000000-0000000)
  { kind: "rrn", regex: /\b\d{6}-[1-4]\d{6}\b/g },
  // 사업자등록번호 000-00-00000 (실사용#12)
  { kind: "businessRegNo", regex: /\b\d{3}-\d{2}-\d{5}\b/g },
  // 전화: 010-0000-0000, 02-000-0000, 하이픈/공백/점 변형
  {
    kind: "phone",
    regex: /\b0\d{1,2}[-\s.]\d{3,4}[-\s.]\d{4}\b/g,
  },
  { kind: "ip", regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  // API Key 후보: 알려진 접두(sk-, AIza) 또는 32자 이상 연속 영숫자.
  // 오탐이 잦으므로 검수에서 쉽게 해제 가능해야 한다 (§3 구현 주의).
  {
    kind: "apikey",
    regex: /\b(?:sk-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{20,}|[A-Za-z0-9]{32,})\b/g,
  },
];

// 치환 토큰 베이스 (kind별 알파벳 인덱싱: [회사A], [회사B]...)
export const TOKEN_BASE: Record<SensitiveKind, string> = {
  email: "이메일",
  phone: "전화",
  url: "URL",
  ip: "IP",
  apikey: "KEY",
  rrn: "주민번호",
  company: "회사",
  client: "고객사",
  product: "제품",
  personName: "담당자",
  businessRegNo: "사업자번호",
  certificationNo: "인증번호",
  address: "주소",
  financialMetric: "투자금",
  businessMetric: "지표",
  internalKpi: "KPI",
};

// 더미/플레이스홀더 추정 패턴 (실사용#13/#29) — 확정이 아니라 힌트. 사용자가 최종 판단.
export const DUMMY_PATTERN_RULES: DummyPatternRule[] = [
  // 010-0000-XXXX, 000-0000-0000 류
  { kind: "phone", pattern: /^0\d{1,2}[-\s.]0{3,4}[-\s.]\d{4}$/, confidence: "likely-dummy" },
  { kind: "phone", pattern: /^000[-\s.]0{3,4}[-\s.]0{4}$/, confidence: "likely-dummy" },
  // none@/noreply@/no-reply@/norply@ 류
  { kind: "email", pattern: /^(?:none|noreply|no-?reply|norply)@/i, confidence: "likely-dummy" },
  // 순차/반복 숫자 사업자번호 (123-12-12345 형태)
  { kind: "businessRegNo", pattern: /^123-\d{2}-\d{5}$/, confidence: "uncertain" },
  { kind: "businessRegNo", pattern: /^000-00-00000$/, confidence: "likely-dummy" },
];

export function classifyDummy(
  kind: SensitiveKind,
  raw: string,
): DummyPatternRule["confidence"] | undefined {
  for (const rule of DUMMY_PATTERN_RULES) {
    if (rule.kind === kind && rule.pattern.test(raw)) return rule.confidence;
  }
  return undefined;
}
