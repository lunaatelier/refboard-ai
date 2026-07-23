import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Page, ProjectAnalysis } from "../analysis/types";
import {
  assertBriefMatchesAnalysis,
  buildConfirmedBrief,
  ConfirmBriefError,
} from "./confirmBrief";
import type {
  DirectionImageCandidate,
  DirectionOption,
  MoodOption,
  Palette,
  PaletteOption,
  ReferenceAdoption,
  ReferenceResult,
} from "./types";

function makeImageCandidate(
  overrides: Partial<DirectionImageCandidate> & Pick<DirectionImageCandidate, "url">,
): DirectionImageCandidate {
  return {
    source: "unsplash",
    attribution: "A",
    sourceUrl: `${overrides.url}-page`,
    usage: "inspiration-only",
    fetchedAt: "2026-07-23T00:00:00.000Z",
    role: "detail",
    selected: true,
    order: 0,
    ...overrides,
  };
}

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

function makeDirectionOption(overrides: Partial<DirectionOption> = {}): DirectionOption {
  return {
    directionId: "mood-1",
    label: "신뢰의 블루",
    description: "차분하고 신뢰가 가는 톤",
    paletteOptionId: "trust",
    moodOptionId: "mood-1",
    keywords: ["신뢰감 있는", "안정적인"],
    typography: {
      title: { sampleText: "신뢰를 잇는 방법", note: "굵은 산세리프" },
      body: {
        sampleText: "차분하고 안정적인 톤을 유지합니다.",
        note: "본문은 굵기 대비를 최소화",
      },
    },
    styleAttributes: { radius: "soft", density: "airy", contrast: "soft" },
    imageCandidates: [
      makeImageCandidate({ url: "https://img.example/1.jpg", role: "hero", order: 0 }),
      makeImageCandidate({ url: "https://img.example/2.jpg", attribution: "B", role: "supporting", order: 1 }),
    ],
    recommendedDirections: [],
    avoidDirections: [],
    ...overrides,
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
    directionOptions: [makeDirectionOption()],
    selectedDirectionId: "mood-1",
    ...overrides,
  };
}

// recommendHighImpactSectionIds는 확정 섹션이 적으면(페이지당 최소 min(3,개수)까지)
// 패턴에 안 걸리는 섹션도 "부족분 채우기"로 고영향에 포함시킨다. 그래서 "규칙에
// 안 걸리면 inherited"를 검증하려면 패딩이 소진되고 남는 섹션이 있도록 확정 섹션을
// 충분히 늘려야 한다 — p1-s1(hero, 매칭) + 일반 섹션 3개 중 마지막 하나만 제외됨.
function makeAnalysisWithNonHighImpactTail(): ProjectAnalysis {
  const analysis = makeAnalysis();
  const generic = (n: number) => ({
    sectionId: `p1-generic-${n}`,
    sectionTitle: `일반 섹션 ${n}`,
    contentSummary: "설명 텍스트",
    contentType: "content",
    recommendedLayout: "text-block",
    status: "confirmed" as const,
  });
  analysis.pages[0].sections = [
    analysis.pages[0].sections[0], // p1-s1 (hero, 패턴 매칭)
    generic(1),
    generic(2),
    generic(3), // 패딩 대상(min(3,4)=3)에서 밀려나 inherited로 남는다
  ];
  return analysis;
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

  it("방향 미확정이면 던진다", () => {
    const refs = makeReferences({ selectedDirectionId: undefined });
    assert.throws(
      () => buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow }),
      ConfirmBriefError,
    );
  });

  it("선택된 방향이 directionOptions 목록에 없으면 던진다", () => {
    const refs = makeReferences({ selectedDirectionId: "does-not-exist" });
    assert.throws(
      () => buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow }),
      ConfirmBriefError,
    );
  });

  it("선택 이미지가 4장을 넘으면 던진다", () => {
    const refs = makeReferences({
      directionOptions: [
        makeDirectionOption({
          imageCandidates: Array.from({ length: 5 }, (_, i) =>
            makeImageCandidate({ url: `https://img.example/${i}.jpg`, order: i }),
          ),
        }),
      ],
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

describe("confirmBrief — 섹션 우선순위 (P5-2)", () => {
  it("sectionDecisionsByKey에 명시적 결정이 있으면 그걸 쓴다(적용 레퍼런스 없어도)", () => {
    const refs = makeReferences({
      sectionDecisionsByKey: {
        "p1::p1-s1": { priority: "optional", source: "rule" },
      },
    });
    const brief = buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow });
    assert.equal(brief.pages[0].sections[0].priority, "optional");
    assert.equal(brief.pages[0].sections[0].decision.source, "rule");
  });

  it("명시적 결정이 없으면 SectionRefsTab과 동일한 규칙 추천(resolveSectionPriority)으로 떨어진다 (P8 보완 — 채택 여부와 무관)", () => {
    // p1-s1은 recommendedLayout="hero"라 규칙 추천이 원래도 고영향으로 판단한다.
    // 채택(adoption) 유무는 더 이상 이 판단에 관여하지 않는다 — 있어도(makeAdoption)
    // 없어도 같은 결과여야 한다(이전엔 "적용 레퍼런스가 있으면 고영향"이라는 별도
    // 휴리스틱이 있어 sectionDecisionsByKey 미시딩 시 SectionRefsTab 표시와
    // 어긋날 수 있었다).
    const refs = makeReferences({
      referenceAdoptions: { a: makeAdoption() },
    });
    const brief = buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow });
    assert.equal(brief.pages[0].sections[0].priority, "high-impact");
    assert.equal(brief.pages[0].sections[0].decision.source, "rule");
  });

  it("규칙 추천과 무관하게 채택 유무만으로 고영향 여부가 바뀌지 않는다", () => {
    const withAdoption = buildConfirmedBrief(
      makeAnalysis(),
      makeReferences({ referenceAdoptions: { a: makeAdoption() } }),
      { now: fixedNow },
    );
    const withoutAdoption = buildConfirmedBrief(makeAnalysis(), makeReferences(), {
      now: fixedNow,
    });
    assert.equal(withAdoption.pages[0].sections[0].priority, withoutAdoption.pages[0].sections[0].priority);
    assert.equal(
      withAdoption.pages[0].sections[0].decision.source,
      withoutAdoption.pages[0].sections[0].decision.source,
    );
  });

  it("규칙 추천에 걸리지 않고 패딩 대상에서도 밀려난 섹션은 inherited/rule로 떨어진다", () => {
    const analysis = makeAnalysisWithNonHighImpactTail();
    const brief = buildConfirmedBrief(analysis, makeReferences(), { now: fixedNow });
    const tail = brief.pages[0].sections.find((s) => s.sectionId === "p1-generic-3");
    assert.equal(tail?.priority, "inherited");
    assert.equal(tail?.decision.source, "rule");
  });
});

describe("confirmBrief — 페이지 목적 요약 (P5-1)", () => {
  it("pageMetaById 덮어쓰기가 없으면 로컬 파생값(pageRole 템플릿)을 쓴다", () => {
    const brief = buildConfirmedBrief(makeAnalysis(), makeReferences(), {
      now: fixedNow,
    });
    assert.equal(brief.pages[0].purposeSummary, "첫인상과 핵심 가치 제안 전달");
  });

  it("pageMetaById 덮어쓰기가 있으면 그 값을 쓴다", () => {
    const refs = makeReferences({
      pageMetaById: { p1: { purposeSummary: "사용자가 직접 쓴 목적" } },
    });
    const brief = buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow });
    assert.equal(brief.pages[0].purposeSummary, "사용자가 직접 쓴 목적");
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

  it("채택도 없고 규칙 추천 패딩에서도 밀려난 섹션은 inherited로 표시된다", () => {
    const analysis = makeAnalysisWithNonHighImpactTail();
    const brief = buildConfirmedBrief(analysis, makeReferences(), { now: fixedNow });
    const tail = brief.pages[0].sections.find((s) => s.sectionId === "p1-generic-3");
    assert.equal(tail?.priority, "inherited");
    assert.equal(tail?.decision.source, "rule");
  });
});

describe("confirmBrief — 방향(P3-5): directionOptions가 무드·이미지의 단일 출처", () => {
  it("moodId/moodKeywords/typographyDirection/avoidDirections이 selectedDirection에서 온다", () => {
    const refs = makeReferences({
      directionOptions: [
        makeDirectionOption({
          moodOptionId: "mood-1",
          keywords: ["절제된", "고급스러운"],
          typography: {
            title: { sampleText: "제목", note: "커스텀 타이포 노트" },
            body: { sampleText: "본문", note: "본문 노트" },
          },
          avoidDirections: ["화려한 그라디언트"],
        }),
      ],
    });
    const brief = buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow });
    assert.equal(brief.direction.moodId, "mood-1");
    assert.deepEqual(brief.direction.moodKeywords, ["절제된", "고급스러운"]);
    assert.equal(brief.direction.typographyDirection, "커스텀 타이포 노트");
    assert.deepEqual(brief.direction.avoidDirections, ["화려한 그라디언트"]);
  });

  it("selectedMoodImages는 imageCandidates 중 selected=true만, 출처 메타데이터(sourceUrl/usage/fetchedAt)까지 담는다", () => {
    const refs = makeReferences({
      directionOptions: [
        makeDirectionOption({
          imageCandidates: [
            makeImageCandidate({
              url: "https://img.example/kept.jpg",
              source: "pexels",
              attribution: "Kept",
              role: "hero",
              order: 0,
            }),
            makeImageCandidate({
              url: "https://img.example/excluded.jpg",
              source: "pexels",
              attribution: "Excluded",
              role: "detail",
              selected: false,
              order: 1,
            }),
          ],
        }),
      ],
    });
    const brief = buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow });
    assert.deepEqual(brief.direction.selectedMoodImages, [
      {
        url: "https://img.example/kept.jpg",
        source: "pexels",
        attribution: "Kept",
        sourceUrl: "https://img.example/kept.jpg-page",
        usage: "inspiration-only",
        fetchedAt: "2026-07-23T00:00:00.000Z",
      },
    ]);
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

  it("brandDecisionOverrides(사용자 편집)가 있으면 wowPoints/painPoints보다 우선한다", () => {
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
          verifiedSources: [
            {
              url: "https://a.example",
              status: "official",
              groundingCited: true,
              domainVerified: true,
              fetchedAt: fixedNow(),
            },
          ],
          confidence: "추천",
          analyzedAt: fixedNow(),
        },
      },
      brandDecisionOverrides: {
        t1: { adoptedPatterns: ["사용자가 남긴 것"], avoidedPatterns: [] },
      },
    });
    const brief = buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow });
    assert.deepEqual(brief.brandDecisions[0].adoptedPatterns, ["사용자가 남긴 것"]);
    assert.deepEqual(brief.brandDecisions[0].avoidedPatterns, []);
    assert.equal(brief.brandDecisions[0].verifiedSources[0].status, "official");
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

describe("confirmBrief — imageNeed (P7): imageNeedByKey와 imageHints를 같은 key로 결합", () => {
  it("imageNeedByKey가 없으면 contentType 휴리스틱으로 required가 정해진다 (feature=icon 기본 true)", () => {
    const brief = buildConfirmedBrief(makeAnalysis(), makeReferences(), { now: fixedNow });
    const imageNeed = brief.pages[0].sections[0].imageNeed;
    assert.equal(imageNeed?.required, true);
    assert.equal(imageNeed?.role, "icon");
  });

  it("사용자가 명시적으로 false로 끄면 required=false가 되고 prompt/assetId를 담지 않는다", () => {
    const refs = makeReferences({
      imageNeedByKey: { "p1::p1-s1": false },
      imageHints: [
        {
          key: "p1::p1-s1",
          area: "히어로",
          scale: "icon",
          prompt: "꺼졌는데 남아있는 프롬프트",
          direction: "사진형",
          sourceReferenceMode: "use-source-image",
        },
      ],
    });
    const brief = buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow });
    const imageNeed = brief.pages[0].sections[0].imageNeed;
    assert.equal(imageNeed?.required, false);
    assert.equal(imageNeed?.prompt, undefined);
  });

  it("imageHints에 같은 key의 프롬프트/생성 이미지가 있으면 imageNeed에 옮겨온다", () => {
    const refs = makeReferences({
      imageNeedByKey: { "p1::p1-s1": true },
      imageHints: [
        {
          key: "p1::p1-s1",
          area: "히어로",
          scale: "hero",
          prompt: "hero prompt",
          direction: "사진형",
          sourceReferenceMode: "use-source-image",
          generatedImageAssetId: "asset-1",
        },
      ],
    });
    const brief = buildConfirmedBrief(makeAnalysis(), refs, { now: fixedNow });
    const imageNeed = brief.pages[0].sections[0].imageNeed;
    assert.equal(imageNeed?.required, true);
    assert.equal(imageNeed?.role, "hero");
    assert.equal(imageNeed?.prompt, "hero prompt");
    assert.equal(imageNeed?.generatedImageAssetId, "asset-1");
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
