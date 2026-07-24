import type { UrlMaskingRule } from "./types";

// URL 마스킹 예외 규칙 (Step 6, 실사용#1/#6/#7)
// 기본: URL은 전부 가림 후보.
// 예외 1(유지 후보): 도메인이 "유지"로 태깅된 공개 브랜드와 일치 → 사례분석 출처 URL.
// 예외 2(가림 확정): 사내 협업툴 워크스페이스 URL → 항상 가림, 유지 후보로 표시하지 않음.

const INTERNAL_TOOL_PATTERNS: RegExp[] = [
  /(^|\.)atlassian\.net$/,
  /(^|\.)notion\.so$/,
  /(^|\.)notion\.site$/,
  /(^|\.)slack\.com$/,
  /(^|\.)monday\.com$/,
  /(^|\.)asana\.com$/,
  /(^|\.)clickup\.com$/,
  /(^|\.)swit\.io$/,
  /(^|\.)dooray\.com$/,
  /(^|\.)flow\.team$/,
];

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    // 프로토콜 없는 도메인(실사용 QA 2026-07-24, rules.ts의 프로토콜 없는 도메인
    // 규칙과 짝) — "virtualgreen.atlassian.net"처럼 https://가 없어 new URL()이
    // 바로 실패하는 경우, https://를 붙여 한 번 더 시도한다.
    try {
      return new URL(`https://${url}`).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
}

// publicBrandNames: 검수에서 "유지"로 태깅된 공개 엔티티 이름 목록.
// 영문 브랜드명은 도메인과 직접 대조한다 (예: "VirtualOutdoor" ↔ virtual-outdoor.example).
// 한글 브랜드명은 도메인 자동 대조가 불가하므로 사용자가 직접 유지 여부를 확정한다.
export function classifyUrl(
  url: string,
  publicBrandNames: string[] = [],
): UrlMaskingRule {
  const host = hostnameOf(url);

  if (host && INTERNAL_TOOL_PATTERNS.some((p) => p.test(host))) {
    return { url, reason: "internal-tool", suggestedAction: "mask" };
  }

  if (host) {
    const matched = publicBrandNames.some((name) => {
      const ascii = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      return ascii.length >= 3 && host.replace(/[^a-z0-9]/g, "").includes(ascii);
    });
    if (matched) {
      return { url, reason: "benchmark-source", suggestedAction: "keep" };
    }
  }

  return { url, reason: "public-citation", suggestedAction: "mask" };
}
