import JSZip from "jszip";

// 서버 파싱 래퍼 — PPTX 텍스트 추출 (phase1-masking-spec §7.2)
// pptx = zip 안의 slide XML. <a:t> 텍스트 런만 추출한다. 이미지는 건드리지 않음(Step 9).
// 슬라이드 헤더를 남겨 이후 분석(Step 7 sourceSlides 계보)에 활용한다.

const SLIDE_PATH = /^ppt\/slides\/slide(\d+)\.xml$/;

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export async function extractPptxText(data: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(data);

  const slides = Object.keys(zip.files)
    .map((name) => {
      const m = name.match(SLIDE_PATH);
      return m ? { name, no: parseInt(m[1], 10) } : null;
    })
    .filter((s): s is { name: string; no: number } => s !== null)
    .sort((a, b) => a.no - b.no);

  const parts: string[] = [];
  for (const slide of slides) {
    const xml = await zip.files[slide.name].async("string");
    const runs = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) =>
      decodeXmlEntities(m[1]),
    );
    const body = runs.join("\n").trim();
    if (body) parts.push(`--- 슬라이드 ${slide.no} ---\n${body}`);
  }
  return parts.join("\n\n");
}
