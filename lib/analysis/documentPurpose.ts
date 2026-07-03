// 문서 타입 판정 (Step 8, 실사용#14) — 업로드 직후, 마스킹 전에 분류.
// ⚠️ 마스킹 전 원문을 다루므로 외부 AI 사용 금지 → 로컬 휴리스틱 순수 함수.
// 판정은 참고용 제안이며, 사용자가 "일반 경로로 계속"을 선택하면 무시된다.

export type DocumentPurpose =
  | "project-brief" // 기획서/화면설계서/화면정의서 (기본)
  | "company-profile" // 회사소개서 (자사 마케팅 자료)
  | "template-only"; // 표지·간지·목차만 있는 템플릿 (본문 없음)

export interface DocumentPurposeResult {
  purpose: DocumentPurpose;
  reason: string;
}

const COMPANY_SIGNALS = [
  "회사소개서",
  "회사 소개서",
  "기업소개서",
  "경영이념",
  "경영 이념",
  "조직도",
  "수상",
  "인증",
  "재무제표",
  "매출 현황",
  "주요 고객사",
  "파트너사",
  "비전",
  "미션",
  "CI",
  "연혁",
];

const BRIEF_SIGNALS = [
  "기획서",
  "화면설계",
  "화면정의",
  "요구사항",
  "와이어프레임",
  "스토리보드",
  "기능 정의",
  "기능정의",
  "프로젝트 개요",
  "개발 범위",
  "IA",
  "UI",
  "UX",
  "레이아웃",
  "리뉴얼",
];

const TEMPLATE_SIGNALS = ["표지", "간지", "목차", "템플릿", "양식"];

function countSignals(text: string, signals: string[]): number {
  return signals.filter((s) => text.includes(s)).length;
}

export function classifyDocumentPurpose(text: string): DocumentPurposeResult {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^--- 슬라이드 \d+ ---$/.test(l));

  const company = countSignals(text, COMPANY_SIGNALS);
  const brief = countSignals(text, BRIEF_SIGNALS);
  const template = countSignals(text, TEMPLATE_SIGNALS);

  // 본문이 거의 없고 구조 키워드(표지/간지/목차)만 있으면 템플릿 요청
  if (template >= 2 && lines.length < 25 && brief + company <= 1) {
    return {
      purpose: "template-only",
      reason: "본문 없이 표지·간지·목차 구조만 감지됨",
    };
  }

  // 회사소개서 신호가 기획서 신호보다 뚜렷하면 회사소개서
  if (company >= 3 && company > brief) {
    return {
      purpose: "company-profile",
      reason: "회사소개서 성격 키워드(연혁·조직·인증·고객사 등)가 우세함",
    };
  }

  return { purpose: "project-brief", reason: "기획서/설계서로 판정" };
}
