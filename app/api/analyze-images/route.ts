import { NextResponse } from "next/server";
import { generateJson, type InlineImage } from "@/lib/ai/client";

// 이미지 opt-in 분석 (Step 9) — 사용자가 명시적으로 동의한 이미지만 이 라우트에 온다.
// 응답 설명문은 클라이언트에서 재마스킹된 뒤에만 저장된다 (이중 방어).
// 서버는 이미지·응답을 저장·로깅하지 않는다.

export const runtime = "nodejs";

const MAX_IMAGES = 10;
const MAX_BASE64_CHARS = 2_800_000; // ≈ 2MB

interface ImageInput {
  assetId: string;
  mimeType: string;
  data: string;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const rawImages: unknown = body?.images;
  if (!Array.isArray(rawImages) || rawImages.length === 0) {
    return NextResponse.json({ error: "images가 필요합니다." }, { status: 400 });
  }
  if (rawImages.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: `이미지는 한 번에 ${MAX_IMAGES}장까지 분석할 수 있습니다.` },
      { status: 413 },
    );
  }

  const images: ImageInput[] = [];
  for (const img of rawImages) {
    if (
      typeof img?.assetId !== "string" ||
      typeof img?.mimeType !== "string" ||
      typeof img?.data !== "string" ||
      img.data.length > MAX_BASE64_CHARS
    ) {
      return NextResponse.json(
        { error: "이미지 형식이 올바르지 않거나 2MB를 초과합니다." },
        { status: 400 },
      );
    }
    images.push({ assetId: img.assetId, mimeType: img.mimeType, data: img.data });
  }

  const prompt = `당신은 시니어 프로덕트 디자이너다. 첨부된 ${images.length}개의 이미지를 순서대로 분석하라.
이미지 순서와 assetId 대응: ${images.map((i, n) => `${n + 1}번째 = ${i.assetId}`).join(", ")}

각 이미지에 대해:
- description: 이미지/화면의 유형, 레이아웃 구조, 컬러 톤, 스타일, 디자인 참고 포인트를 3~5문장으로.
- 이미지 속 텍스트에 회사명·인명·연락처 등 실명 정보가 보여도 description에 옮기지 마라 (일반 명사로 대체).

반드시 JSON 배열만 출력: [{ "assetId": string, "description": string }]`;

  try {
    const result = await generateJson<{ assetId: string; description: string }[]>(
      prompt,
      images.map((i): InlineImage => ({ mimeType: i.mimeType, data: i.data })),
    );
    const insights = (Array.isArray(result) ? result : [])
      .filter(
        (r) => typeof r?.assetId === "string" && typeof r?.description === "string",
      )
      .map((r) => ({ assetId: r.assetId, description: r.description }));
    return NextResponse.json({ insights });
  } catch (e) {
    const message = e instanceof Error ? e.message : "이미지 분석에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
