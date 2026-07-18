import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Page, ProjectAnalysis } from "../analysis/types";
import {
  assertBriefMatchesAnalysis,
  buildConfirmedBrief,
  ConfirmBriefError,
} from "./confirmBrief";
import type {
  MoodOption,
  Palette,
  PaletteOption,
  ReferenceAdoption,
  ReferenceResult,
} from "./types";

function makePalette(mode: "light" | "dark"): Palette {
  return {
    mode,
    primary: "#2563EB",
    secondary: "#64748B",
    accent: "#F97316",
    background: mode === "light" ? "#FFFFFF" : "#0F172A",
    surface: mode === "light" ? "#F8FAFC" : "#1E293B",
    text: mode === "light" ? "#0F172A" : "#F8FAFC",
    navigation: "#1E293B",
  };
}

function makePaletteOption(optionId = "trust"): PaletteOption {
  return {
    optionId,
    label: "신뢰형",
    light: makePalette("light"),
    dark: makePalette("dark"),
  };
}

function makeMoodOption(id = "mood-1"): MoodOption {
  return {
    id,
    label: "신뢰의 블루",
    keywords: ["신뢰감 있는", "안정적인"],
    description: "차분하고 신뢰가 가는 톤",
    imageQuery: "calm office interior",
    paletteOptionId: "trust",
    typography: {
      title: { sampleText: "신뢰를 잇는 방법", note: "굵은 산세리프" },
      body: { sampleText: "차분하고 안정적인 톤을 유지합니다.", note: "본문은 굵기 대비를 최소화" },
    },
    styleAttributes: {
      radius: "soft",
      density: "airy",
      contrast: "soft",
      typographyNote: "본문은 굵기 대비를 최소화",
    },
    recommendedDirections: [],
    avoidDirections: [],
  };
}

function makeAnalysis(): ProjectAnalysis {
  const pages: Page[] = [
    {
      pageId: "p1",
      pageTitle: "홈",
      pageRole: "cover",
      selected: true,
      sections: [
        {
          sectionId: "p1-s1",
          sectionTitle: "히어로",
          contentSummary: "[회사A] 소개 문구",
          contentType: "feature",
          recommendedLayout: "hero",
          status: "confirmed",
        },
        {
          sectionId: "p1-s2",
          sectionTitle: "후보 섹션",
          contentSummary: "아직 확정 안 됨",
          contentType: "feature",
          recommendedLayout: "card-grid",
          status: "candidate",
        },
      ],
    },
    {
      pageId: "p2",
      pageTitle: "제외된 페이지",
      pageRole: "content",
      selected: false,
      sections: [
        {
          sectionId: "p2-s1",
          sectionTitle: "제외됨",
          contentSummary: "선택 안 된 페이지",
          contentType: "feature",
          recommendedLayout: "card-grid",
          status: "confirmed",
        },
      ],
    },
  ];
  return {
    title: "테스트 프로젝트",
    description: "설명",
    domain: "marketing-web",
    domainConfidence: 0.9,
    targetUser: "테스트 대상",
    tags: [],
    projectType: "브로셔",
    pages,
  };
}

function makeReferences(overrides: Partial<ReferenceResult> = {}): ReferenceResult {
  return {
    editedPaletteOption: makePaletteOption(),
    paletteMode: "light",
    moodOptions: [makeMoodOption()],
    selectedMoodId: "mood-1",
    globalMood: {
      keywords: ["신뢰감 있는"],
      description: "차분한 톤",
      images: [
        { url: "https://img.example/1.jpg", source: "unsplash", attribution: "A" },
        { url: "https://img.example/2.jpg", source: "unsplash", attribution: "B" },
      ],
    },
    ...overrides,
  };
}

function makeAdoption(overrides: Partial<ReferenceAdoption> = {}): ReferenceAdoption {
  return {
    adoptionId: "adopt-1",
    pageId: "p1",
    sectionId: "p1-s1",
    reference: {
      provider: "manual",
      sourceUrl: "https://example.com/ref",
      patterns: ["split-hero"],
      colors: ["#2563EB"],
      usage: "inspiration-only",
      fetchedAt: "2026-07-18T00:00:00.000Z",
    },
    status: "applied",
    aspects: ["layout"],
    note: "히어로 구도 참고",
    decision: { source: "user", freshness: "current", basedOnHash: "seed" },
    ...overrides,
  };
}

const fixedNow = () => "2026-07-18T00:00:00.000Z";

describe("confirmBrief — 팔레트/무드 확정 검증", () => {
  it("팔레트 미확정이면 던진다", () => {
    const refs = makeReferences({ editedPaletteOption: undefined });
    assert.throws(
      () => buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow }),
      ConfirmBriefError,
    );
  });

  it("무드 미확정이면 던진다", () => {
    const refs = makeReferences({ selectedMoodId: undefined });
    assert.throws(
      () => buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow }),
      ConfirmBriefError,
    );
  });

  it("선택 이미지가 4장을 넘으면 던진다", () => {
    const refs = makeReferences({
      globalMood: {
        keywords: [],
        description: "",
        images: Array.from({ length: 5 }, (_, i) => ({
          url: `https://img.example/${i}.jpg`,
          source: "unsplash" as const,
          attribution: "A",
        })),
      },
      selectedMoodImageUrls: Array.from(
        { length: 5 },
        (_, i) => `https://img.example/${i}.jpg`,
      ),
    });
    assert.throws(
      () => buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow }),
      ConfirmBriefError,
    );
  });
});

describe("confirmBrief — pageId/sectionId 검증", () => {
  it("존재하지 않는 섹션에 대한 채택은 차단한다", () => {
    const refs = makeReferences({
      referenceAdoptions: {
        "adopt-1": makeAdoption({ sectionId: "does-not-exist" }),
      },
    });
    assert.throws(
      () => buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow }),
      ConfirmBriefError,
    );
  });

  it("선택되지 않은 페이지에 대한 채택은 차단한다", () => {
    const refs = makeReferences({
      referenceAdoptions: {
        "adopt-1": makeAdoption({ pageId: "p2", sectionId: "p2-s1" }),
      },
    });
    assert.throws(
      () => buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow }),
      ConfirmBriefError,
    );
  });
});

describe("confirmBrief — 페이지/섹션 범위", () => {
  it("선택된 페이지의 확정 섹션만 포함한다 (후보 섹션·미선택 페이지 제외)", () => {
    const brief = buildConfirmedBrief(makeAnalysis(), makeReferences(), {
      now: fixedNow,
    });
    assert.equal(brief.pages.length, 1);
    assert.equal(brief.pages[0].pageId, "p1");
    assert.deepEqual(
      brief.pages[0].sections.map((s) => s.sectionId),
      ["p1-s1"],
    );
  });
});

describe("confirmBrief — 채택 상태별 필터링", () => {
  it("applied만 포함하고 reference-only/excluded는 제외한다", () => {
    const refs = makeReferences({
      referenceAdoptions: {
        applied: makeAdoption({ adoptionId: "applied", status: "applied" }),
        refOnly: makeAdoption({
          adoptionId: "refOnly",
          status: "reference-only",
        }),
        excluded: makeAdoption({ adoptionId: "excluded", status: "excluded" }),
      },
    });
    const brief = buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow });
    const section = brief.pages[0].sections[0];
    assert.deepEqual(
      section.adoptions.map((a) => a.adoptionId),
      ["applied"],
    );
    assert.equal(section.priority, "high-impact");
  });

  it("채택이 없으면 섹션은 inherited로 표시된다", () => {
    const brief = buildConfirmedBrief(makeAnalysis(), makeReferences(), {
      now: fixedNow,
    });
    assert.equal(brief.pages[0].sections[0].priority, "inherited");
    assert.equal(brief.pages[0].sections[0].decision.source, "inherited");
  });
});

describe("confirmBrief — 팔레트 모드 스냅샷", () => {
  it("editedPaletteOption과 paletteMode를 그대로 보존한다 (역할 재배치 유실 방지)", () => {
    const edited = makePaletteOption();
    edited.light.primary = "#111111"; // 역할 재배치를 흉내
    const refs = makeReferences({ editedPaletteOption: edited, paletteMode: "dark" });
    const brief = buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow });
    assert.equal(brief.direction.paletteMode, "dark");
    assert.equal(brief.direction.editedPaletteOption.light.primary, "#111111");
    assert.equal(brief.direction.paletteOptionId, "trust");
  });
});

describe("confirmBrief — 브랜드 결정", () => {
  it("채택된 분석 대상만 포함하고 wowPoints/painPoints를 옮긴다", () => {
    const refs = makeReferences({
      analysisTargetList: [
        {
          id: "t1",
          name: "브랜드A",
          url: "https://a.example",
          source: "manual",
          oneLineSummary: "요약",
          analysisStatus: "analyzed",
          adopted: true,
        },
        {
          id: "t2",
          name: "브랜드B",
          url: "https://b.example",
          source: "manual",
          oneLineSummary: "요약",
          analysisStatus: "analyzed",
          adopted: false,
        },
      ],
      targetAnalyses: {
        t1: {
          id: "t1",
          name: "브랜드A",
          depth: "deep",
          layoutStrategy: "",
          colorVisualStrategy: "",
          componentPattern: "",
          painPoints: ["복잡한 내비게이션"],
          wowPoints: ["명확한 CTA"],
          estimatedIntent: "",
          implications: "",
          sourceUrl: "https://a.example",
          confidence: "추천",
          analyzedAt: fixedNow(),
        },
      },
    });
    const brief = buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow });
    assert.equal(brief.brandDecisions.length, 1);
    assert.equal(brief.brandDecisions[0].targetId, "t1");
    assert.deepEqual(brief.brandDecisions[0].adoptedPatterns, ["명확한 CTA"]);
    assert.deepEqual(brief.brandDecisions[0].avoidedPatterns, ["복잡한 내비게이션"]);
  });
});

describe("confirmBrief — 해시 결정성", () => {
  it("같은 입력이면 같은 revision hash를 낸다", () => {
    const a = buildConfirmedBrief(makeAnalysis(), makeReferences(), { now: fixedNow });
    const b = buildConfirmedBrief(makeAnalysis(), makeReferences(), { now: fixedNow });
    assert.deepEqual(a.revision, b.revision);
  });

  it("채택 내용이 달라지면 briefHash도 달라진다", () => {
    const base = buildConfirmedBrief(makeAnalysis(), makeReferences(), { now: fixedNow });
    const withAdoption = buildConfirmedBrief(
      makeAnalysis(),
      makeReferences({ referenceAdoptions: { a: makeAdoption() } }),
      { now: fixedNow },
    );
    assert.notEqual(base.revision.briefHash, withAdoption.revision.briefHash);
    // 채택 내용은 direction과 무관하므로 directionHash는 그대로다.
    assert.equal(base.revision.directionHash, withAdoption.revision.directionHash);
  });
});

describe("confirmBrief — 민감정보 미포함", () => {
  it("결과 JSON에 원문/복원 매핑 관련 키가 없다", () => {
    const brief = buildConfirmedBrief(makeAnalysis(), makeReferences(), {
      now: fixedNow,
    });
    const serialized = JSON.stringify(brief);
    for (const forbidden of ["parsedText", "mappings", "Detection", "raw\":"]) {
      assert.equal(serialized.includes(forbidden), false, `"${forbidden}"가 포함되면 안 됨`);
    }
  });
});

describe("assertBriefMatchesAnalysis — P9-A 교차 검증", () => {
  it("브리프가 현재 분석 결과와 맞으면 통과한다", () => {
    const brief = buildConfirmedBrief(makeAnalysis(), makeReferences(), {
      now: fixedNow,
    });
    assert.doesNotThrow(() => assertBriefMatchesAnalysis(brief, makeAnalysis()));
  });

  it("그 사이 페이지 선택이 바뀌어 브리프의 페이지가 사라졌으면 던진다", () => {
    const brief = buildConfirmedBrief(makeAnalysis(), makeReferences(), {
      now: fixedNow,
    });
    const laterAnalysis = makeAnalysis();
    laterAnalysis.pages[0].selected = false; // p1을 더 이상 선택하지 않음
    assert.throws(
      () => assertBriefMatchesAnalysis(brief, laterAnalysis),
      ConfirmBriefError,
    );
  });

  it("그 사이 섹션이 후보로 되돌아갔으면 던진다", () => {
    const brief = buildConfirmedBrief(makeAnalysis(), makeReferences(), {
      now: fixedNow,
    });
    const laterAnalysis = makeAnalysis();
    laterAnalysis.pages[0].sections[0].status = "candidate";
    assert.throws(
      () => assertBriefMatchesAnalysis(brief, laterAnalysis),
      ConfirmBriefError,
    );
  });
});
