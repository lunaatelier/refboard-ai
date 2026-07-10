import { NextResponse } from "next/server";
import { generateJson } from "@/lib/ai/client";
import { buildDirectiveBlock } from "@/lib/ai/prompts";
import { platformsForDomain } from "@/lib/reference/platforms";
import type { DomainHint } from "@/lib/analysis/types";

// 섹션별 레퍼런스 검색어 생성 (Step 10-b)
// 입력은 confirmed 섹션 요약(마스킹됨)뿐. 검색어는 플랫폼 검색 URL에 들어가므로
// 실명·기밀이 절대 포함되면 안 된다 → 일반 명사 영어 키워드만 생성하도록 강제.

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const sections: unknown = body?.sections;
  const domain: unknown = body?.domain;
  if (!Array.isArray(sections) || sections.length === 0 || typeof domain !== "string") {
    return NextResponse.json(
      { error: "sections/domain이 필요합니다." },
      { status: 400 },
    );
  }
  const directives = Array.isArray(body?.directives) ? body.directives : [];
  const parentSiteNote =
    typeof body?.parentSiteNote === "string" ? body.parentSiteNote.trim() : "";

  // 부모-자식 사이트 관계 확정 시 (실사용#31) — 일반 공개 사이트 스타일이 아니라
  // "부모 사이트를 관리하는 CMS 백오피스" 쪽으로 검색어를 좁힌다.
  const parentSiteBlock = parentSiteNote
    ? `\n## 부모-자식 사이트 관계 (사용자 확정 — 반드시 반영)
이 문서는 부모 사이트를 관리하는 백오피스다: ${parentSiteNote}
모든 검색어를 공개 사이트/홈페이지 스타일이 아니라 CMS admin/backoffice/content management UI 쪽으로 좁혀라 (예: "cms admin dashboard", "backoffice table filter").\n`
    : "";

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const sectionLines = (sections as any[])
    .map(
      (s) =>
        `- ${s.sectionId}: "${s.sectionTitle}" (${s.contentType} / ${s.recommendedLayout}) — ${s.contentSummary}`,
    )
    .join("\n");

  // 플랫폼마다 검색 모델·유효 어휘가 다르므로, 이 도메인에 노출되는 플랫폼의
  // keywordProfile(언어·최대단어·어휘 지침)을 프롬프트에 그대로 삽입한다
  // (docs/samples/키워드생성스펙_개선판.md §2.2 — 변환은 생성 시점에, 후처리는 검증만).
  const domainPlatforms = platformsForDomain(domain as DomainHint);
  const platformProfileLines = domainPlatforms
    .map((p) => {
      const kp = p.keywordProfile;
      const good = kp.goodExamples.map((e) => `"${e}"`).join(", ");
      const bad = kp.badPatterns.join(", ");
      return `- ${p.id} (${kp.language}, 최대 ${kp.maxWords}단어): ${kp.vocabulary}. 예: ${good}. 피해야 할 것: ${bad}`;
    })
    .join("\n");

  const prompt = `당신은 디자인 레퍼런스 큐레이터다. 아래 섹션 각각에 대해 여러 디자인 플랫폼 검색에 쓸 키워드를 만들어라.
([회사A] 같은 대괄호 토큰은 마스킹된 실명이다.)
${buildDirectiveBlock(directives, "reference")}${parentSiteBlock}
도메인: ${domain}
섹션 목록:
${sectionLines}

플랫폼마다 검색 모델과 유효 어휘가 다르다. 같은 섹션이라도 플랫폼마다 다른 언어·다른 표현으로 써라
(예: Behance는 "tech brochure design", Dribbble은 "dashboard ui", GDWEB은 "기업 홈페이지"처럼 갈라져야 한다).
절대 모든 플랫폼에 같은 문구를 복사하지 마라.

플랫폼별 규칙 (반드시 각 항목의 언어·최대단어·어휘 지침을 지켜라):
${platformProfileLines}

각 섹션마다 아래를 채워라:
- searchQuery: 대표 검색어. 영어 2~4단어, 섹션의 "표현 방식"이 드러나게 (예: "timeline infographic", "hero section eco"). 이미지 검색·복사용 범용 표현.
- layoutCandidates: 이 섹션 내용(contentType)에 어울리는 표현 방식 후보 2~3개 (recommendedLayout 포함 가능, kebab-case 영어).
- queriesByPlatform: 위 플랫폼 목록의 각 id에 대해 그 플랫폼 규칙에 맞는 검색어 1개씩.

공통 규칙: 회사명·브랜드명·고유명사·마스킹 토큰을 검색어에 절대 넣지 마라. 일반 명사만.

반드시 JSON 배열만 출력:
[{ "sectionId": string, "searchQuery": string, "layoutCandidates": string[], "queriesByPlatform": { [platformId: string]: string } }]`;

  try {
    const raw = await generateJson<any[]>(prompt);
    const queries = (Array.isArray(raw) ? raw : [])
      .filter((q) => typeof q?.sectionId === "string" && typeof q?.searchQuery === "string")
      .map((q) => {
        const rawByPlatform =
          q.queriesByPlatform && typeof q.queriesByPlatform === "object"
            ? (q.queriesByPlatform as Record<string, unknown>)
            : {};
        const queriesByPlatform: Record<string, string> = {};
        for (const [platformId, value] of Object.entries(rawByPlatform)) {
          if (typeof value === "string") {
            // 방어: 마스킹 토큰이 섞여 나오면 제거 (최종 검증·폴백은 클라이언트의
            // buildProfiledPlatformQueries가 platforms.ts 프로필 기준으로 수행)
            queriesByPlatform[platformId] = value.replace(/\[[^\]]+\]/g, "").trim();
          }
        }
        return {
          sectionId: q.sectionId,
          // 방어: 마스킹 토큰이 섞여 나오면 제거
          searchQuery: q.searchQuery.replace(/\[[^\]]+\]/g, "").trim(),
          layoutCandidates: Array.isArray(q.layoutCandidates)
            ? q.layoutCandidates.filter((c: unknown) => typeof c === "string")
            : [],
          queriesByPlatform,
        };
      });
    return NextResponse.json({ queries });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "검색어 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
