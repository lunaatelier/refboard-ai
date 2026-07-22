import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { confirmSelectedSections } from "../analysis/confirm";
import { normalizeAnalysis } from "../analysis/normalize";
import {
  buildHintSkeletons,
  canGenerateImageHints,
  decideDirection,
  defaultImageNeed,
  recommendRepresentativePages,
  representativePageReason,
} from "./imageHints";
import { sectionKey } from "./sectionPriority";
import type { DirectionOption, MoodOption, PaletteOption, ReferenceResult } from "./types";

const mood = (label: string, keywords: string[]): MoodOption => ({
  id: "m",
  label,
  keywords,
  description: "",
  imageQuery: "",
  paletteOptionId: "p",
  typography: {
    title: { sampleText: "", note: "" },
    body: { sampleText: "", note: "" },
  },
  styleAttributes: {
    radius: "soft",
    density: "airy",
    contrast: "soft",
    typographyNote: "",
  },
  recommendedDirections: [],
  avoidDirections: [],
});

const rawDocAnalysis = normalizeAnalysis({
  title: "[고객사A] 회사소개서",
  domain: "document",
  pages: [
    {
      pageTitle: "표지",
      pageRole: "cover",
      sections: [{ sectionTitle: "표지", contentType: "hero", recommendedLayout: "hero", contentSummary: "표지" }],
    },
    {
      pageTitle: "ESG 사업영역",
      pageRole: "content",
      sections: [
        { sectionTitle: "사업영역", contentType: "feature", recommendedLayout: "card-grid", contentSummary: "3개 사업" },
        { sectionTitle: "비전", contentType: "vision", recommendedLayout: "hero", contentSummary: "비전" },
      ],
    },
    {
      pageTitle: "성과 지표",
      pageRole: "metrics",
      sections: [{ sectionTitle: "지표", contentType: "metrics", recommendedLayout: "stat-band", contentSummary: "지표" }],
    },
  ],
});
// buildHintSkeletons/canGenerateImageHints는 확정된 섹션만 본다 — 이 fixture는
// 전부 선택 페이지이므로 confirmSelectedSections를 거쳐야 status가 "confirmed"가 된다.
const docAnalysis = confirmSelectedSections(rawDocAnalysis);

describe("Step 11 — 방향 판정 (도메인+무드)", () => {
  it("혁신 무드 → 3D 렌더", () => {
    assert.equal(
      decideDirection("marketing-web", [], mood("그린 이노베이션", ["혁신적인", "미래지향적인"])),
      "3D 렌더",
    );
  });
  it("미니멀 무드 → 라인 일러스트", () => {
    assert.equal(
      decideDirection("marketing-web", [], mood("미니멀", ["절제된", "여백"])),
      "라인 일러스트",
    );
  });
  it("B2B 태그 → 미니멀 3D", () => {
    assert.equal(decideDirection("marketing-web", ["B2B", "친환경"]), "미니멀 3D");
  });
});

describe("P7 — 새 이미지 필요 기본값 (contentType 휴리스틱)", () => {
  it("hero/case-study/vision 등은 기본 true, 그 외 content는 false", () => {
    assert.equal(defaultImageNeed("hero"), true);
    assert.equal(defaultImageNeed("vision"), true);
    assert.equal(defaultImageNeed("feature"), true); // icon 타입도 기본 true
    assert.equal(defaultImageNeed("metrics"), false);
    assert.equal(defaultImageNeed("content"), false);
  });
});

describe("P7 — 힌트 스켈레톤은 확정+필요 섹션에서만 생성된다", () => {
  it("표지=hero, 비전 섹션=section, 사업영역 카드=icon — 무조건 표지 항목은 더 이상 없다", () => {
    const sk = buildHintSkeletons(docAnalysis, {});
    const cover = sk.find((s) => s.scale === "hero");
    assert.ok(cover);
    assert.equal(cover?.aspectRatio, "16:9");
    const vision = sk.find((s) => s.area.includes("비전"));
    assert.equal(vision?.scale, "section");
    const feature = sk.find((s) => s.area.includes("사업영역"));
    assert.equal(feature?.scale, "icon");
    assert.equal(feature?.aspectRatio, "1:1");
    // 지표 섹션(metrics)은 기본 false라 스켈레톤에 없다.
    assert.ok(!sk.some((s) => s.area.includes("지표")));
  });

  it("사용자가 지표 섹션을 켜면(imageNeedByKey=true) 스켈레톤에 포함된다", () => {
    const metricsPage = docAnalysis.pages.find((p) => p.pageTitle === "성과 지표")!;
    const metricsSection = metricsPage.sections[0];
    const key = sectionKey(metricsPage.pageId, metricsSection.sectionId);
    const sk = buildHintSkeletons(docAnalysis, { imageNeedByKey: { [key]: true } });
    assert.ok(sk.some((s) => s.key === key));
  });

  it("사용자가 표지(hero)를 꺼면(imageNeedByKey=false) 스켈레톤에서 빠진다", () => {
    const coverPage = docAnalysis.pages.find((p) => p.pageTitle === "표지")!;
    const coverSection = coverPage.sections[0];
    const key = sectionKey(coverPage.pageId, coverSection.sectionId);
    const sk = buildHintSkeletons(docAnalysis, { imageNeedByKey: { [key]: false } });
    assert.ok(!sk.some((s) => s.key === key));
    // 휴리스틱 기본값은 true이므로, 명시적 false만 이걸 뒤집는다는 걸 함께 확인.
    assert.equal(defaultImageNeed(coverSection.contentType), true);
  });

  it("확정되지 않은(candidate) 섹션은 필요로 켜도 스켈레톤에 포함되지 않는다", () => {
    const unconfirmed = confirmSelectedSections(rawDocAnalysis);
    unconfirmed.pages[0].sections[0].status = "candidate";
    const key = sectionKey(unconfirmed.pages[0].pageId, unconfirmed.pages[0].sections[0].sectionId);
    const sk = buildHintSkeletons(unconfirmed, { imageNeedByKey: { [key]: true } });
    assert.ok(!sk.some((s) => s.key === key));
  });
});

describe("Step 11 — 대표 페이지 추천 (표지 ≠ 대표)", () => {
  it("문서형: 시각 대표=cover, 내용 대표=metrics (cover 아님)", () => {
    const rep = recommendRepresentativePages(docAnalysis);
    const visual = docAnalysis.pages.find((p) => p.pageId === rep.visualPageId);
    const content = docAnalysis.pages.find((p) => p.pageId === rep.contentPageId);
    assert.equal(visual?.pageRole, "cover");
    assert.equal(content?.pageRole, "metrics");
    assert.notEqual(rep.visualPageId, rep.contentPageId);
  });

  it("cover가 없으면 첫 페이지가 시각 대표", () => {
    const a = normalizeAnalysis({
      domain: "marketing-web",
      pages: [
        { pageTitle: "메인", pageRole: "content", sections: [] },
        { pageTitle: "소개", pageRole: "content", sections: [{}, {}] },
      ],
    });
    const rep = recommendRepresentativePages(a);
    assert.equal(rep.visualPageId, "p1");
    assert.equal(rep.contentPageId, "p1");
  });
});

describe("P7 — 대표 페이지 추천 이유 (저장하지 않고 매번 계산)", () => {
  it("추천값 그대로면 근거 문구, 사용자가 바꾸면 '직접 지정'", () => {
    const recommended = recommendRepresentativePages(docAnalysis);
    const recommendedReason = representativePageReason(docAnalysis, recommended);
    assert.equal(recommendedReason.visualReason, "표지 역할 페이지라 첫인상 대표로 추천");
    assert.notEqual(recommendedReason.contentReason, "사용자가 직접 지정");

    const overridden = representativePageReason(docAnalysis, {
      visualPageId: recommended.contentPageId,
      contentPageId: recommended.contentPageId,
    });
    assert.equal(overridden.visualReason, "사용자가 직접 지정");
  });
});

describe("P7 — 이미지 힌트 생성 게이팅", () => {
  const palette: PaletteOption = {
    optionId: "po1",
    label: "기본",
    light: {
      mode: "light",
      primary: "#000",
      secondary: "#111",
      accent: "#222",
      background: "#fff",
      surface: "#f5f5f5",
      text: "#000",
      navigation: "#000",
    },
    dark: {
      mode: "dark",
      primary: "#fff",
      secondary: "#eee",
      accent: "#ddd",
      background: "#000",
      surface: "#111",
      text: "#fff",
      navigation: "#fff",
    },
  };
  const direction: DirectionOption = {
    directionId: "d1",
    label: "방향 1",
    description: "설명",
    moodOptionId: "m1",
    paletteOptionId: "po1",
    keywords: ["a"],
    typography: {
      title: { sampleText: "", note: "" },
      body: { sampleText: "", note: "" },
    },
    styleAttributes: { radius: "soft", density: "airy", contrast: "soft" },
    imageCandidates: [],
    recommendedDirections: [],
    avoidDirections: [],
  };
  const moodOption = mood("m", ["a"]);
  moodOption.id = "m1";

  const baseRefs: ReferenceResult = {
    directionOptions: [direction],
    selectedDirectionId: "d1",
    moodOptions: [moodOption],
    editedPaletteOption: palette,
  };

  it("방향 미확정이면 차단", () => {
    const g = canGenerateImageHints(docAnalysis, {});
    assert.equal(g.ok, false);
  });

  it("팔레트 미확정이면 차단", () => {
    const g = canGenerateImageHints(docAnalysis, { ...baseRefs, editedPaletteOption: undefined });
    assert.equal(g.ok, false);
  });

  it("필요 섹션이 하나도 없으면 차단", () => {
    const noNeed: ReferenceResult = {
      ...baseRefs,
      imageNeedByKey: Object.fromEntries(
        docAnalysis.pages.flatMap((p) => p.sections.map((s) => [sectionKey(p.pageId, s.sectionId), false])),
      ),
    };
    const g = canGenerateImageHints(docAnalysis, noNeed);
    assert.equal(g.ok, false);
  });

  it("방향+팔레트 확정 + 필요 섹션 1개 이상이면 통과", () => {
    const g = canGenerateImageHints(docAnalysis, baseRefs);
    assert.equal(g.ok, true);
  });
});
