// 브랜드 분석 출처 검증 (P6, 개선 지시서 P6 items 2-7) — 모델이 JSON에 쓴
// sourceUrl 문자열을 그대로 신뢰하지 않는다(§3.5). 실제 Gemini grounding
// citation(§lib/ai/client.ts GroundedResult.sources) + 대상 목록 URL과의 도메인
// 관계 + 안전한 서버 fetch 성공 여부, 세 가지를 조합해 상태를 판정한다.

import { isBlockedLinkTarget } from "../parse/html";
import { fetchChecked, type FetchLike } from "../parse/link";
import type { VerifiedSource } from "./types";

export interface GroundingSourceCandidate {
  url: string;
  title?: string;
}

const MAX_VERIFIED_SOURCES = 4;
const FETCH_TIMEOUT_MS = 5000;

export function safeHost(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

// 서브도메인 관계까지 같은 브랜드로 본다 (예: www.example.com ↔ blog.example.com은
// 아니지만, example.com ↔ www.example.com/shop.example.com은 관련으로 판단).
export function hostsRelated(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

export function classifySourceStatus(input: {
  domainVerified: boolean;
  groundingCited: boolean;
  fetchOk: boolean;
}): VerifiedSource["status"] {
  if (input.domainVerified && input.groundingCited && input.fetchOk) return "official";
  if (input.groundingCited) return "supporting";
  return "unverified";
}

// 실제 fetch를 수행하는 impure 부분 — target-analyze route에서 호출한다.
// fetchImpl은 테스트에서 주입 가능(lib/parse/link.test.ts와 같은 패턴).
export async function buildVerifiedSources(
  targetUrl: string,
  groundingSources: GroundingSourceCandidate[],
  modelStatedUrl: string | undefined,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  now: () => string = () => new Date().toISOString(),
): Promise<VerifiedSource[]> {
  const targetHost = safeHost(targetUrl);

  const seen = new Set<string>();
  const candidates: { url: string; title?: string; groundingCited: boolean }[] = [];
  for (const s of groundingSources) {
    if (!s.url || seen.has(s.url)) continue;
    seen.add(s.url);
    candidates.push({ url: s.url, title: s.title, groundingCited: true });
  }
  // 모델이 직접 적은 sourceUrl은 실제 grounding에 없으면 groundingCited:false로
  // 남긴다 — 버리지 않고 "미확인" 후보로 검증 대상에는 포함한다(item 3).
  if (modelStatedUrl && !seen.has(modelStatedUrl)) {
    candidates.push({ url: modelStatedUrl, groundingCited: false });
  }

  // 대상 도메인과 관련 있는 후보를 우선해 fetch 상한 안에서 실제 공식 출처를
  // 놓치지 않게 한다.
  const sorted = [...candidates].sort((a, b) => {
    const aRel = hostsRelated(safeHost(a.url), targetHost) ? 0 : 1;
    const bRel = hostsRelated(safeHost(b.url), targetHost) ? 0 : 1;
    return aRel - bRel;
  });
  const capped = sorted.slice(0, MAX_VERIFIED_SOURCES);

  return Promise.all(
    capped.map(async (c) => {
      // Gemini의 google_search grounding citation은 실제 목적지가 아니라
      // vertexaisearch.cloud.google.com 리다이렉트 프록시 URL이다 — citation URL의
      // 호스트를 그대로 도메인 비교에 쓰면 항상 불일치한다. 반드시 fetchChecked가
      // 실제로 리다이렉트를 따라간 finalUrl의 호스트로 비교해야 한다.
      let fetchOk = false;
      let resolvedHost: string | undefined;
      try {
        const url = new URL(c.url);
        if (!isBlockedLinkTarget(url)) {
          const { response: res, finalUrl } = await fetchChecked(
            url,
            AbortSignal.timeout(FETCH_TIMEOUT_MS),
            fetchImpl,
          );
          fetchOk = res.ok;
          resolvedHost = safeHost(finalUrl.toString());
        }
      } catch {
        fetchOk = false;
      }
      const domainVerified = hostsRelated(resolvedHost ?? safeHost(c.url), targetHost);
      return {
        url: c.url,
        title: c.title,
        status: classifySourceStatus({ domainVerified, groundingCited: c.groundingCited, fetchOk }),
        groundingCited: c.groundingCited,
        domainVerified,
        fetchedAt: now(),
      } satisfies VerifiedSource;
    }),
  );
}
