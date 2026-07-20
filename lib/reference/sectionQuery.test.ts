import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSectionQuerySet, stripUiTerms } from "./sectionQuery";
import type { ProjectAnalysis, Section } from "../analysis/types";
import type { DirectionOption } from "./types";

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    sectionId: "s1",
    sectionTitle: "히어로 섹션",
    contentSummary: "요약",
    contentType: "hero",
    recommendedLayout: "hero-section",
    status: "confirmed",
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<ProjectAnalysis> = {}): ProjectAnalysis {
  return {
    title: "문서",
    description: "설명",
    domain: "dashboard-ops",
    domainConfidence: 0.9,
    targetUser: "운영자",
    tags: [],
    projectType: "제안서",
    pages: [],
    ...overrides,
  };
}

function makeDirection(overrides: Partial<DirectionOption> = {}): DirectionOption {
  return {
    directionId: "d1",
    label: "신뢰의 블루",
    description: "설명",
    paletteOptionId: "p1",
    moodOptionId: "m1",
    keywords: ["신뢰감 있는", "차분한"],
    typography: {
      title: { sampleText: "제목", note: "굵은 산세리프" },
      body: { sampleText: "본문", note: "가독성 중심" },
    },
    styleAttributes: { radius: "soft", density: "airy", contrast: "soft" },
    imageCandidates: [],
    recommendedDirections: [],
    avoidDirections: [],
    ...overrides,
  };
}

describe("stripUiTerms — 사진 검색어에서 UI 용어 제거", () => {
  it("hero/section/dashboard 등 금지어를 제거한다", () => {
    assert.equal(stripUiTerms("cinematic hero section"), "cinematic");
    assert.equal(stripUiTerms("dark dashboard layout"), "dark");
  });

  it("금지어가 없으면 그대로 둔다", () => {
    assert.equal(stripUiTerms("modern office team"), "modern office team");
  });
});

describe("buildSectionQuerySet — 로컬 3축 검색어", () => {
  it("direction 없이도 패턴/업종 축은 항상 생성된다", () => {
    const set = buildSectionQuerySet(makeSection(), makeAnalysis());
    const axes = set.designIntents.map((i) => i.axis);
    assert.ok(axes.includes("pattern"));
    assert.ok(axes.includes("industry"));
    assert.ok(!axes.includes("mood"));
  });

  it("direction이 있으면 무드축도 생성된다", () => {
    const set = buildSectionQuerySet(makeSection(), makeAnalysis(), makeDirection());
    const mood = set.designIntents.find((i) => i.axis === "mood");
    assert.ok(mood);
    assert.equal(mood!.query, "신뢰감 있는 차분한");
  });

  it("패턴축 query는 layoutPattern을 사람이 읽는 소문자 구문으로 바꾼다", () => {
    const set = buildSectionQuerySet(makeSection(), makeAnalysis());
    const pattern = set.designIntents.find((i) => i.axis === "pattern");
    assert.equal(pattern!.query, "hero section");
  });

  it("imageQueries에는 hero/section/dashboard 같은 UI 용어가 절대 섞이지 않는다", () => {
    const set = buildSectionQuerySet(
      makeSection({ recommendedLayout: "hero-section" }),
      makeAnalysis({ domain: "dashboard-ops" }),
      makeDirection(),
    );
    for (const q of set.imageQueries) {
      assert.doesNotMatch(q, /\b(hero|section|card|grid|layout|website|page|dashboard)\b/i);
    }
    assert.ok(set.imageQueries.length > 0);
  });

  it("imageQueries는 중복을 제거한다", () => {
    const set = buildSectionQuerySet(makeSection(), makeAnalysis());
    assert.equal(set.imageQueries.length, new Set(set.imageQueries).size);
  });
});
