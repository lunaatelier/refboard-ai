import { NextResponse } from "next/server";
import { generateImage, isImageGenerationEnabled } from "@/lib/ai/client";
import { aspectRatioToSize } from "@/lib/reference/imageHints";

// 이미지 실제 생성 (Step 19) — NVIDIA NIM. 키가 없으면 비활성(GET으로 노출).
// 입력은 image-hints가 만든 "마스킹 토큰 없는 영어 프롬프트"만 — 방어적으로 한 번 더 제거.

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ enabled: isImageGenerationEnabled() });
}

export async function POST(req: Request) {
  if (!isImageGenerationEnabled()) {
    return NextResponse.json(
      { error: "이미지 생성이 설정되지 않았습니다. (NVIDIA_API_KEY 필요)" },
      { status: 503 },
    );
  }
  const body = await req.json().catch(() => null);
  const rawPrompt = typeof body?.prompt === "string" ? body.prompt : "";
  // 마스킹 토큰 방어적 제거 — 실명 토큰이 섞여 들어와도 외부로 안 나가게
  const prompt = rawPrompt.replace(/\[[^\]]+\]/g, "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt가 필요합니다." }, { status: 400 });
  }
  const size = aspectRatioToSize(
    typeof body?.aspectRatio === "string" ? body.aspectRatio : undefined,
  );

  try {
    const image = await generateImage(prompt, size);
    return NextResponse.json({
      dataUrl: `data:${image.mimeType};base64,${image.base64}`,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "이미지 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
