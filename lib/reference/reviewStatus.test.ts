import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Page, ProjectAnalysis } from "../analysis/types";
import { setAdoption } from "./adoption";
import { buildConfirmedBrief, computeAdoptionBasisHash } from "./confirmBrief";
import { evaluateReviewStatus, unverifiedSourceFingerprint } from "./reviewStatus";
import type {
  CollectedReference,
  DirectionOption,
  MoodOption,
  Palette,
  PaletteOption,
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
      body: { sampleText: "차분한 톤", note: "본문 굵기 대비 최소화" },
    },
    styleAttributes: {
      radius: "soft",
      density: "airy",
      contrast: "soft",
      typographyNote: "본문 굵기 대비 최소화",
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
      body: { sampleText: "차분한 톤", note: "본문 굵기 대비 최소화" },
    },
    styleAttributes: { radius: "soft", density: "airy", contrast: "soft" },
    imageCandidates: [],
    recommendedDirections: [],
    avoidDirections: [],
    ...overrides,
  };
}

// 페이지 하나, 확정 섹션 4개(히어로 1 + 일반 3) — recommendHighImpactSectionIds가
// 확정 섹션이 적을 때 패딩으로 부족분을 채우는 것까지 감안해, 패딩에서도 밀려나는
// "진짜 inherited" 섹션(p1-generic-3)이 하나 남도록 구성한다.
function makeAnalysis(): ProjectAnalysis {
  const pages: Page[] = [
    {
      pageId: "p1",
      pageTitle: "홈",
      pageRole: "cover",
      selected: true,
      sections: [
        {
          sectionId: "p1-hero",
          sectionTitle: "히어로",
          contentSummary: "[회사A] 소개 문구",
          contentType: "feature",
          recommendedLayout: "hero",
          status: "confirmed",
        },
        {
          sectionId: "p1-generic-1",
          sectionTitle: "일반 섹션 1",
          contentSummary: "설명",
          contentType: "content",
          recommendedLayout: "text-block",
          status: "confirmed",
        },
        {
          sectionId: "p1-generic-2",
          sectionTitle: "일반 섹션 2",
          contentSummary: "설명",
          contentType: "content",
          recommendedLayout: "text-block",
          status: "confirmed",
        },
        {
          sectionId: "p1-generic-3",
          sectionTitle: "일반 섹션 3",
          contentSummary: "설명",
          contentType: "content",
          recommendedLayout: "text-block",
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

const collected: CollectedReference = {
  id: "col-1",
  platform: "Dribbble",
  title: "Dashboard shot",
  sourceUrl: "https://dribbble.com/shots/1",
  usage: "inspiration-only",
};

const fixedNow = () => "2026-07-22T00:00:00.000Z";

// makeAnalysis()의 확정 섹션 4개 중 패딩까지 포함해 실제로 고영향 판정되는 3개
// (hero + generic-1/2, generic-3은 패딩에서 밀려나 inherited)에 전부 layoutPattern을
// 채운 "완전히 결정된" bySectionId — canConfirm=true를 만들어야 하는 테스트에서 쓴다.
const fullyDecidedBySectionId: ReferenceResult["bySectionId"] = {
  "p1-hero": { sectionId: "p1-hero", layoutPattern: "split-hero", searchQuery: "", platformQueries: [] },
  "p1-generic-1": { sectionId: "p1-generic-1", layoutPattern: "text-block", searchQuery: "", platformQueries: [] },
  "p1-generic-2": { sectionId: "p1-generic-2", layoutPattern: "text-block", searchQuery: "", platformQueries: [] },
};

describe("evaluateReviewStatus — 팔레트/방향 미확정", () => {
  it("방향 미확정이면 required 이슈를 내고 canConfirm=false", () => {
    const analysis = makeAnalysis();
    const refs = makeReferences({ selectedDirectionId: undefined });
    const status = evaluateReviewStatus(analysis, refs);
    assert.equal(status.canConfirm, false);
    assert.ok(status.issues.some((i) => i.id === "direction-missing" && i.severity === "required"));
  });

  it("팔레트 미확정이면 required 이슈를 낸다", () => {
    const analysis = makeAnalysis();
    const refs = makeReferences({ editedPaletteOption: undefined });
    const status = evaluateReviewStatus(analysis, refs);
    assert.equal(status.canConfirm, false);
    assert.ok(status.issues.some((i) => i.id === "direction-missing"));
  });
});

describe("evaluateReviewStatus — 고영향 섹션 결정", () => {
  it("고영향 섹션(히어로)에 레이아웃도 채택도 없으면 required로 막는다", () => {
    const analysis = makeAnalysis();
    const status = evaluateReviewStatus(analysis, makeReferences());
    assert.equal(status.canConfirm, false);
    assert.ok(
      status.issues.some((i) => i.id === "section-decision-missing:p1:p1-hero" && i.severity === "required"),
    );
  });

  it("bySectionId에 명시적 layoutPattern이 있으면 통과한다", () => {
    const analysis = makeAnalysis();
    const refs = makeReferences({
      bySectionId: {
        "p1-hero": {
          sectionId: "p1-hero",
          layoutPattern: "split-hero",
          searchQuery: "",
          platformQueries: [],
        },
      },
    });
    const status = evaluateReviewStatus(analysis, refs);
    assert.equal(
      status.issues.some((i) => i.id === "section-decision-missing:p1:p1-hero"),
      false,
    );
  });

  it("적용(applied) 채택이 있어도 통과한다(현재 기준 해시와 일치할 때)", () => {
    const analysis = makeAnalysis();
    let refs = makeReferences();
    const basis = computeAdoptionBasisHash(analysis, refs);
    refs = setAdoption(
      refs,
      { pageId: "p1", sectionId: "p1-hero", collected, status: "applied", basedOnHash: basis },
      fixedNow,
    );
    const status = evaluateReviewStatus(analysis, refs);
    assert.equal(
      status.issues.some((i) => i.id === "section-decision-missing:p1:p1-hero"),
      false,
    );
  });

  it("고영향 규칙 추천 패딩에서 밀려난 진짜 inherited 섹션은 결정 없이도 막지 않는다(선택 미사용 허용)", () => {
    const analysis = makeAnalysis();
    const status = evaluateReviewStatus(analysis, makeReferences());
    assert.equal(
      status.issues.some((i) => i.id === "section-decision-missing:p1:p1-generic-3"),
      false,
    );
  });
});

describe("evaluateReviewStatus — 개별 채택의 최신성", () => {
  it("과거 기준 해시로 만든 채택은 방향이 바뀌면 required로 막는다", () => {
    const analysis = makeAnalysis();
    let refs = makeReferences();
    const staleBasis = computeAdoptionBasisHash(analysis, refs);
    refs = setAdoption(
      refs,
      { pageId: "p1", sectionId: "p1-hero", collected, status: "applied", basedOnHash: staleBasis },
      fixedNow,
    );
    // 방향을 다른 것으로 바꿔 directionHash가 달라지게 한다.
    refs = {
      ...refs,
      directionOptions: [makeDirectionOption({ directionId: "mood-2", moodOptionId: "mood-2" })],
      selectedDirectionId: "mood-2",
    };
    const status = evaluateReviewStatus(analysis, refs);
    assert.equal(status.canConfirm, false);
    assert.ok(status.issues.some((i) => i.id.startsWith("adoption-stale:")));
  });

  it("현재 기준 해시로 다시 채택하면 재확인 이슈가 사라진다", () => {
    const analysis = makeAnalysis();
    let refs = makeReferences({
      directionOptions: [makeDirectionOption({ directionId: "mood-2", moodOptionId: "mood-2" })],
      selectedDirectionId: "mood-2",
    });
    const currentBasis = computeAdoptionBasisHash(analysis, refs);
    refs = setAdoption(
      refs,
      { pageId: "p1", sectionId: "p1-hero", collected, status: "applied", basedOnHash: currentBasis },
      fixedNow,
    );
    const status = evaluateReviewStatus(analysis, refs);
    assert.equal(
      status.issues.some((i) => i.id.startsWith("adoption-stale:")),
      false,
    );
  });
});

describe("unverifiedSourceFingerprint", () => {
  it("verifiedSources가 없으면 미확인으로 취급한다", () => {
    assert.equal(unverifiedSourceFingerprint(undefined), "no-verified-sources");
  });

  it("verifiedSources가 비어있어도 미확인으로 취급한다", () => {
    assert.equal(unverifiedSourceFingerprint([]), "no-verified-sources");
  });

  it("unverified 출처가 없으면 빈 문자열(인지 불필요)", () => {
    assert.equal(unverifiedSourceFingerprint([{ url: "https://a.example", status: "official" }]), "");
  });

  it("unverified 출처 URL 집합을 정렬해 지문으로 만든다", () => {
    const fp1 = unverifiedSourceFingerprint([
      { url: "https://b.example", status: "unverified" },
      { url: "https://a.example", status: "unverified" },
    ]);
    const fp2 = unverifiedSourceFingerprint([
      { url: "https://a.example", status: "unverified" },
      { url: "https://b.example", status: "unverified" },
    ]);
    assert.equal(fp1, fp2);
  });
});

describe("evaluateReviewStatus — 출처 미확인 인지", () => {
  function refsWithAdoptedTarget(overrides: Partial<ReferenceResult> = {}): ReferenceResult {
    return makeReferences({
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
          painPoints: [],
          wowPoints: [],
          estimatedIntent: "",
          implications: "",
          sourceUrl: "https://a.example",
          verifiedSources: [{ url: "https://a.example", status: "unverified", groundingCited: false, domainVerified: false, fetchedAt: fixedNow() }],
          confidence: "추천",
          analyzedAt: fixedNow(),
        },
      },
      ...overrides,
    });
  }

  it("채택한 브랜드에 미확인 출처가 있고 인지 안 했으면 required로 막는다", () => {
    const analysis = makeAnalysis();
    const status = evaluateReviewStatus(analysis, refsWithAdoptedTarget());
    assert.equal(status.canConfirm, false);
    assert.ok(status.issues.some((i) => i.id === "unverified-source:t1" && i.targetId === "t1"));
  });

  it("현재 출처 구성 그대로 인지하면 통과한다", () => {
    const analysis = makeAnalysis();
    const refs = refsWithAdoptedTarget({
      unverifiedSourceAcks: { t1: unverifiedSourceFingerprint([{ url: "https://a.example", status: "unverified" }]) },
    });
    const status = evaluateReviewStatus(analysis, refs);
    assert.equal(status.issues.some((i) => i.id === "unverified-source:t1"), false);
  });

  it("재분석으로 출처 구성이 바뀌면 예전 인지가 무효화된다", () => {
    const analysis = makeAnalysis();
    const refs = refsWithAdoptedTarget({
      unverifiedSourceAcks: { t1: "https://old-source.example" },
    });
    const status = evaluateReviewStatus(analysis, refs);
    assert.ok(status.issues.some((i) => i.id === "unverified-source:t1"));
  });

  it("채택하지 않은(adopted=false) 브랜드는 출처 미확인이어도 막지 않는다", () => {
    const analysis = makeAnalysis();
    const refs = refsWithAdoptedTarget({
      analysisTargetList: [
        {
          id: "t1",
          name: "브랜드A",
          url: "https://a.example",
          source: "manual",
          oneLineSummary: "요약",
          analysisStatus: "analyzed",
          adopted: false,
        },
      ],
    });
    const status = evaluateReviewStatus(analysis, refs);
    assert.equal(status.issues.some((i) => i.id === "unverified-source:t1"), false);
  });
});

describe("evaluateReviewStatus — 기존 확정과 최신성", () => {
  it("확정한 적 없으면 priorConfirmationStale=false", () => {
    const analysis = makeAnalysis();
    const status = evaluateReviewStatus(analysis, makeReferences());
    assert.equal(status.priorConfirmationStale, false);
  });

  it("확정 이후 아무것도 안 바뀌면 재확정 불필요(stale=false)", () => {
    const analysis = makeAnalysis();
    const refs = makeReferences({ bySectionId: fullyDecidedBySectionId });
    const brief = buildConfirmedBrief(analysis, refs, { now: fixedNow });
    const withBrief = { ...refs, confirmedBrief: brief };
    const status = evaluateReviewStatus(analysis, withBrief);
    assert.equal(status.priorConfirmationStale, false);
    assert.equal(status.issues.some((i) => i.severity === "stale"), false);
  });

  it("확정 이후 방향이 바뀌면 stale 이슈를 내되 확정 자체는 막지 않는다", () => {
    const analysis = makeAnalysis();
    const refs = makeReferences({ bySectionId: fullyDecidedBySectionId });
    const brief = buildConfirmedBrief(analysis, refs, { now: fixedNow });
    const changed: ReferenceResult = {
      ...refs,
      confirmedBrief: brief,
      directionOptions: [makeDirectionOption({ directionId: "mood-2", moodOptionId: "mood-2" })],
      selectedDirectionId: "mood-2",
    };
    const status = evaluateReviewStatus(analysis, changed);
    assert.equal(status.priorConfirmationStale, true);
    assert.ok(status.issues.some((i) => i.id === "prior-brief-stale" && i.severity === "stale"));
    // stale은 required가 아니므로 다른 조건이 만족되면 재확정 가능해야 한다.
    assert.equal(status.canConfirm, true);
  });

  // P8 보완 회귀 테스트 — computeCurrentRevision이 briefHash를 계산하지 않던 버그
  // 때문에, analysisHash/directionHash에 반영되지 않는 아래 변경들은 확정 후에도
  // "최신 아님"으로 잡히지 않았다. 각 변경이 실제로 stale을 유발하는지 확인한다.
  it("확정 이후 섹션 레이아웃만 바뀌어도 stale이다", () => {
    const analysis = makeAnalysis();
    const refs = makeReferences({ bySectionId: fullyDecidedBySectionId });
    const brief = buildConfirmedBrief(analysis, refs, { now: fixedNow });
    const changed: ReferenceResult = {
      ...refs,
      confirmedBrief: brief,
      bySectionId: {
        ...fullyDecidedBySectionId,
        "p1-hero": { sectionId: "p1-hero", layoutPattern: "full-bleed", searchQuery: "", platformQueries: [] },
      },
    };
    const status = evaluateReviewStatus(analysis, changed);
    assert.equal(status.priorConfirmationStale, true);
  });

  it("확정 이후 채택(적용 요소·메모)만 바뀌어도 stale이다", () => {
    const analysis = makeAnalysis();
    let refs = makeReferences({ bySectionId: fullyDecidedBySectionId });
    const basis = computeAdoptionBasisHash(analysis, refs);
    refs = setAdoption(
      refs,
      { pageId: "p1", sectionId: "p1-hero", collected, status: "applied", aspects: ["layout"], basedOnHash: basis },
      fixedNow,
    );
    const brief = buildConfirmedBrief(analysis, refs, { now: fixedNow });
    const changed: ReferenceResult = {
      ...setAdoption(
        refs,
        {
          pageId: "p1",
          sectionId: "p1-hero",
          collected,
          status: "applied",
          aspects: ["layout", "color"],
          note: "메모 추가",
          basedOnHash: basis,
        },
        fixedNow,
      ),
      confirmedBrief: brief,
    };
    const status = evaluateReviewStatus(analysis, changed);
    assert.equal(status.priorConfirmationStale, true);
  });

  it("확정 이후 브랜드 가져올점/피할점만 바뀌어도 stale이다", () => {
    const analysis = makeAnalysis();
    const refs = makeReferences({
      bySectionId: fullyDecidedBySectionId,
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
      brandDecisionOverrides: { t1: { adoptedPatterns: ["원래 문구"], avoidedPatterns: [] } },
    });
    const brief = buildConfirmedBrief(analysis, refs, { now: fixedNow });
    const changed: ReferenceResult = {
      ...refs,
      confirmedBrief: brief,
      brandDecisionOverrides: { t1: { adoptedPatterns: ["바뀐 문구"], avoidedPatterns: [] } },
    };
    const status = evaluateReviewStatus(analysis, changed);
    assert.equal(status.priorConfirmationStale, true);
  });

  it("확정 이후 imageNeed/프롬프트만 바뀌어도 stale이다", () => {
    const analysis = makeAnalysis();
    const refs = makeReferences({ bySectionId: fullyDecidedBySectionId });
    const brief = buildConfirmedBrief(analysis, refs, { now: fixedNow });
    const changed: ReferenceResult = {
      ...refs,
      confirmedBrief: brief,
      imageNeedByKey: { "p1::p1-hero": true },
      imageHints: [
        {
          key: "p1::p1-hero",
          area: "히어로",
          scale: "hero",
          prompt: "새 프롬프트",
          direction: "사진형",
          sourceReferenceMode: "use-source-image",
        },
      ],
    };
    const status = evaluateReviewStatus(analysis, changed);
    assert.equal(status.priorConfirmationStale, true);
  });

  it("출처 인지 체크만 바뀌면 브리프는 stale이 아니다(brief 구성에 영향 없음)", () => {
    const analysis = makeAnalysis();
    const refs = makeReferences({
      bySectionId: fullyDecidedBySectionId,
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
          painPoints: [],
          wowPoints: [],
          estimatedIntent: "",
          implications: "",
          sourceUrl: "https://a.example",
          verifiedSources: [
            { url: "https://a.example", status: "unverified", groundingCited: false, domainVerified: false, fetchedAt: fixedNow() },
          ],
          confidence: "추천",
          analyzedAt: fixedNow(),
        },
      },
    });
    const brief = buildConfirmedBrief(analysis, refs, { now: fixedNow });
    const changed: ReferenceResult = {
      ...refs,
      confirmedBrief: brief,
      unverifiedSourceAcks: { t1: unverifiedSourceFingerprint([{ url: "https://a.example", status: "unverified" }]) },
    };
    const status = evaluateReviewStatus(analysis, changed);
    assert.equal(status.priorConfirmationStale, false);
    // 대신 출처 인지 요구 이슈 자체는 해소된다.
    assert.equal(status.issues.some((i) => i.id === "unverified-source:t1"), false);
  });
});

describe("evaluateReviewStatus — 선택 기능 미사용(optional, 진행 차단 안 함)", () => {
  it("적용한 레퍼런스가 하나도 없으면 optional 이슈를 내지만 canConfirm은 유지된다", () => {
    const analysis = makeAnalysis();
    const refs = makeReferences({ bySectionId: fullyDecidedBySectionId });
    const status = evaluateReviewStatus(analysis, refs);
    const issue = status.issues.find((i) => i.id === "no-adoptions-used");
    assert.ok(issue);
    assert.equal(issue?.severity, "optional");
    assert.equal(status.canConfirm, true);
  });

  it("적용한 레퍼런스가 하나라도 있으면 이슈가 사라진다", () => {
    const analysis = makeAnalysis();
    let refs = makeReferences({ bySectionId: fullyDecidedBySectionId });
    const basis = computeAdoptionBasisHash(analysis, refs);
    refs = setAdoption(
      refs,
      { pageId: "p1", sectionId: "p1-hero", collected, status: "applied", basedOnHash: basis },
      fixedNow,
    );
    const status = evaluateReviewStatus(analysis, refs);
    assert.equal(status.issues.some((i) => i.id === "no-adoptions-used"), false);
  });

  it("채택한 분석 대상 브랜드가 없으면 optional 이슈를 내지만 canConfirm은 유지된다", () => {
    const analysis = makeAnalysis();
    const refs = makeReferences({ bySectionId: fullyDecidedBySectionId });
    const status = evaluateReviewStatus(analysis, refs);
    const issue = status.issues.find((i) => i.id === "no-brand-targets-adopted");
    assert.ok(issue);
    assert.equal(issue?.severity, "optional");
    assert.equal(status.canConfirm, true);
  });
});

describe("evaluateReviewStatus — Review 판정과 실제 확정 일치", () => {
  it("canConfirm=true인 상태는 buildConfirmedBrief가 실제로도 성공한다", () => {
    const analysis = makeAnalysis();
    const refs = makeReferences({ bySectionId: fullyDecidedBySectionId });
    const status = evaluateReviewStatus(analysis, refs);
    assert.equal(status.canConfirm, true);
    assert.doesNotThrow(() => buildConfirmedBrief(analysis, refs, { now: fixedNow }));
  });
});
