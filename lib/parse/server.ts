import type { DocumentParseResult } from "./types";

// 클라이언트 헬퍼 — pdf/pptx를 자사 서버(/api/parse)로 보내 텍스트(+이미지 목록)를 받는다.
// 원문은 자사 서버까지만 간다(메모리·무저장). 외부 제3자 API 아님 (CLAUDE.md §4.1).
// ⚠️ 현재 앱의 기본 경로가 아니다 — pdf/pptx는 lib/parse/parseDocumentLocally.ts
// (브라우저 Worker 파싱)로 이관됐다. 이 함수는 /api/parse 동등성 검증·백업 경로로만
// 남아있고, 브라우저 파싱 실패 시 자동 폴백으로 호출하지 않는다(그러면 원문이
// 다시 서버로 올라가고 Vercel 4.5MB 요청 상한에 걸린다).
export async function parseViaServer(file: File): Promise<DocumentParseResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/parse", { method: "POST", body: form });
  const body = await res.json().catch(() => null);
  if (!res.ok || typeof body?.text !== "string") {
    throw new Error(body?.error ?? "서버 파싱에 실패했습니다.");
  }
  return {
    text: body.text,
    images: Array.isArray(body.images) ? body.images : [],
    labeledEntities: Array.isArray(body.labeledEntities) ? body.labeledEntities : [],
  };
}
