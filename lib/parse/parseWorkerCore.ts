import type { DocumentParseResult, ParseDocumentExt } from "./types";

// Worker 진입점의 순수 로직 — self/postMessage를 참조하지 않으므로 Node
// 테스트에서도(실제 DOM Worker 없이) 그대로 호출해 검증할 수 있다. 실제 Worker
// 스레드 바인딩(self.onmessage)은 parse.worker.ts에서만 한다.
// pdf/pptx 파서를 동적 import로 불러 필요한 쪽 코드만 로드한다.
export async function parseInWorker(
  ext: ParseDocumentExt,
  buffer: ArrayBuffer,
): Promise<DocumentParseResult> {
  if (ext === "pdf") {
    const { parsePdfDocument } = await import("./pdf");
    return parsePdfDocument(buffer);
  }
  const { parsePptxDocument } = await import("./pptx");
  return parsePptxDocument(buffer);
}
