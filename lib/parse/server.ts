// 클라이언트 헬퍼 — pdf/pptx를 자사 서버(/api/parse)로 보내 텍스트만 받는다.
// 원문은 자사 서버까지만 간다(메모리·무저장). 외부 제3자 API 아님 (CLAUDE.md §4.1).
export async function parseViaServer(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/parse", { method: "POST", body: form });
  const body = await res.json().catch(() => null);
  if (!res.ok || typeof body?.text !== "string") {
    throw new Error(body?.error ?? "서버 파싱에 실패했습니다.");
  }
  return body.text;
}
