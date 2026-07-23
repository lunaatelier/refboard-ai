import { extractText, getDocumentProxy } from "unpdf";

// 서버 파싱 래퍼 — PDF 텍스트 추출 (phase1-masking-spec §7.2)
// 메모리에서만 처리. 디스크·DB 저장 금지, 내용 로깅 금지.
export function formatPdfPages(pages: string[]): string {
  return pages
    .map((page, index) => {
      const body = page.trim();
      return body ? `--- 슬라이드 ${index + 1} ---\n${body}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  // mergePages:true는 페이지 내부의 줄바꿈까지 공백으로 평탄화한다. 제목·카드·
  // 다단 레이아웃이 한 문장처럼 이어져 검수할 수 없으므로 페이지별 결과를
  // 유지하고, PPTX와 같은 슬라이드 경계 마커를 붙여 이후 분석 계보에도 쓴다.
  const { text } = await extractText(pdf);
  return formatPdfPages(text);
}
