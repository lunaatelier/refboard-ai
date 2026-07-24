import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { parseInWorker } from "./parseWorkerCore";
import { parsePdfDocument } from "./pdf";
import { parsePptxDocument } from "./pptx";

// Worker 코어(parseInWorker)가 서버 라우트와 정확히 같은 핵심 함수를 호출하는지
// 검증한다 — 슬라이드 순서/경계, labeledEntities offset, 이미지 개수·MIME·
// 원본 슬라이드 연결까지 전부 동일해야 한다(P0 item 7 동등성 테스트 요구사항).

function slideXml(texts: string[]): string {
  const runs = texts.map((t) => `<a:r><a:t>${t}</a:t></a:r>`).join("");
  return `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:txBody>${runs}</p:txBody></p:sld>`;
}

const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function buildRichPptx(): Promise<ArrayBuffer> {
  const cell = (t: string) => `<a:tc><a:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></a:txBody></a:tc>`;
  const row = (cells: string[]) => `<a:tr>${cells.map(cell).join("")}</a:tr>`;
  const tbl = `<a:tbl>${row(["작성자", "소속"])}${row(["가상담당자B", "디자인팀"])}</a:tbl>`;
  const tableSlide = `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:txBody>${tbl}</p:txBody></p:sld>`;

  const zip = new JSZip();
  zip.file("ppt/slides/slide1.xml", slideXml(["표지", "가상 프로젝트"]));
  zip.file("ppt/slides/slide2.xml", tableSlide);
  zip.file("ppt/slides/slide3.xml", slideXml(["로그인 화면"]));
  zip.file(
    "ppt/slides/_rels/slide3.xml.rels",
    `<?xml version="1.0"?><Relationships><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>`,
  );
  zip.file("ppt/media/image1.png", PNG_B64, { base64: true });
  zip.file("[Content_Types].xml", "<Types/>");
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("parseWorkerCore — parseInWorker와 서버 경로(parsePptxDocument)의 동등성", () => {
  it("텍스트·슬라이드 경계·labeledEntities offset·이미지가 완전히 동일하다", async () => {
    const data = await buildRichPptx();
    const viaWorker = await parseInWorker("pptx", data);
    const viaServer = await parsePptxDocument(data);

    assert.deepEqual(viaWorker, viaServer);
    // 슬라이드 순서 보존 확인 (표지 → 표 → 이미지 슬라이드)
    assert.ok(viaWorker.text.indexOf("표지") < viaWorker.text.indexOf("가상담당자B"));
    assert.ok(viaWorker.text.indexOf("가상담당자B") < viaWorker.text.indexOf("로그인 화면"));
    assert.equal(viaWorker.images[0].sourceSlide, 3);
  });

  it("빈 슬라이드가 섞여도 동일한 결과를 낸다", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", slideXml(["내용"]));
    zip.file("ppt/slides/slide2.xml", slideXml([]));
    zip.file("[Content_Types].xml", "<Types/>");
    const data = await zip.generateAsync({ type: "arraybuffer" });

    const viaWorker = await parseInWorker("pptx", data);
    const viaServer = await parsePptxDocument(data);
    assert.deepEqual(viaWorker, viaServer);
    assert.ok(!viaWorker.text.includes("--- 슬라이드 2 ---"));
  });
});

describe("parseWorkerCore — pdf 분기가 parsePdfDocument와 동일하게 동작한다", () => {
  it("손상된 pdf는 워커 경로와 서버 경로가 동일하게 실패한다", async () => {
    // 유효한 PDF 바이너리를 테스트에서 합성하는 건 비현실적이라(unpdf/pdfjs가
    // 실제 PDF 구조를 요구), 분기 배선 자체(=올바른 파서로 위임하는지)를
    // "둘 다 같은 방식으로 거부한다"로 검증한다.
    const invalidPdf = new TextEncoder().encode("not a real pdf").buffer;
    await assert.rejects(() => parseInWorker("pdf", invalidPdf));
    await assert.rejects(() => parsePdfDocument(invalidPdf));
  });
});
