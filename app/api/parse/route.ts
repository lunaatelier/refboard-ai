import { NextResponse } from "next/server";
import { parsePdfDocument } from "@/lib/parse/pdf";
import { parsePptxDocument } from "@/lib/parse/pptx";
import { MAX_DOCUMENT_BYTES } from "@/lib/parse/types";
import { ZipBombError } from "@/lib/parse/zipGuard";

// 서버 파싱 (phase1-masking-spec §7.2) — pdf/pptx 텍스트 추출만 담당.
// ⚠️ 브라우저 파싱(lib/parse/parseDocumentLocally.ts)이 기본 경로다. 이 라우트는
// 동등성 검증·백업용으로 유지되며, 브라우저 파싱 실패 시 자동 폴백으로 쓰지 않는다.
//
// 보안 (반드시 준수):
// - 추출 텍스트·파일 내용·파일명을 로그에 남기지 않는다.
// - 외부(Gemini/Unsplash/Pexels)로 전송하지 않는다. 이 라우트는 파싱만.
// - 파일은 메모리에서만 처리, 디스크·DB 저장 금지.
// - 응답은 추출 텍스트만.

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "file 필드(multipart/form-data)가 필요합니다." },
      { status: 400 },
    );
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
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
    // pdf/pptx 모두 zip을 한 번만 열어 텍스트+labeledEntities+이미지를 함께
    // 추출한다(parsePptxDocument 내부). 이미지는 opt-in 동의 전까지 외부로
    // 나가지 않으며 이 응답은 자사 서버 → 클라이언트 반환일 뿐이다 (Step 9).
    const result = ext === "pdf" ? await parsePdfDocument(buffer) : await parsePptxDocument(buffer);
    return NextResponse.json(result);
  } catch (e) {
    // 파일 내용·파일명이 에러 메시지로 새지 않도록 고정 문구만 반환한다
    // (내부 상한값·판정 로직은 노출하지 않는다). zip bomb만 413으로 구분해
    // 손상 파일(422)과 다른 원인임을 클라이언트가 분기할 수 있게 한다.
    if (e instanceof ZipBombError) {
      return NextResponse.json(
        { error: "파일 구조가 처리할 수 없는 크기입니다." },
        { status: 413 },
      );
    }
    return NextResponse.json(
      { error: "파싱에 실패했습니다. 파일이 손상되지 않았는지 확인하세요." },
      { status: 422 },
    );
  }
}
