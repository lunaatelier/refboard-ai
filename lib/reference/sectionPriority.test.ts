import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  recommendHighImpactSectionIds,
  seedSectionPriorities,
  sectionKey,
} from "./sectionPriority";
import type { Page, Section } from "../analysis/types";

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    sectionId: "s1",
    sectionTitle: "섹션",
    contentSummary: "요약",
    contentType: "generic",
    recommendedLayout: "text-block",
    status: "confirmed",
    ...overrides,
  };
}

function makePage(sections: Section[], overrides: Partial<Page> = {}): Page {
  return {
    pageId: "p1",
    pageTitle: "홈",
    pageRole: "content",
    selected: true,
    sections,
    ...overrides,
  };
}

describe("sectionKey", () => {
  it("pageId::sectionId 형태로 만든다", () => {
    assert.equal(sectionKey("p1", "s1"), "p1::s1");
  });
});

describe("recommendHighImpactSectionIds — 로컬 키워드 휴리스틱", () => {
  it("hero/feature/chart 등 키워드가 매칭되면 고영향으로 추천된다", () => {
    const page = makePage([
      makeSection({ sectionId: "s1", contentType: "hero" }),
      makeSection({ sectionId: "s2", contentType: "feature" }),
      makeSection({ sectionId: "s3", contentType: "chart-widget" }),
      makeSection({ sectionId: "s4", contentType: "generic" }),
    ]);
    const ids = recommendHighImpactSectionIds(page);
    assert.ok(ids.includes("s1"));
    assert.ok(ids.includes("s2"));
    assert.ok(ids.includes("s3"));
  });

  it("확정 섹션이 아니면 후보에서 제외된다", () => {
    const page = makePage([
      makeSection({ sectionId: "s1", contentType: "hero", status: "candidate" }),
      makeSection({ sectionId: "s2", contentType: "feature" }),
    ]);
    const ids = recommendHighImpactSectionIds(page);
    assert.ok(!ids.includes("s1"));
  });

  it("매칭이 3개 미만이면 문서 순서로 최소 3개까지 채운다(가능한 경우)", () => {
    const page = makePage([
      makeSection({ sectionId: "s1", contentType: "generic" }),
      makeSection({ sectionId: "s2", contentType: "generic" }),
      makeSection({ sectionId: "s3", contentType: "generic" }),
      makeSection({ sectionId: "s4", contentType: "generic" }),
    ]);
    const ids = recommendHighImpactSectionIds(page);
    assert.equal(ids.length, 3);
  });

  it("섹션이 3개 미만이면 있는 만큼만 추천한다(억지로 채우지 않는다)", () => {
    const page = makePage([
      makeSection({ sectionId: "s1", contentType: "generic" }),
    ]);
    const ids = recommendHighImpactSectionIds(page);
    assert.equal(ids.length, 1);
  });

  it("최대 5개를 넘지 않는다", () => {
    const page = makePage(
      Array.from({ length: 8 }, (_, i) => makeSection({ sectionId: `s${i}`, contentType: "hero" })),
    );
    const ids = recommendHighImpactSectionIds(page);
    assert.equal(ids.length, 5);
  });
});

describe("seedSectionPriorities — 명시적 결정을 절대 덮어쓰지 않는다", () => {
  it("빈 상태에서는 규칙 추천으로 채운다(source: rule)", () => {
    const page = makePage([
      makeSection({ sectionId: "s1", contentType: "hero" }),
      makeSection({ sectionId: "s2", contentType: "generic" }),
    ]);
    const next = seedSectionPriorities(page, {});
    assert.equal(next["p1::s1"].priority, "high-impact");
    assert.equal(next["p1::s1"].source, "rule");
  });

  it("이미 사용자가 정한 결정은 그대로 유지한다", () => {
    const page = makePage([makeSection({ sectionId: "s1", contentType: "hero" })]);
    const existing = { "p1::s1": { priority: "optional" as const, source: "user" as const } };
    const next = seedSectionPriorities(page, existing);
    assert.equal(next["p1::s1"].priority, "optional");
    assert.equal(next["p1::s1"].source, "user");
  });

  it("호출을 두 번 반복해도 결과가 같다(멱등)", () => {
    const page = makePage([
      makeSection({ sectionId: "s1", contentType: "hero" }),
      makeSection({ sectionId: "s2", contentType: "generic" }),
    ]);
    const once = seedSectionPriorities(page, {});
    const twice = seedSectionPriorities(page, once);
    assert.deepEqual(once, twice);
  });

  it("확정 안 된 섹션은 항목을 만들지 않는다", () => {
    const page = makePage([
      makeSection({ sectionId: "s1", status: "candidate" }),
    ]);
    const next = seedSectionPriorities(page, {});
    assert.equal(next["p1::s1"], undefined);
  });
});
