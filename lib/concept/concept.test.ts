import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeAnalysis } from "../analysis/normalize";
import { normalizeConcept } from "./normalize";
import type { PaletteOption } from "../reference/types";

const analysis = normalizeAnalysis({
  title: "[고객사A] 리뉴얼",
  domain: "marketing-web",
  pages: [
    {
      pageTitle: "표지",
      pageRole: "cover",
      sections: [{ sectionTitle: "표지", contentType: "hero", recommendedLayout: "hero", contentSummary: "표지" }],
    },
    {
      pageTitle: "메인",
      pageRole: "content",
      sections: [
        { sectionTitle: "히어로", contentType: "hero", recommendedLayout: "hero", contentSummary: "[고객사A] 소개" },
        { sectionTitle: "지표", contentType: "metrics", recommendedLayout: "stat-band", contentSummary: "핵심 지표" },
      ],
    },
    {
      pageTitle: "문의",
      pageRole: "contact",
      sections: [{ sectionTitle: "폼", contentType: "contact", recommendedLayout: "split", contentSummary: "문의 폼" }],
    },
  ],
});

const rep = { visualPageId: "p1", contentPageId: "p2" };
const paletteOption: PaletteOption = {
  optionId: "test",
  label: "테스트",
  light: {
    mode: "light",
    primary: "#2563EB",
    secondary: "#64748B",
    accent: "#0EA5E9",
    background: "#FFFFFF",
    surface: "#F7F8FA",
    text: "#1C1F24",
    navigation: "#FFFFFF",
  },
  dark: {
    mode: "dark",
    primary: "#60A5FA",
    secondary: "#94A3B8",
    accent: "#38BDF8",
    background: "#0F172A",
    surface: "#172033",
    text: "#E8EAED",
    navigation: "#111827",
  },
};
const designInput = {
  paletteOption,
  moodKeywords: ["신뢰감 있는", "정돈된"],
  typographyDirection: "중립 산세리프",
};

describe("Step 12-a — normalizeConcept (SSoT 정규화)", () => {
  it("sectionId 계보가 유지되고 위조 ID는 걸러진다", () => {
    const c = normalizeConcept(
      {
        options: [
          {
            optionId: "opt-1",
            label: "A안",
            conceptKeywords: [{ no: "01", title: "사용성", category: "UX", description: "d" }],
            uiStructure: { mode: "dark", navPosition: "left", infoStructure: "i", layoutConcept: "l" },
            keyVisual: { imageTone: "t", illustrationStyle: "3D", backgroundPattern: "b", decorativeElements: "d" },
            pages: [
              {
                pageId: "p2",
                pageTitle: "메인",
                sections: [
                  { sectionId: "p2-s1", sectionTitle: "히어로", contentType: "hero", layoutPattern: "hero", contentMapping: { maskedContent: "[고객사A] 카피", sourceSectionId: "p2-s1", targetArea: "hero-title" } },
                  { sectionId: "fake-id", sectionTitle: "위조", contentType: "x", layoutPattern: "x", contentMapping: { maskedContent: "", sourceSectionId: "", targetArea: "" } },
                ],
              },
              { pageId: "fake-page", pageTitle: "위조 페이지", sections: [] },
            ],
          },
        ],
      },
      analysis,
      rep,
      designInput,
    );
    const page = c.options[0].pages[0];
    assert.equal(c.options[0].pages.length, 1); // 위조 페이지 제거
    assert.equal(page.sections.length, 1); // 위조 섹션 제거
    assert.equal(page.sections[0].sectionId, "p2-s1"); // 계보 유지
    assert.equal(page.sections[0].contentMapping.maskedContent, "[고객사A] 카피"); // 마스킹본 유지
  });

  it("outputSelection: 대표 2종 분리 + 나머지는 서브 후보", () => {
    const c = normalizeConcept({ options: [] }, analysis, rep, designInput);
    assert.equal(c.outputSelection.visualRepresentativePageId, "p1");
    assert.equal(c.outputSelection.contentRepresentativePageId, "p2");
    assert.deepEqual(c.outputSelection.includedSubPageIds, ["p3"]);
    assert.equal(c.outputSelection.outputPreset, "proposal");
  });

  it("platforms: 웹+모바일 세트가 정규화되고 위조 ID는 걸러진다 (실사용#25)", () => {
    const pageSet = (masked: string) => [
      {
        pageId: "p2",
        pageTitle: "메인",
        sections: [
          { sectionId: "p2-s1", sectionTitle: "히어로", contentType: "hero", layoutPattern: "hero", contentMapping: { maskedContent: masked, sourceSectionId: "p2-s1", targetArea: "hero-title" } },
        ],
      },
    ];
    const c = normalizeConcept(
      {
        options: [
          {
            optionId: "opt-1",
            label: "A안",
            pages: pageSet("웹 카피"),
            platforms: {
              web: pageSet("웹 카피"),
              mobile: [
                ...pageSet("모바일 축약 카피"),
                { pageId: "fake-page", pageTitle: "위조", sections: [] },
              ],
            },
          },
        ],
      },
      analysis,
      rep,
      designInput,
    );
    const opt = c.options[0];
    assert.ok(opt.platforms);
    assert.equal(opt.platforms!.web!.length, 1);
    assert.equal(opt.platforms!.mobile!.length, 1); // 위조 페이지 제거
    assert.equal(
      opt.platforms!.mobile![0].sections[0].contentMapping.maskedContent,
      "모바일 축약 카피",
    );
  });

  it("platforms: 미지정(웹 단일)이면 필드 자체가 없다", () => {
    const c = normalizeConcept(
      { options: [{ optionId: "opt-1", label: "A안", pages: [] }] },
      analysis,
      rep,
      designInput,
    );
    assert.equal(c.options[0].platforms, undefined);
  });

  it("mode/navPosition enum이 보정된다", () => {
    const c = normalizeConcept(
      {
        options: [
          {
            uiStructure: { mode: "이상한값", navPosition: "이상한값" },
            pages: [],
          },
        ],
      },
      analysis,
      rep,
      designInput,
    );
    assert.equal(c.options[0].uiStructure.mode, "light");
    assert.equal(c.options[0].uiStructure.navPosition, "top");
  });

  it("designBasis는 옵션 mode에 맞는 확정 팔레트와 무드·타이포 방향을 스냅샷한다", () => {
    const c = normalizeConcept(
      {
        options: [
          {
            optionId: "dark",
            uiStructure: { mode: "dark" },
            pages: [],
          },
        ],
      },
      analysis,
      rep,
      designInput,
    );
    assert.equal(c.options[0].designBasis.palette.mode, "dark");
    assert.equal(c.options[0].designBasis.palette.background, "#0F172A");
    assert.deepEqual(c.options[0].designBasis.moodKeywords, [
      "신뢰감 있는",
      "정돈된",
    ]);
    assert.equal(c.options[0].designBasis.typographyDirection, "중립 산세리프");
  });
});
