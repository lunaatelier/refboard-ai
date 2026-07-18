// 컨셉 프리뷰 렌더러가 카드·지표·표에 쓸 조각을 실제 maskedContent에서 뽑아내는
// 순수 함수 (P9-B). "카드 1/2/3", "지표 1/2/3" 같은 고정 플레이스홀더 대신, 실제
// 텍스트를 의미 단위로 나눠 쓴다. 구조화된 값(숫자 등)을 못 찾은 경우에만 렌더러가
// "데이터 없음"으로 표시한다 — 이 함수는 그 판단에 필요한 빈 값을 그대로 반환한다.

// 문장 부호·쉼표·줄바꿈으로 나눈다. 구두점이 없는 한 문장짜리 콘텐츠는 원문
// 그대로 항목 1개로 취급한다(억지로 쪼개지 않는다).
export function splitContentItems(content: string, max: number): string[] {
  const trimmed = content.trim();
  if (!trimmed) return [];
  const parts = trimmed
    .split(/[.。!?]\s*|[,，]\s*|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return (parts.length > 0 ? parts : [trimmed]).slice(0, max);
}

export interface ExtractedStat {
  value: string; // 숫자를 못 찾으면 빈 문자열 — 렌더러가 "데이터 없음"으로 표시
  label: string;
}

// 숫자 + (선택)만/억/조 같은 자릿수 단위 + (선택)%/배/건 같은 계량 단위.
// "35억원", "98%", "3배" 모두 값 전체를 하나로 묶어 인식한다.
const NUMBER_PATTERN =
  /[0-9][0-9,.]*\s*(?:조|억|천만|백만|만|천)?\s*(?:%|배|건|명|개|원|시간|일|주|개월|년|위)?/;

export function extractStat(chunk: string): ExtractedStat {
  const trimmed = chunk.trim();
  const match = NUMBER_PATTERN.exec(trimmed);
  if (!match) return { value: "", label: trimmed };
  const value = match[0].trim();
  const label = (
    trimmed.slice(0, match.index) +
    trimmed.slice(match.index + match[0].length)
  )
    .replace(/\s+/g, " ")
    .trim();
  return { value, label: label || trimmed };
}

// 기술 스택/캐러셀처럼 짧은 항목 나열에 쓴다 — 슬래시·가운뎃점·쉼표·공백 어디로
// 나열해도 항목 단위로 쪼갠다.
export function splitChips(content: string, max: number): string[] {
  const trimmed = content.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/[/·,，、]+|\s{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, max);
}
