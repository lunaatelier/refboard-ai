import { NextResponse } from "next/server";
import { extractPdfText } from "@/lib/parse/pdf";
import { extractPptxImages, extractPptxText } from "@/lib/parse/pptx";

// 서버 파싱 (phase1-masking-spec §7.2) — pdf/pptx 텍스트 추출만 담당.
//
// 보안 (반드시 준수):
// - 추출 텍스트·파일 내용·파일명을 로그에 남기지 않는다.
// - 외부(Gemini/Unsplash/Pexels)로 전송하지 않는다. 이 라우트는 파싱만.
// - 파일은 메모리에서만 처리, 디스크·DB 저장 금지.
// - 응답은 추출 텍스트만.

export const runtime = "nodejs";

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "file 필드(multipart/form-data)가 필요합니다." },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "파일이 20MB를 초과합니다." },
      { status: 413 },
    );
  }

  const ext = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
  if (ext !== "pdf" && ext !== "pptx") {
    return NextResponse.json(
      { error: "pdf 또는 pptx만 지원합니다. (txt/md는 브라우저에서 처리)" },
      { status: 400 },
    );
  }

  try {
    const buffer = await file.arrayBuffer();
    if (ext === "pdf") {
      return NextResponse.json({ text: await extractPdfText(buffer), images: [] });
    }
    // pptx: 텍스트 + 이미지 목록. 이미지는 opt-in 동의 전까지 외부로 나가지 않으며
    // 이 응답은 자사 서버 → 클라이언트 반환일 뿐이다 (Step 9).
    // labeledEntities = 표 헤더 라벨(작성자/소속 등) 기반 자동 탐지 후보 —
    // 마스킹 원문급 민감이므로 텍스트와 마찬가지로 자사 서버까지만.
    const [{ text, labeledEntities }, images] = await Promise.all([
      extractPptxText(buffer),
      extractPptxImages(buffer),
    ]);
    return NextResponse.json({ text, labeledEntities, images });
  } catch {
    // 파일 내용·파일명이 에러 메시지로 새지 않도록 고정 문구만 반환
    return NextResponse.json(
      { error: "파싱에 실패했습니다. 파일이 손상되지 않았는지 확인하세요." },
      { status: 422 },
    );
  }
}
