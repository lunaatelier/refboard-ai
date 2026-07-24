import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { extractPptxImages, extractPptxText, parsePptxDocument } from "./pptx";
import { ZipBombError } from "./zipGuard";

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
      ["프로젝트 개요", "가상그린 홈페이지"],
      ["구성 페이지", "메인 / 소개 / 문의"],
    ]);
    const { text } = await extractPptxText(data);
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
    const { text } = await extractPptxText(data);
    assert.ok(text.includes("A&B <태그> 강"));
  });

  it("빈 슬라이드는 건너뛴다", async () => {
    const data = await buildPptx([["내용"], []]);
    const { text } = await extractPptxText(data);
    assert.ok(!text.includes("--- 슬라이드 2 ---"));
  });
});

describe("pptx — 표 헤더 라벨 기반 자동 탐지 (작성자/소속)", () => {
  // <a:tbl>/<a:tr>/<a:tc> 구조를 그대로 만든다 — 실제 문서 개정 이력표와 동일한 모양.
  function tableSlideXml(rows: string[][]): string {
    const cell = (t: string) => `<a:tc><a:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></a:txBody></a:tc>`;
    const row = (cells: string[]) => `<a:tr>${cells.map(cell).join("")}</a:tr>`;
    const tbl = `<a:tbl>${rows.map(row).join("")}</a:tbl>`;
    return `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:txBody>${tbl}</p:txBody></p:sld>`;
  }

  async function buildTablePptx(rows: string[][]): Promise<ArrayBuffer> {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", tableSlideXml(rows));
    zip.file("[Content_Types].xml", "<Types/>");
    return zip.generateAsync({ type: "arraybuffer" });
  }

  it("작성자/소속 열의 데이터 셀 값이 labeledEntities로 반환된다", async () => {
    const data = await buildTablePptx([
      ["버전", "날짜", "작성자", "소속", "서명"],
      ["V0.1", "2026.06.22", "가상담당자B", "디자인팀", "-"],
    ]);
    const { labeledEntities } = await extractPptxText(data);
    const person = labeledEntities.find((e) => e.kind === "personName");
    const company = labeledEntities.find((e) => e.kind === "company");
    assert.equal(person?.raw, "가상담당자B");
    assert.equal(company?.raw, "디자인팀");
  });

  it("labeledEntities의 start/end는 최종 text 안에서 실제 값의 위치와 일치한다", async () => {
    const data = await buildTablePptx([
      ["작성자", "소속"],
      ["가상담당자B", "디자인팀"],
    ]);
    const { text, labeledEntities } = await extractPptxText(data);
    for (const e of labeledEntities) {
      assert.equal(text.slice(e.start, e.end), e.raw);
    }
  });

  it("여러 run으로 쪼개진 셀(디자인 / 1팀)도 하나의 후보로 합쳐진다", async () => {
    // 실제 pptx에서 흔함: 같은 셀 안에서도 서식이 다르면 run이 나뉜다.
    const cell = (runs: string[]) =>
      `<a:tc><a:txBody><a:p>${runs.map((t) => `<a:r><a:t>${t}</a:t></a:r>`).join("")}</a:p></a:txBody></a:tc>`;
    const row = (cells: string) => `<a:tr>${cells}</a:tr>`;
    const tbl = `<a:tbl>${row(cell(["소속"]))}${row(cell(["디자인", "1팀"]))}</a:tbl>`;
    const xml = `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:txBody>${tbl}</p:txBody></p:sld>`;
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", xml);
    zip.file("[Content_Types].xml", "<Types/>");
    const data = await zip.generateAsync({ type: "arraybuffer" });

    const { labeledEntities } = await extractPptxText(data);
    assert.equal(labeledEntities.length, 1);
    assert.ok(labeledEntities[0].raw.includes("디자인"));
    assert.ok(labeledEntities[0].raw.includes("1팀"));
  });

  it("빈 값·자리표시자(-) 셀은 후보에서 제외된다", async () => {
    const data = await buildTablePptx([
      ["작성자", "소속"],
      ["-", ""],
    ]);
    const { labeledEntities } = await extractPptxText(data);
    assert.equal(labeledEntities.length, 0);
  });

  it("표 없는 슬라이드/무관한 헤더는 후보가 없다", async () => {
    const data = await buildPptx([["일반 텍스트", "표 아님"]]);
    const { labeledEntities } = await extractPptxText(data);
    assert.equal(labeledEntities.length, 0);
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

describe("pptx — parsePptxDocument (zip 단일 압축해제 통합 추출)", () => {
  const PNG_B64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

  async function buildCombinedPptx(): Promise<ArrayBuffer> {
    const cell = (t: string) => `<a:tc><a:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></a:txBody></a:tc>`;
    const row = (cells: string[]) => `<a:tr>${cells.map(cell).join("")}</a:tr>`;
    const tbl = `<a:tbl>${row(["작성자", "소속"])}${row(["가상담당자B", "디자인팀"])}</a:tbl>`;
    const slide1 = `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:txBody>${tbl}</p:txBody></p:sld>`;
    const slide2 = slideXml(["로그인 화면"]);

    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", slide1);
    zip.file("ppt/slides/slide2.xml", slide2);
    zip.file(
      "ppt/slides/_rels/slide2.xml.rels",
      `<?xml version="1.0"?><Relationships><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>`,
    );
    zip.file("ppt/media/image1.png", PNG_B64, { base64: true });
    zip.file("[Content_Types].xml", "<Types/>");
    return zip.generateAsync({ type: "arraybuffer" });
  }

  it("텍스트·labeledEntities·이미지를 한 번의 zip 로드로 함께 반환한다", async () => {
    const data = await buildCombinedPptx();
    const result = await parsePptxDocument(data);

    assert.ok(result.text.includes("로그인 화면"));
    const person = result.labeledEntities.find((e) => e.kind === "personName");
    assert.equal(person?.raw, "가상담당자B");
    assert.equal(result.text.slice(person!.start, person!.end), "가상담당자B");

    assert.equal(result.images.length, 1);
    assert.equal(result.images[0].sourceSlide, 2);
    assert.equal(result.images[0].mimeType, "image/png");
  });

  it("extractPptxText/extractPptxImages(하위호환 wrapper)와 동일한 값을 낸다", async () => {
    const data = await buildCombinedPptx();
    const combined = await parsePptxDocument(data);
    const { text, labeledEntities } = await extractPptxText(data);
    const images = await extractPptxImages(data);

    assert.deepEqual(combined.text, text);
    assert.deepEqual(combined.labeledEntities, labeledEntities);
    assert.deepEqual(combined.images, images);
  });

  it("zip 엔트리가 기본 상한(5000개)을 넘으면 거부한다", async () => {
    const zip = new JSZip();
    for (let i = 0; i < 5001; i++) zip.file(`ppt/slides/junk${i}.xml`, "");
    const data = await zip.generateAsync({ type: "arraybuffer" });
    await assert.rejects(() => parsePptxDocument(data), ZipBombError);
  });
});
