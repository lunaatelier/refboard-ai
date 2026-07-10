import type { DomainHint } from "../analysis/types";
import type { ReferenceQuery } from "./types";

// 등록 레퍼런스 플랫폼 20종 (CLAUDE.md §7) — isomorphic 순수 데이터/함수.
// 도메인 힌트별로 노출 플랫폼이 달라지고, 연동은 "자동 검색 이동" / "키워드 복사" 두 방식.
// ⚠️ 검색어는 마스킹된 섹션에서 생성된 일반 키워드만 — 실명·기밀이 URL로 나가지 않는다.
//
// keywordProfile: 플랫폼별 검색어 생성·검증 단일 원천 (docs/samples/키워드생성스펙_개선판.md v2).
// Gemini 프롬프트(어휘 지침)와 후처리 검증(언어/길이/금칙어)이 모두 이 프로필 하나를 참조한다.

export interface PlatformKeywordProfile {
  language: "ko" | "en"; // 쿼리 생성 언어
  maxWords: number; // 쿼리당 최대 단어 수
  queriesPerSection: number; // 섹션당 생성 쿼리 수 — v1은 1 고정 (v2에서 2로 확대 예정)
  vocabulary: string; // Gemini 프롬프트에 삽입되는 어휘 지침 1문장
  goodExamples: string[]; // 실제 쿼리 예시 (프롬프트 few-shot)
  badPatterns: string[]; // 피해야 할 패턴 서술 (프롬프트 금지 유형)
  strictVocabulary: boolean; // true면 공용 금칙어(FORBIDDEN_VOCAB) 검증 적용
  fallbackQueries: string[]; // 검증 fail 시 폴백 (최소 1개, [0] 사용)
}

export interface PlatformDef {
  id: string;
  name: string;
  domains: DomainHint[] | "all";
  mode: "auto-search" | "copy-keyword";
  searchUrl?: string; // {q} 치환. auto-search일 때만
  homepage: string;
  note?: string;
  keywordProfile: PlatformKeywordProfile;
}

export const PLATFORMS: PlatformDef[] = [
  {
    id: "dribbble", name: "Dribbble", domains: "all", mode: "auto-search",
    searchUrl: "https://dribbble.com/search/{q}", homepage: "https://dribbble.com",
    keywordProfile: {
      language: "en", maxWords: 4, queriesPerSection: 1,
      vocabulary: "UI 요소명+화면 유형 중심",
      goodExamples: ["dashboard ui", "hero section"],
      badPatterns: ["도메인 서술", "기술 개념"],
      strictVocabulary: true,
      fallbackQueries: ["dashboard ui", "landing page design"],
    },
  },
  {
    id: "behance", name: "Behance", domains: "all", mode: "auto-search",
    searchUrl: "https://www.behance.net/search/projects?search={q}", homepage: "https://www.behance.net",
    keywordProfile: {
      language: "en", maxWords: 4, queriesPerSection: 1,
      vocabulary: "산출물 유형+디자인 분야",
      goodExamples: ["tech brochure design", "brand identity system"],
      badPatterns: ["길고 복합적인 도메인 나열"],
      strictVocabulary: true,
      fallbackQueries: ["tech brochure design", "corporate brochure design"],
    },
  },
  {
    id: "pinterest", name: "Pinterest", domains: ["marketing-web", "document", "generic"], mode: "auto-search",
    searchUrl: "https://www.pinterest.com/search/pins/?q={q}", homepage: "https://www.pinterest.com",
    keywordProfile: {
      language: "ko", maxWords: 5, queriesPerSection: 1,
      vocabulary: "분위기 형용사+매체",
      goodExamples: ["테크 무드보드", "브로셔 디자인 영감"],
      badPatterns: ["상세 UX 플로우"],
      strictVocabulary: true,
      fallbackQueries: ["디자인 무드보드", "브랜딩 영감"],
    },
  },
  {
    id: "awwwards", name: "Awwwards", domains: ["marketing-web"], mode: "auto-search",
    searchUrl: "https://www.awwwards.com/inspiration_search/?text={q}", homepage: "https://www.awwwards.com",
    keywordProfile: {
      language: "en", maxWords: 4, queriesPerSection: 1,
      vocabulary: "사이트 성격",
      goodExamples: ["corporate website", "interactive website"],
      badPatterns: ["관리자 대시보드", "문서"],
      strictVocabulary: true,
      fallbackQueries: ["corporate website", "portfolio website"],
    },
  },
  {
    id: "siteinspire", name: "SiteInspire", domains: ["marketing-web"], mode: "auto-search",
    searchUrl: "https://www.siteinspire.com/websites?search={q}", homepage: "https://www.siteinspire.com",
    keywordProfile: {
      language: "en", maxWords: 3, queriesPerSection: 1,
      vocabulary: "사이트 성격+업종",
      goodExamples: ["corporate website", "minimal portfolio"],
      badPatterns: ["앱 플로우", "관리자 화면"],
      strictVocabulary: true,
      fallbackQueries: ["corporate website", "minimal website"],
    },
  },
  {
    id: "landbook", name: "Land-book", domains: ["marketing-web"], mode: "auto-search",
    searchUrl: "https://land-book.com/?search={q}", homepage: "https://land-book.com",
    keywordProfile: {
      language: "en", maxWords: 4, queriesPerSection: 1,
      vocabulary: "업종+landing/website",
      goodExamples: ["saas landing page", "ai website"],
      badPatterns: ["앱 플로우", "인쇄물"],
      strictVocabulary: true,
      fallbackQueries: ["saas landing page", "corporate website"],
    },
  },
  {
    id: "onepagelove", name: "One Page Love", domains: ["marketing-web"], mode: "auto-search",
    searchUrl: "https://onepagelove.com/?s={q}", homepage: "https://onepagelove.com",
    keywordProfile: {
      language: "en", maxWords: 3, queriesPerSection: 1,
      vocabulary: "원페이지 용도/업종",
      goodExamples: ["product launch", "event landing"],
      badPatterns: ["멀티페이지 IA", "대시보드"],
      strictVocabulary: true,
      fallbackQueries: ["landing page", "product page"],
    },
  },
  {
    id: "lapa", name: "Lapa Ninja", domains: ["marketing-web"], mode: "auto-search",
    searchUrl: "https://www.lapa.ninja/search/?q={q}", homepage: "https://www.lapa.ninja",
    keywordProfile: {
      language: "en", maxWords: 4, queriesPerSection: 1,
      vocabulary: "업종+landing",
      goodExamples: ["startup homepage", "ai landing page"],
      badPatterns: ["대시보드 상세", "인쇄물"],
      strictVocabulary: true,
      fallbackQueries: ["startup homepage", "landing page"],
    },
  },
  {
    id: "godly", name: "Godly", domains: ["marketing-web"], mode: "copy-keyword",
    homepage: "https://godly.website", note: "검색 미지원 — 키워드로 눈탐색",
    keywordProfile: {
      language: "en", maxWords: 3, queriesPerSection: 1,
      vocabulary: "스타일 무드+사이트 유형",
      goodExamples: ["dark portfolio", "3d hero"],
      badPatterns: ["도메인 서술", "기술 개념"],
      strictVocabulary: true,
      fallbackQueries: ["hero section", "dark website"],
    },
  },
  {
    id: "httpster", name: "Httpster", domains: ["marketing-web"], mode: "copy-keyword",
    homepage: "https://httpster.net",
    keywordProfile: {
      language: "en", maxWords: 3, queriesPerSection: 1,
      vocabulary: "스타일 무드+사이트 유형",
      goodExamples: ["brutalist site", "studio portfolio"],
      badPatterns: ["기술 개념", "문서 유형"],
      strictVocabulary: true,
      fallbackQueries: ["minimal website", "studio site"],
    },
  },
  {
    id: "mobbin", name: "Mobbin", domains: ["mobile-app", "dashboard-ops"], mode: "copy-keyword",
    homepage: "https://mobbin.com", note: "로그인 후 검색",
    keywordProfile: {
      language: "en", maxWords: 3, queriesPerSection: 1,
      vocabulary: "화면/플로우 이름",
      goodExamples: ["onboarding", "settings screen"],
      badPatterns: ["브로셔", "브랜드", "추상 무드"],
      strictVocabulary: true,
      fallbackQueries: ["onboarding", "dashboard"],
    },
  },
  {
    id: "uplabs", name: "UpLabs", domains: ["mobile-app", "dashboard-ops"], mode: "auto-search",
    searchUrl: "https://www.uplabs.com/search?q={q}", homepage: "https://www.uplabs.com",
    keywordProfile: {
      language: "en", maxWords: 3, queriesPerSection: 1,
      vocabulary: "UI 요소+플랫폼",
      goodExamples: ["dashboard template", "mobile ui kit"],
      badPatterns: ["브랜드 아이덴티티", "인쇄물"],
      strictVocabulary: true,
      fallbackQueries: ["dashboard ui", "mobile app ui"],
    },
  },
  {
    id: "collectui", name: "Collect UI", domains: ["mobile-app", "dashboard-ops"], mode: "copy-keyword",
    homepage: "https://collectui.com",
    keywordProfile: {
      language: "en", maxWords: 3, queriesPerSection: 1,
      vocabulary: "UI 패턴명 (카테고리 명칭)",
      goodExamples: ["sign up", "file upload"],
      badPatterns: ["무드", "브랜드", "업종 서술"],
      strictVocabulary: true,
      fallbackQueries: ["dashboard", "form"],
    },
  },
  {
    id: "screenlane", name: "Screenlane", domains: ["mobile-app"], mode: "copy-keyword",
    homepage: "https://screenlane.com",
    keywordProfile: {
      language: "en", maxWords: 3, queriesPerSection: 1,
      vocabulary: "모바일 화면명",
      goodExamples: ["onboarding", "profile screen"],
      badPatterns: ["웹 랜딩", "인쇄물"],
      strictVocabulary: true,
      fallbackQueries: ["onboarding", "home screen"],
    },
  },
  {
    id: "pageflows", name: "Page Flows", domains: ["mobile-app"], mode: "copy-keyword",
    homepage: "https://pageflows.com", note: "플로우 영상 중심",
    keywordProfile: {
      language: "en", maxWords: 3, queriesPerSection: 1,
      vocabulary: "플로우명",
      goodExamples: ["onboarding flow", "checkout flow"],
      badPatterns: ["단일 비주얼", "브랜드"],
      strictVocabulary: true,
      fallbackQueries: ["onboarding flow", "signup flow"],
    },
  },
  {
    id: "darkmode", name: "Dark Mode Design", domains: ["dashboard-ops"], mode: "copy-keyword",
    homepage: "https://www.darkmodedesign.com",
    keywordProfile: {
      language: "en", maxWords: 3, queriesPerSection: 1,
      vocabulary: "다크 UI+사이트 유형",
      goodExamples: ["dark dashboard", "dark landing"],
      badPatterns: ["라이트 톤 무드", "인쇄물"],
      strictVocabulary: true,
      fallbackQueries: ["dark ui", "dark dashboard"],
    },
  },
  {
    id: "gdweb", name: "GDWEB (지디웹)", domains: ["marketing-web", "dashboard-ops"], mode: "copy-keyword",
    homepage: "https://www.gdweb.co.kr", note: "국내 웹 어워드",
    keywordProfile: {
      language: "ko", maxWords: 4, queriesPerSection: 1,
      vocabulary: "업종+사이트 유형",
      goodExamples: ["기업 홈페이지", "이벤트 페이지"],
      badPatterns: ["영문 기술 용어", "앱 플로우"],
      strictVocabulary: true,
      fallbackQueries: ["기업 홈페이지", "이벤트 페이지"],
    },
  },
  {
    id: "dbcut", name: "디비컷", domains: ["marketing-web"], mode: "copy-keyword",
    homepage: "https://www.dbcut.com", note: "국내 웹디자인",
    keywordProfile: {
      language: "ko", maxWords: 4, queriesPerSection: 1,
      vocabulary: "사이트 유형+트렌드",
      goodExamples: ["홈페이지 리뉴얼", "기업 사이트"],
      badPatterns: ["모바일 앱 화면"],
      strictVocabulary: true,
      fallbackQueries: ["기업 사이트", "홈페이지 리뉴얼"],
    },
  },
  {
    id: "notefolio", name: "노트폴리오", domains: ["document", "marketing-web", "generic"], mode: "auto-search",
    searchUrl: "https://notefolio.net/search?query={q}", homepage: "https://notefolio.net",
    keywordProfile: {
      language: "ko", maxWords: 4, queriesPerSection: 1,
      vocabulary: "산출물 유형+업종 (한국어)",
      goodExamples: ["브로셔 디자인", "기업 소개서"],
      badPatterns: ["영문 기술 용어 나열"],
      strictVocabulary: true,
      fallbackQueries: ["브로셔 디자인", "포트폴리오 디자인"],
    },
  },
  {
    id: "slidesgo", name: "Slidesgo", domains: ["document"], mode: "auto-search",
    searchUrl: "https://slidesgo.com/search?q={q}", homepage: "https://slidesgo.com", note: "PPT·문서 템플릿",
    keywordProfile: {
      language: "en", maxWords: 3, queriesPerSection: 1,
      vocabulary: "문서 주제+template",
      goodExamples: ["business proposal", "company profile"],
      badPatterns: ["UI 컴포넌트", "앱 플로우"],
      strictVocabulary: true,
      fallbackQueries: ["business presentation", "corporate template"],
    },
  },
];

// 공용 금칙어 (strictVocabulary: true 프로필 대상) — 분석 tags에서 넘어온
// 도메인 전문용어가 크리에이티브/일반 플랫폼 쿼리에 그대로 섞이는 것을 막는다.
const FORBIDDEN_VOCAB = [
  "온톨로지", "지식 그래프", "지식그래프", "파이프라인", "api",
  "아키텍처", "인프라", "온프레미스", "크롤링", "임베딩",
];

export function platformsForDomain(domain: DomainHint): PlatformDef[] {
  return PLATFORMS.filter(
    (p) => p.domains === "all" || p.domains.includes(domain),
  );
}

// 플랫폼 프로필 검증 (docs/samples/키워드생성스펙_개선판.md §4) —
// ① 언어 일치 ② maxWords ③ 금칙어(strictVocabulary만). 하나라도 실패하면 false.
export function validateKeywordForPlatform(
  query: string,
  profile: PlatformKeywordProfile,
): boolean {
  const q = query.trim();
  if (!q) return false;
  const hasHangul = /[가-힣]/.test(q);
  if (profile.language === "ko" && !hasHangul) return false;
  if (profile.language === "en" && hasHangul) return false;
  const wordCount = q.split(/\s+/).filter(Boolean).length;
  if (wordCount > profile.maxWords) return false;
  if (profile.strictVocabulary) {
    const lower = q.toLowerCase();
    if (FORBIDDEN_VOCAB.some((term) => lower.includes(term.toLowerCase()))) {
      return false;
    }
  }
  return true;
}

// 마스킹 토큰 제거 + 검증. 실패하면 해당 플랫폼의 fallbackQueries[0]로 폴백 (플랫폼 단위 전체 폴백).
export function resolvePlatformQuery(
  rawQuery: string | undefined,
  profile: PlatformKeywordProfile,
): string {
  const cleaned = (rawQuery ?? "").replace(/\[[^\]]+\]/g, "").trim();
  if (cleaned && validateKeywordForPlatform(cleaned, profile)) return cleaned;
  return profile.fallbackQueries[0];
}

// 섹션 검색어(단일, 사용자 편집용) × 도메인 플랫폼 → ReferenceQuery[]
// 모든 플랫폼에 같은 검색어를 그대로 적용한다 — 검색어 입력창을 사용자가 직접
// 수정했을 때(명시적 의도) 쓰는 경로. 플랫폼별 자동 생성은 buildProfiledPlatformQueries.
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

// 플랫폼별로 다른 검색어(Gemini 생성) × 도메인 플랫폼 → ReferenceQuery[].
// queriesByPlatform은 플랫폼 id 기준. 항목이 없거나 검증 실패하면 fallbackQuery를
// 거쳐 최종적으로 프로필의 fallbackQueries[0]로 떨어진다 (§2.4 병합 우선순위).
export function buildProfiledPlatformQueries(
  queriesByPlatform: Record<string, string>,
  domain: DomainHint,
  fallbackQuery: string,
): ReferenceQuery[] {
  return platformsForDomain(domain).map((p) => {
    const raw = queriesByPlatform[p.id] ?? fallbackQuery;
    const q = resolvePlatformQuery(raw, p.keywordProfile);
    return {
      platform: p.name,
      query: q,
      mode: p.mode,
      ...(p.mode === "auto-search" && p.searchUrl
        ? { url: p.searchUrl.replace("{q}", encodeURIComponent(q)) }
        : {}),
    };
  });
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
