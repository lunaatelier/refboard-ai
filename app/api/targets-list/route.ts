import { NextResponse } from "next/server";
import { generateGroundedJson } from "@/lib/ai/client";
import { buildDirectiveBlock } from "@/lib/ai/prompts";
import { checkBudget, recordFailure, recordSuccess } from "@/lib/reference/apiGuard";

// 분석 대상 브랜드 1단계 목록 (Step 10-c) — Gemini 검색 grounding으로 넓게 15~20개.
// rate limit 대응: 넓은 목록은 한 호출로 묶어 뽑는다 (flow-spec 부록).

export const runtime = "nodejs";

const FEATURE = "targets-list";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { title, description, domain, tags, projectType } = body ?? {};
  if (typeof title !== "string" || typeof domain !== "string") {
    return NextResponse.json(
      { error: "title/domain이 필요합니다." },
      { status: 400 },
    );
  }
  const directives = Array.isArray(body?.directives) ? body.directives : [];
  const excludeNames: string[] = Array.isArray(body?.excludeNames)
    ? body.excludeNames.filter((x: unknown): x is string => typeof x === "string")
    : [];

  const prompt = `당신은 디자인 벤치마킹 리서처다. 아래 프로젝트가 참고할 만한 "분석 대상 브랜드/서비스"를 실제 웹 검색으로 찾아라.
경쟁사·벤치마킹 브랜드·롤모델을 두루 포함하고, 실존하며 접속 가능한 서비스만.
${buildDirectiveBlock(directives, "reference")}
프로젝트: ${title}
설명: ${typeof description === "string" ? description : ""}
도메인: ${domain} / 종류: ${typeof projectType === "string" ? projectType : "-"}
태그: ${Array.isArray(tags) ? tags.join(", ") : "-"}
${excludeNames.length > 0 ? `이미 목록에 있는 것 (제외): ${excludeNames.join(", ")}` : ""}

12~18개를 찾아 반드시 JSON 배열만 출력:
[{ "name": string, "url": string(실서비스 공식 URL), "oneLineSummary": string(한 줄 특징, 한국어) }]`;

  const gate = checkBudget(req, FEATURE, "이 프로젝트에서 브랜드 목록 생성을 이미 최대 횟수만큼 사용했습니다.");
  if (!gate.ok) return gate.response!;

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const { data: raw } = await generateGroundedJson<any[]>(prompt);
    recordSuccess(FEATURE, gate);
    const items = (Array.isArray(raw) ? raw : [])
      .filter(
        (t) =>
          typeof t?.name === "string" &&
          typeof t?.url === "string" &&
          /^https?:\/\//.test(t.url),
      )
      .slice(0, 20)
      .map((t) => ({
        name: t.name,
        url: t.url,
        oneLineSummary:
          typeof t.oneLineSummary === "string" ? t.oneLineSummary : "",
      }));
    return NextResponse.json({ targets: items });
  } catch (e) {
    recordFailure(FEATURE, gate, e);
    const message =
      e instanceof Error ? e.message : "목록 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
