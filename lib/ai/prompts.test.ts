import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProjectDirective } from "../analysis/types";
import { buildDirectiveBlock } from "./prompts";

describe("Step 15 — 지시 scope 필터링", () => {
  const directives: ProjectDirective[] = [
    { text: "ESG 강조" }, // scope 없음 = 전체 적용
    { text: "레퍼런스는 국내 사례만", scope: ["reference"] },
    { text: "컨셉은 미니멀로", scope: ["concept"], priority: "high" },
    { text: "무드+컨셉 공통 톤", scope: ["mood", "concept"] },
  ];

  it("scope 미지정 지시는 모든 단계에 주입된다", () => {
    for (const scope of ["analysis", "reference", "mood", "concept"] as const) {
      assert.ok(buildDirectiveBlock(directives, scope).includes("ESG 강조"));
    }
  });

  it("scope 지정 지시는 해당 단계에만 주입된다", () => {
    const analysisBlock = buildDirectiveBlock(directives, "analysis");
    assert.ok(!analysisBlock.includes("레퍼런스는 국내 사례만"));
    assert.ok(!analysisBlock.includes("컨셉은 미니멀로"));

    const referenceBlock = buildDirectiveBlock(directives, "reference");
    assert.ok(referenceBlock.includes("레퍼런스는 국내 사례만"));
    assert.ok(!referenceBlock.includes("컨셉은 미니멀로"));

    const conceptBlock = buildDirectiveBlock(directives, "concept");
    assert.ok(conceptBlock.includes("컨셉은 미니멀로 (중요)"));
    assert.ok(conceptBlock.includes("무드+컨셉 공통 톤"));

    const moodBlock = buildDirectiveBlock(directives, "mood");
    assert.ok(moodBlock.includes("무드+컨셉 공통 톤"));
  });

  it("해당 단계 지시가 하나도 없으면 빈 문자열 (블록 자체 미주입)", () => {
    assert.equal(
      buildDirectiveBlock(
        [{ text: "컨셉만", scope: ["concept"] }],
        "analysis",
      ),
      "",
    );
    assert.equal(buildDirectiveBlock([], "analysis"), "");
  });

  it("scope 인자 없이 호출하면 기존 동작 (전부 주입)", () => {
    const block = buildDirectiveBlock(directives);
    assert.ok(block.includes("ESG 강조"));
    assert.ok(block.includes("레퍼런스는 국내 사례만"));
  });

  it("빈 scope 배열은 전체 적용으로 취급", () => {
    const block = buildDirectiveBlock(
      [{ text: "빈 scope", scope: [] }],
      "concept",
    );
    assert.ok(block.includes("빈 scope"));
  });
});
