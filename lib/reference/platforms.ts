import type { DomainHint } from "../analysis/types";
import type { ReferenceQuery } from "./types";

// 등록 레퍼런스 플랫폼 20종 (CLAUDE.md §7) — isomorphic 순수 데이터/함수.
// 도메인 힌트별로 노출 플랫폼이 달라지고, 연동은 "자동 검색 이동" / "키워드 복사" 두 방식.
// ⚠️ 검색어는 마스킹된 섹션에서 생성된 일반 키워드만 — 실명·기밀이 URL로 나가지 않는다.

export interface PlatformDef {
  id: string;
  name: string;
  domains: DomainHint[] | "all";
  mode: "auto-search" | "copy-keyword";
  searchUrl?: string; // {q} 치환. auto-search일 때만
  homepage: string;
  note?: string;
}

export const PLATFORMS: PlatformDef[] = [
  { id: "dribbble", name: "Dribbble", domains: "all", mode: "auto-search", searchUrl: "https://dribbble.com/search/{q}", homepage: "https://dribbble.com" },
  { id: "behance", name: "Behance", domains: "all", mode: "auto-search", searchUrl: "https://www.behance.net/search/projects?search={q}", homepage: "https://www.behance.net" },
  { id: "pinterest", name: "Pinterest", domains: ["marketing-web", "document", "generic"], mode: "auto-search", searchUrl: "https://www.pinterest.com/search/pins/?q={q}", homepage: "https://www.pinterest.com" },
  { id: "awwwards", name: "Awwwards", domains: ["marketing-web"], mode: "auto-search", searchUrl: "https://www.awwwards.com/inspiration_search/?text={q}", homepage: "https://www.awwwards.com" },
  { id: "siteinspire", name: "SiteInspire", domains: ["marketing-web"], mode: "auto-search", searchUrl: "https://www.siteinspire.com/websites?search={q}", homepage: "https://www.siteinspire.com" },
  { id: "landbook", name: "Land-book", domains: ["marketing-web"], mode: "auto-search", searchUrl: "https://land-book.com/?search={q}", homepage: "https://land-book.com" },
  { id: "onepagelove", name: "One Page Love", domains: ["marketing-web"], mode: "auto-search", searchUrl: "https://onepagelove.com/?s={q}", homepage: "https://onepagelove.com" },
  { id: "lapa", name: "Lapa Ninja", domains: ["marketing-web"], mode: "auto-search", searchUrl: "https://www.lapa.ninja/search/?q={q}", homepage: "https://www.lapa.ninja" },
  { id: "godly", name: "Godly", domains: ["marketing-web"], mode: "copy-keyword", homepage: "https://godly.website", note: "검색 미지원 — 키워드로 눈탐색" },
  { id: "httpster", name: "Httpster", domains: ["marketing-web"], mode: "copy-keyword", homepage: "https://httpster.net" },
  { id: "mobbin", name: "Mobbin", domains: ["mobile-app", "dashboard-ops"], mode: "copy-keyword", homepage: "https://mobbin.com", note: "로그인 후 검색" },
  { id: "uplabs", name: "UpLabs", domains: ["mobile-app", "dashboard-ops"], mode: "auto-search", searchUrl: "https://www.uplabs.com/search?q={q}", homepage: "https://www.uplabs.com" },
  { id: "collectui", name: "Collect UI", domains: ["mobile-app", "dashboard-ops"], mode: "copy-keyword", homepage: "https://collectui.com" },
  { id: "screenlane", name: "Screenlane", domains: ["mobile-app"], mode: "copy-keyword", homepage: "https://screenlane.com" },
  { id: "pageflows", name: "Page Flows", domains: ["mobile-app"], mode: "copy-keyword", homepage: "https://pageflows.com", note: "플로우 영상 중심" },
  { id: "darkmode", name: "Dark Mode Design", domains: ["dashboard-ops"], mode: "copy-keyword", homepage: "https://www.darkmodedesign.com" },
  { id: "gdweb", name: "GDWEB (지디웹)", domains: ["marketing-web", "dashboard-ops"], mode: "copy-keyword", homepage: "https://www.gdweb.co.kr", note: "국내 웹 어워드" },
  { id: "dbcut", name: "디비컷", domains: ["marketing-web"], mode: "copy-keyword", homepage: "https://www.dbcut.com", note: "국내 웹디자인" },
  { id: "notefolio", name: "노트폴리오", domains: ["document", "marketing-web", "generic"], mode: "auto-search", searchUrl: "https://notefolio.net/search?query={q}", homepage: "https://notefolio.net" },
  { id: "slidesgo", name: "Slidesgo", domains: ["document"], mode: "auto-search", searchUrl: "https://slidesgo.com/search?q={q}", homepage: "https://slidesgo.com", note: "PPT·문서 템플릿" },
];

export function platformsForDomain(domain: DomainHint): PlatformDef[] {
  return PLATFORMS.filter(
    (p) => p.domains === "all" || p.domains.includes(domain),
  );
}

// 섹션 검색어 × 도메인 플랫폼 → ReferenceQuery[] (섹션당 플랫폼 칩 목록)
export function buildPlatformQueries(
  query: string,
  domain: DomainHint,
): ReferenceQuery[] {
  const q = query.trim();
  if (!q) return [];
  return platformsForDomain(domain).map((p) => ({
    platform: p.name,
    query: q,
    mode: p.mode,
    ...(p.mode === "auto-search" && p.searchUrl
      ? { url: p.searchUrl.replace("{q}", encodeURIComponent(q)) }
      : {}),
  }));
}

// 붙여넣은 레퍼런스 URL → 플랫폼명 (Step 10-b ReferenceItem 수집용).
// 등록 플랫폼 20종의 homepage 호스트와 매칭, 아니면 호스트명 그대로 반환.
export function platformNameFromUrl(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  for (const p of PLATFORMS) {
    const pHost = new URL(p.homepage).hostname.toLowerCase().replace(/^www\./, "");
    if (host === pHost || host.endsWith(`.${pHost}`)) return p.name;
  }
  return host;
}
