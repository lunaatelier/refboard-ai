import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConceptJson } from "../concept/types";
import { identityTransform, presetIncludes, type RenderConfig } from "./output";
import { buildConceptPptx } from "./pptx";
import { buildConceptPrintHtml } from "./printHtml";

const concept: ConceptJson = {
  projectTitle: "[고객사A] 리뉴얼",
  options: [
    {
      optionId: "opt-1",
      label: "A안 — 신뢰의 블루",
      basedOnVariantLabel: "Main1",
      conceptKeywords: [
        { no: "01", title: "사용성", category: "UX", description: "설명" },
      ],
      uiStructure: { mode: "light", navPosition: "top", infoStructure: "구조", layoutConcept: "레이아웃" },
      keyVisual: { imageTone: "톤", illustrationStyle: "3D", backgroundPattern: "패턴", decorativeElements: "장식" },
      pages: [
        {
          pageId: "p1",
          pageTitle: "표지",
          sections: [
            { sectionId: "p1-s1", sectionTitle: "표지", contentType: "hero", layoutPattern: "hero", contentMapping: { maskedContent: "[고객사A] 소개", sourceSectionId: "p1-s1", targetArea: "hero-title" } },
          ],
        },
        {
          pageId: "p2",
          pageTitle: "메인",
          sections: [
            { sectionId: "p2-s1", sectionTitle: "히어로", contentType: "hero", layoutPattern: "hero", contentMapping: { maskedContent: "[고객사A] 카피", sourceSectionId: "p2-s1", targetArea: "hero-title" } },
          ],
        },
        {
          pageId: "p3",
          pageTitle: "문의",
          sections: [
            { sectionId: "p3-s1", sectionTitle: "폼", contentType: "contact", layoutPattern: "split", contentMapping: { maskedContent: "문의 [전화A]", sourceSectionId: "p3-s1", targetArea: "form" } },
          ],
        },
      ],
    },
  ],
  outputSelection: {
    visualRepresentativePageId: "p1",
    contentRepresentativePageId: "p2",
    includedSubPageIds: ["p3"],
    outputPreset: "proposal",
  },
};

const cfg = (preset: RenderConfig["preset"]): RenderConfig => ({
  preset,
  visualPageId: "p1",
  contentPageId: "p2",
  includedSubPageIds: ["p3"],
  imageHints: [
    { area: "표지", scale: "hero", prompt: "eco hero prompt", direction: "3D", sourceReferenceMode: "use-source-image" },
  ],
});

describe("Step 12-b — 프리셋 게이팅", () => {
  it("summary는 서브·매핑·힌트 제외, detailed는 전부 포함", () => {
    assert.deepEqual(presetIncludes("summary"), { subPages: false, sectionMapping: false, imageHints: false });
    assert.deepEqual(presetIncludes("detailed"), { subPages: true, sectionMapping: true, imageHints: true });
  });

  it("printHtml: summary에는 서브 페이지(문의)가 없다", () => {
    const html = buildConceptPrintHtml(concept, cfg("summary"), identityTransform);
    assert.ok(html.includes("메인")); // 내용 대표는 항상
    assert.ok(!html.includes("문의")); // 서브 제외
    assert.ok(!html.includes("eco hero prompt")); // 힌트 제외
  });

  it("printHtml: detailed에는 서브+이미지 힌트 포함", () => {
    const html = buildConceptPrintHtml(concept, cfg("detailed"), identityTransform);
    assert.ok(html.includes("문의"));
    assert.ok(html.includes("eco hero prompt"));
    assert.ok(html.includes("Main1")); // 변형 기반 표기
  });
});

describe("Step 12-b — 마스킹본/실명본", () => {
  it("기본(마스킹본)은 토큰 유지, 실명본 transform은 렌더 시점에만 복원", () => {
    const masked = buildConceptPrintHtml(concept, cfg("proposal"), identityTransform);
    assert.ok(masked.includes("[고객사A]"));
    assert.ok(!masked.includes("가상그린"));

    const restoredHtml = buildConceptPrintHtml(concept, cfg("proposal"), (t) =>
      t.split("[고객사A]").join("가상그린"),
    );
    assert.ok(restoredHtml.includes("가상그린"));
    assert.ok(!restoredHtml.includes("[고객사A]"));
    // 원본(SSoT)은 그대로 마스킹본 — 렌더가 원본을 오염시키지 않음
    assert.equal(
      concept.options[0].pages[1].sections[0].contentMapping.maskedContent,
      "[고객사A] 카피",
    );
  });
});

describe("Step 12 — platforms(웹+모바일) 렌더", () => {
  const withPlatforms: ConceptJson = {
    ...concept,
    options: [
      {
        ...concept.options[0],
        platforms: {
          web: concept.options[0].pages,
          mobile: [
            {
              pageId: "p2",
              pageTitle: "메인",
              sections: [
                { sectionId: "p2-s1", sectionTitle: "히어로", contentType: "hero", layoutPattern: "single-column", contentMapping: { maskedContent: "모바일 축약 카피", sourceSectionId: "p2-s1", targetArea: "hero-title" } },
              ],
            },
          ],
        },
      },
    ],
  };

  it("printHtml: 웹/모바일 세트가 각각 라벨과 함께 출력된다", () => {
    const html = buildConceptPrintHtml(withPlatforms, cfg("proposal"), identityTransform);
    assert.ok(html.includes("웹 — 내용 대표"));
    assert.ok(html.includes("모바일 — 내용 대표"));
    assert.ok(html.includes("모바일 축약 카피"));
  });

  it("printHtml: platforms 없으면 기존과 동일 (라벨 접두어 없음)", () => {
    const html = buildConceptPrintHtml(concept, cfg("proposal"), identityTransform);
    assert.ok(html.includes("<h3>내용 대표</h3>"));
    assert.ok(!html.includes("웹 — "));
  });

  it("pptx: platforms 있는 컨셉도 유효한 버퍼가 생성된다", async () => {
    const pptx = buildConceptPptx(withPlatforms, cfg("proposal"), identityTransform);
    const buf = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
    assert.equal(buf[0], 0x50);
    assert.equal(buf[1], 0x4b);
  });
});

describe("Step 12-b — PPT 스모크", () => {
  it("pptxgenjs로 유효한 파일 버퍼가 생성된다", async () => {
    const pptx = buildConceptPptx(concept, cfg("detailed"), identityTransform);
    const buf = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
    assert.ok(buf.length > 10_000); // zip 컨테이너 최소 크기
    assert.equal(buf[0], 0x50); // 'P' — zip(pptx) 시그니처 PK
    assert.equal(buf[1], 0x4b);
  });
});
