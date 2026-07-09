import type { LabeledEntityCandidate } from "../masking/types";
import type { PptxImage } from "./pptx";

export interface ServerParseResult {
  text: string;
  images: PptxImage[]; // ⚠️ 원문급 민감 — 메모리에만 보관, opt-in 동의 전 외부 전송 금지
  // 표 헤더 라벨(작성자/소속 등) 기반 자동 탐지 후보 (pptx만, pdf는 항상 빈 배열)
  labeledEntities: LabeledEntityCandidate[];
}

// 클라이언트 헬퍼 — pdf/pptx를 자사 서버(/api/parse)로 보내 텍스트(+이미지 목록)를 받는다.
// 원문은 자사 서버까지만 간다(메모리·무저장). 외부 제3자 API 아님 (CLAUDE.md §4.1).
export async function parseViaServer(file: File): Promise<ServerParseResult> {
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
