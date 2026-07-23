import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPdfPages } from "./pdf";

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
