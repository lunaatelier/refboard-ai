import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addCustomPattern, seedBrandDecision, togglePattern } from "./brandDecision";
import type { AnalysisTargetAnalysis } from "./types";

function makeDeep(overrides: Partial<AnalysisTargetAnalysis> = {}): AnalysisTargetAnalysis {
  return {
    id: "t1",
    name: "예시 서비스",
    depth: "deep",
    layoutStrategy: "-",
    colorVisualStrategy: "-",
    componentPattern: "-",
    painPoints: ["복잡한 온보딩"],
    wowPoints: ["명확한 정보 위계"],
    estimatedIntent: "-",
    implications: "-",
    sourceUrl: "https://example.com",
    confidence: "추천",
    analyzedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("seedBrandDecision — wowPoints/painPoints로 한 번만 시드", () => {
  it("빈 상태에서는 심층 분석 결과로 시드한다", () => {
    const next = seedBrandDecision("t1", makeDeep(), {});
    assert.deepEqual(next["t1"], {
      adoptedPatterns: ["명확한 정보 위계"],
      avoidedPatterns: ["복잡한 온보딩"],
    });
  });

  it("이미 존재하면(사용자 편집 포함) 절대 덮어쓰지 않는다", () => {
    const existing = { t1: { adoptedPatterns: [], avoidedPatterns: ["직접 추가한 것"] } };
    const next = seedBrandDecision("t1", makeDeep(), existing);
    assert.deepEqual(next["t1"], existing["t1"]);
  });

  it("호출을 두 번 반복해도 결과가 같다(멱등)", () => {
    const once = seedBrandDecision("t1", makeDeep(), {});
    const twice = seedBrandDecision("t1", makeDeep(), once);
    assert.deepEqual(once, twice);
  });
});

describe("togglePattern", () => {
  it("없으면 추가, 있으면 제거한다", () => {
    const base = { adoptedPatterns: ["A"], avoidedPatterns: [] };
    const added = togglePattern(base, "adoptedPatterns", "B");
    assert.deepEqual(added.adoptedPatterns, ["A", "B"]);
    const removed = togglePattern(added, "adoptedPatterns", "A");
    assert.deepEqual(removed.adoptedPatterns, ["B"]);
  });
});

describe("addCustomPattern", () => {
  it("새 문구를 추가한다", () => {
    const base = { adoptedPatterns: [], avoidedPatterns: [] };
    const next = addCustomPattern(base, "avoidedPatterns", "과도한 애니메이션");
    assert.deepEqual(next.avoidedPatterns, ["과도한 애니메이션"]);
  });

  it("빈 문자열은 무시한다", () => {
    const base = { adoptedPatterns: [], avoidedPatterns: [] };
    const next = addCustomPattern(base, "avoidedPatterns", "   ");
    assert.equal(next, base);
  });

  it("중복 문구는 추가하지 않는다", () => {
    const base = { adoptedPatterns: ["A"], avoidedPatterns: [] };
    const next = addCustomPattern(base, "adoptedPatterns", "A");
    assert.equal(next, base);
  });
});
