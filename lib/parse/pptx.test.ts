import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { extractPptxText } from "./pptx";

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
