import { NextResponse } from "next/server";
import { generateJson } from "@/lib/ai/client";
import { buildDirectiveBlock } from "@/lib/ai/prompts";

// 무드 후보 3종 생성 (Step 10-a) — 입력은 마스킹된 분석 요약뿐.

export const runtime = "nodejs";

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

  const prompt = `당신은 시니어 브랜드/프로덕트 디자이너다. 아래 프로젝트에 어울리는 서로 다른 무드 방향 3가지를 제안하라.
([회사A] 같은 대괄호 토큰은 마스킹된 실명이다. 그대로 두라.)
${buildDirectiveBlock(directives)}
프로젝트: ${title}
설명: ${typeof description === "string" ? description : ""}
도메인: ${domain} / 종류: ${typeof projectType === "string" ? projectType : "-"}
태그: ${Array.isArray(tags) ? tags.join(", ") : "-"}

각 무드는 뚜렷하게 달라야 한다 (예: 신뢰/혁신/미니멀 축). 반드시 JSON 배열만 출력:
[{
  "id": string(kebab-case),
  "label": string(한국어 짧은 이름),
  "keywords": string[4~6](한국어 형용사),
  "description": string(1~2문장),
  "imageQuery": string(영어 2~4단어, 무드보드 사진 검색용),
  "styleAttributes": {
    "radius": "sharp"|"soft",
    "density": "compact"|"airy",
    "contrast": "high"|"soft",
    "typographyNote": string(타이포 방향 한 줄)
  }
}] (정확히 3개)`;

  try {
    const raw = await generateJson<unknown[]>(prompt);
    const moods = (Array.isArray(raw) ? raw : [])
      .slice(0, 3)
      /* eslint-disable @typescript-eslint/no-explicit-any */
      .map((m: any, i: number) => ({
        id: typeof m?.id === "string" ? m.id : `mood-${i + 1}`,
        label: typeof m?.label === "string" ? m.label : `무드 ${i + 1}`,
        keywords: Array.isArray(m?.keywords)
          ? m.keywords.filter((k: unknown) => typeof k === "string")
          : [],
        description: typeof m?.description === "string" ? m.description : "",
        imageQuery:
          typeof m?.imageQuery === "string" ? m.imageQuery : "abstract design",
        styleAttributes: {
          radius: m?.styleAttributes?.radius === "sharp" ? "sharp" : "soft",
          density:
            m?.styleAttributes?.density === "compact" ? "compact" : "airy",
          contrast:
            m?.styleAttributes?.contrast === "high" ? "high" : "soft",
          typographyNote:
            typeof m?.styleAttributes?.typographyNote === "string"
              ? m.styleAttributes.typographyNote
              : "",
        },
      }));
    if (moods.length === 0) throw new Error("무드 생성 결과가 비어 있습니다.");
    return NextResponse.json({ moods });
  } catch (e) {
    const message = e instanceof Error ? e.message : "무드 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
