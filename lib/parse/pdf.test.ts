import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSamplePdf } from "./fixtures/samplePdf";
import { extractPdfText, formatPdfPages, parsePdfDocument } from "./pdf";

describe("PDF 페이지 텍스트 포맷", () => {
  it("페이지 내부 줄바꿈과 페이지 경계를 보존한다", () => {
    const text = formatPdfPages([
      "표지\n제품 소개",
      "핵심 기능\n영상 자동 인덱싱\n시맨틱 검색",
    ]);

    assert.equal(
      text,
      [
        "--- 슬라이드 1 ---",
        "표지",
        "제품 소개",
        "",
        "--- 슬라이드 2 ---",
        "핵심 기능",
        "영상 자동 인덱싱",
        "시맨틱 검색",
      ].join("\n"),
    );
  });

  it("빈 페이지는 제외하되 실제 페이지 번호는 유지한다", () => {
    const text = formatPdfPages(["첫 페이지", "  ", "세 번째 페이지"]);

    assert.match(text, /--- 슬라이드 1 ---/);
    assert.doesNotMatch(text, /--- 슬라이드 2 ---/);
    assert.match(text, /--- 슬라이드 3 ---/);
  });
});

describe("PDF — 실제 파일 파싱 (unpdf 경로)", () => {
  it("유효한 pdf에서 실제 텍스트를 추출한다", async () => {
    const data = buildSamplePdf("Hello PDF");
    const text = await extractPdfText(data);
    assert.match(text, /--- 슬라이드 1 ---/);
    assert.match(text, /Hello PDF/);
  });

  it("parsePdfDocument는 images/labeledEntities를 항상 빈 배열로 반환한다", async () => {
    // Helvetica(base-14 Latin 폰트)는 WinAnsi 범위만 표현 가능 — 한글은 별도
    // 임베드 폰트가 필요하므로 이 합성 fixture에서는 ASCII만 사용한다.
    const data = buildSamplePdf("Worker parsing check");
    const result = await parsePdfDocument(data);
    assert.match(result.text, /Worker parsing check/);
    assert.deepEqual(result.images, []);
    assert.deepEqual(result.labeledEntities, []);
  });
});
