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

// 슬라이드에서 추출된 이미지 (Step 9) — ⚠️ 원문급 민감. 서버는 메모리 처리만,
// 클라이언트도 메모리(ref)에만 보관하고 영속화하지 않는다.
export interface PptxImage {
  assetId: string;
  sourceSlide?: number;
  mimeType: string;
  base64: string;
}

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

export async function extractPptxImages(
  data: ArrayBuffer,
): Promise<PptxImage[]> {
  const zip = await JSZip.loadAsync(data);

  // 슬라이드 rels → 어떤 슬라이드가 어떤 media를 참조하는지 (계보)
  const slideByMedia = new Map<string, number>();
  const relFiles = Object.keys(zip.files).filter((n) =>
    /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(n),
  );
  for (const relName of relFiles) {
    const slideNo = parseInt(relName.match(/slide(\d+)\.xml\.rels$/)![1], 10);
    const xml = await zip.files[relName].async("string");
    for (const m of xml.matchAll(/Target="\.\.\/(media\/[^"]+)"/g)) {
      const mediaPath = `ppt/${m[1]}`;
      if (!slideByMedia.has(mediaPath)) slideByMedia.set(mediaPath, slideNo);
    }
  }

  const mediaFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/media\//.test(n))
    .filter((n) => IMAGE_MIME[n.slice(n.lastIndexOf(".") + 1).toLowerCase()])
    .sort();

  const images: PptxImage[] = [];
  for (const name of mediaFiles) {
    if (images.length >= MAX_IMAGES) break;
    const bytes = await zip.files[name].async("uint8array");
    if (bytes.length > MAX_IMAGE_BYTES) continue;
    const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
    images.push({
      assetId: `img-${images.length + 1}`,
      sourceSlide: slideByMedia.get(name),
      mimeType: IMAGE_MIME[ext],
      base64: await zip.files[name].async("base64"),
    });
  }
  return images;
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
