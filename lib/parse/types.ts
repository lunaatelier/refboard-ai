import type { LabeledEntityCandidate } from "../masking/types";

// pptx 슬라이드에서 추출된 이미지 (Step 9) — ⚠️ 원문급 민감. 서버·Worker·메인
// 스레드 모두 메모리 처리만, 영속화 금지.
export interface PptxImage {
  assetId: string;
  sourceSlide?: number;
  mimeType: string;
  base64: string;
}

// pdf/pptx 파싱 결과 — 서버 라우트(/api/parse), Worker, 메인 스레드가 공유하는
// 단일 형태. pdf는 images/labeledEntities가 항상 빈 배열.
export interface DocumentParseResult {
  text: string;
  images: PptxImage[];
  labeledEntities: LabeledEntityCandidate[];
}

// 업로드 파일 자체(압축 상태) 크기 상한 — 서버 라우트와 클라이언트 진입점이 같은
// 값을 쓴다. 200MB로 임의 상향하지 않는다 — 근거: CLAUDE.md §4.2, 실사용 검증
// 이전에 200MB 변경을 커밋하지 않기로 한 결정.
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20MB

export type ParseDocumentExt = "pdf" | "pptx";

// 메인 스레드 ↔ Worker 메시지 프로토콜. id로 응답을 요청에 매칭한다(one-shot
// Worker라 실질적으로 하나뿐이지만, 매칭 로직을 두면 오배달을 코드로 방지한다).
export interface ParseWorkerRequest {
  id: string;
  ext: ParseDocumentExt;
  buffer: ArrayBuffer;
}

export type ParseWorkerResponse =
  | { id: string; ok: true; result: DocumentParseResult }
  | { id: string; ok: false; error: string };
