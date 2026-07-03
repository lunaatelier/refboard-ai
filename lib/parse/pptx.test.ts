import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { extractPptxImages, extractPptxText } from "./pptx";

function slideXml(texts: string[]): string {
  const runs = texts.map((t) => `<a:r><a:t>${t}</a:t></a:r>`).join("");
  return `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:txBody>${runs}</p:txBody></p:sld>`;
}

async function buildPptx(slides: string[][]): Promise<ArrayBuffer> {
  const zip = new JSZip();
  slides.forEach((texts, i) => {
    zip.file(`ppt/slides/slide${i + 1}.xml`, slideXml(texts));
  });
  zip.file("[Content_Types].xml", "<Types/>");
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("pptx — 슬라이드 텍스트 추출", () => {
  it("슬라이드 순서대로 텍스트가 추출되고 슬라이드 헤더가 붙는다", async () => {
    const data = await buildPptx([
      ["프로젝트 개요", "그린테크 홈페이지"],
      ["구성 페이지", "메인 / 소개 / 문의"],
    ]);
    const text = await extractPptxText(data);
    assert.ok(text.includes("--- 슬라이드 1 ---"));
    assert.ok(text.includes("프로젝트 개요"));
    assert.ok(text.includes("--- 슬라이드 2 ---"));
    assert.ok(
      text.indexOf("프로젝트 개요") < text.indexOf("구성 페이지"),
      "슬라이드 순서 유지",
    );
  });

  it("XML 엔티티가 디코딩된다", async () => {
    const data = await buildPptx([["A&amp;B &lt;태그&gt; &#44053;"]]);
    const text = await extractPptxText(data);
    assert.ok(text.includes("A&B <태그> 강"));
  });

  it("빈 슬라이드는 건너뛴다", async () => {
    const data = await buildPptx([["내용"], []]);
    const text = await extractPptxText(data);
    assert.ok(!text.includes("--- 슬라이드 2 ---"));
  });
});

describe("pptx — 이미지 추출 (Step 9)", () => {
  // 1x1 투명 PNG
  const PNG_B64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

  async function buildPptxWithImage(): Promise<ArrayBuffer> {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", slideXml(["로그인 화면"]));
    zip.file("ppt/slides/slide2.xml", slideXml(["일반 내용"]));
    zip.file(
      "ppt/slides/_rels/slide2.xml.rels",
      `<?xml version="1.0"?><Relationships><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>`,
    );
    zip.file("ppt/media/image1.png", PNG_B64, { base64: true });
    zip.file("ppt/media/skip.emf", "not-an-image");
    zip.file("[Content_Types].xml", "<Types/>");
    return zip.generateAsync({ type: "arraybuffer" });
  }

  it("이미지가 추출되고 참조한 슬라이드 번호가 계보로 기록된다", async () => {
    const images = await extractPptxImages(await buildPptxWithImage());
    assert.equal(images.length, 1); // emf는 제외
    assert.equal(images[0].assetId, "img-1");
    assert.equal(images[0].sourceSlide, 2); // rels 계보
    assert.equal(images[0].mimeType, "image/png");
    assert.ok(images[0].base64.length > 0);
  });
});
