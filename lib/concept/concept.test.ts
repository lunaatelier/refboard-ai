import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeAnalysis } from "../analysis/normalize";
import { normalizeConcept } from "./normalize";

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
    );
    const page = c.options[0].pages[0];
    assert.equal(c.options[0].pages.length, 1); // 위조 페이지 제거
    assert.equal(page.sections.length, 1); // 위조 섹션 제거
    assert.equal(page.sections[0].sectionId, "p2-s1"); // 계보 유지
    assert.equal(page.sections[0].contentMapping.maskedContent, "[고객사A] 카피"); // 마스킹본 유지
  });

  it("outputSelection: 대표 2종 분리 + 나머지는 서브 후보", () => {
    const c = normalizeConcept({ options: [] }, analysis, rep);
    assert.equal(c.outputSelection.visualRepresentativePageId, "p1");
    assert.equal(c.outputSelection.contentRepresentativePageId, "p2");
    assert.deepEqual(c.outputSelection.includedSubPageIds, ["p3"]);
    assert.equal(c.outputSelection.outputPreset, "proposal");
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
    );
    assert.equal(c.options[0].uiStructure.mode, "light");
    assert.equal(c.options[0].uiStructure.navPosition, "top");
  });
});
