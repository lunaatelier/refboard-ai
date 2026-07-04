import { NextResponse } from "next/server";
import { generateJson } from "@/lib/ai/client";
import { buildDirectiveBlock } from "@/lib/ai/prompts";

// 이미지 힌트 프롬프트 생성 (Step 11) — 스케일·방향은 클라이언트(순수 함수)가 판정,
// 여기서는 각 힌트의 영어 생성 프롬프트 문구만 채운다. 실제 이미지 생성은 후순위.

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const skeletons: unknown = body?.skeletons;
  if (!Array.isArray(skeletons) || skeletons.length === 0) {
    return NextResponse.json(
      { error: "skeletons가 필요합니다." },
      { status: 400 },
    );
  }
  const directives = Array.isArray(body?.directives) ? body.directives : [];
  const moodKeywords: string[] = Array.isArray(body?.moodKeywords)
    ? body.moodKeywords
    : [];
  const primaryColor =
    typeof body?.primaryColor === "string" ? body.primaryColor : undefined;
  const textOnly = body?.sourceReferenceMode === "text-only-ignore-source";

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const lines = (skeletons as any[])
    .map(
      (s, i) =>
        `${i + 1}. area="${s.area}" scale=${s.scale} direction="${s.direction}" ratio=${s.aspectRatio} 내용: ${s.contextSummary}`,
    )
    .join("\n");

  const prompt = `당신은 이미지 생성 프롬프트 엔지니어다. 아래 각 항목에 대해 이미지 생성 AI에 넣을 영어 프롬프트를 만들어라.
([회사A] 같은 대괄호 토큰은 마스킹된 실명이다 — 프롬프트에 절대 옮기지 말고, 사업의 성격을 나타내는 일반 키워드만 사용하라.)
${buildDirectiveBlock(directives, "mood")}
무드 키워드: ${moodKeywords.join(", ") || "-"}
메인 컬러: ${primaryColor ?? "-"}
${textOnly ? "주의: 원본 문서의 기존 이미지는 참고 대상이 아니다. 위 텍스트 의미만으로 새로 구상하라." : ""}

항목:
${lines}

규칙:
- 각 프롬프트는 영어 1~2문장. direction(일러스트/3D/사진)과 scale에 맞는 스타일 서술 포함.
- hero는 넓은 구도의 키비주얼, section은 본문 삽화, icon은 단순한 아이콘 세트 서술.
- 무드 키워드의 감성과 메인 컬러 톤을 반영.
- 고유명사·브랜드명·마스킹 토큰 금지.

반드시 JSON 배열만 출력 (입력 순서 유지):
[{ "index": number, "prompt": string }]`;

  try {
    const raw = await generateJson<any[]>(prompt);
    const prompts = new Map<number, string>();
    for (const r of Array.isArray(raw) ? raw : []) {
      if (typeof r?.index === "number" && typeof r?.prompt === "string") {
        prompts.set(r.index, r.prompt.replace(/\[[^\]]+\]/g, "").trim());
      }
    }
    return NextResponse.json({
      prompts: (skeletons as any[]).map(
        (_, i) => prompts.get(i + 1) ?? "",
      ),
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "프롬프트 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
