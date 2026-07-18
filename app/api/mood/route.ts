import { NextResponse } from "next/server";
import { generateJson } from "@/lib/ai/client";
import { buildMoodPrompt, parseMoodResponse } from "@/lib/reference/mood";
import type { PaletteOption } from "@/lib/reference/types";

// 무드 후보 3종 생성 (Step 10-a, P3) — 입력은 마스킹된 분석 요약 + 확정된
// 팔레트 후보 목록뿐. 각 무드는 팔레트 후보 하나와 1:1로 짝지어진다.

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
  const paletteOptions: PaletteOption[] = Array.isArray(body?.paletteOptions)
    ? body.paletteOptions
    : [];
  if (paletteOptions.length === 0) {
    return NextResponse.json(
      { error: "paletteOptions가 필요합니다 — 팔레트를 먼저 확정하세요." },
      { status: 400 },
    );
  }

  const prompt = buildMoodPrompt({
    title,
    description: typeof description === "string" ? description : "",
    domain,
    tags: Array.isArray(tags) ? tags : [],
    projectType: typeof projectType === "string" ? projectType : undefined,
    directives,
    paletteOptions,
  });

  try {
    const raw = await generateJson<unknown[]>(prompt);
    const moods = parseMoodResponse(raw, paletteOptions);
    if (moods.length === 0) throw new Error("무드 생성 결과가 비어 있습니다.");
    return NextResponse.json({ moods });
  } catch (e) {
    const message = e instanceof Error ? e.message : "무드 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
