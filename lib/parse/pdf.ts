import { extractText, getDocumentProxy } from "unpdf";

// 서버 파싱 래퍼 — PDF 텍스트 추출 (phase1-masking-spec §7.2)
// 메모리에서만 처리. 디스크·DB 저장 금지, 내용 로깅 금지.
export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
