import { NextResponse } from "next/server";
import { generateJson } from "@/lib/ai/client";
import { buildDirectiveBlock } from "@/lib/ai/prompts";

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

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const sectionLines = (sections as any[])
    .map(
      (s) =>
        `- ${s.sectionId}: "${s.sectionTitle}" (${s.contentType} / ${s.recommendedLayout}) — ${s.contentSummary}`,
    )
    .join("\n");

  const prompt = `당신은 디자인 레퍼런스 큐레이터다. 아래 섹션 각각에 대해 Dribbble/Behance 등 디자인 플랫폼 검색에 쓸 키워드를 만들어라.
([회사A] 같은 대괄호 토큰은 마스킹된 실명이다.)
${buildDirectiveBlock(directives)}
도메인: ${domain}
섹션 목록:
${sectionLines}

규칙:
- searchQuery: 영어 2~4단어. 섹션의 "표현 방식"이 드러나게 (예: "timeline infographic", "pricing comparison table", "hero section eco").
- 회사명·브랜드명·고유명사·마스킹 토큰을 검색어에 절대 넣지 마라. 일반 명사만.
- layoutCandidates: 이 섹션 내용(contentType)에 어울리는 표현 방식 후보 2~3개 (recommendedLayout 포함 가능, kebab-case 영어).

반드시 JSON 배열만 출력:
[{ "sectionId": string, "searchQuery": string, "layoutCandidates": string[] }]`;

  try {
    const raw = await generateJson<any[]>(prompt);
    const queries = (Array.isArray(raw) ? raw : [])
      .filter((q) => typeof q?.sectionId === "string" && typeof q?.searchQuery === "string")
      .map((q) => ({
        sectionId: q.sectionId,
        // 방어: 마스킹 토큰이 섞여 나오면 제거
        searchQuery: q.searchQuery.replace(/\[[^\]]+\]/g, "").trim(),
        layoutCandidates: Array.isArray(q.layoutCandidates)
          ? q.layoutCandidates.filter((c: unknown) => typeof c === "string")
          : [],
      }));
    return NextResponse.json({ queries });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "검색어 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
