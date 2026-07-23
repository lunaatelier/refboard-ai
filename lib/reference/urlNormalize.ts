// URL 정규화 (P10 캐시 규칙 — 브랜드 분석/OG 메타 캐시 키에 공통으로 쓴다).
// www 유무, 트레일링 슬래시, 쿼리·해시 차이로 같은 페이지가 다른 캐시 키가
// 되지 않게 host+path만 남긴다. 파싱 실패(빈 문자열, 스킴 없음 등)는 트림+
// 소문자화한 원본 문자열로 폴백한다 — 캐시 miss가 나을 뿐 예외를 던지진 않는다.
export function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return url.trim().toLowerCase();
  }
}
