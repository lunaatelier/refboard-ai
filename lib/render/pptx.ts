import pptxgen from "pptxgenjs";
import type { ConceptJson, ConceptOption, ConceptPage } from "../concept/types";
import type { Palette } from "../reference/types";
import { presetIncludes, type RenderConfig, type TextTransform } from "./output";

// PPT 렌더러 (Step 12-b) — pptxgenjs, 클라이언트 렌더링 (서버 렌더 없음, CLAUDE.md §4.5).
// 기본은 마스킹본. 실명본은 transform(restore)이 클라이언트 메모리에서만 적용된다.

const W = 10; // 인치 (16:9 기본 13.3x7.5 대신 LAYOUT_16x9 = 10x5.625)

function addPageSlide(
  pptx: pptxgen,
  page: ConceptPage,
  heading: string,
  t: TextTransform,
  full: boolean,
  colors: { primary: string; text: string; muted: string },
) {
  const slide = pptx.addSlide();
  slide.addText(heading, {
    x: 0.5, y: 0.3, w: W - 1, h: 0.4, fontSize: 12, color: colors.muted,
  });
  slide.addText(page.pageTitle, {
    x: 0.5, y: 0.65, w: W - 1, h: 0.5, fontSize: 22, bold: true, color: colors.text,
  });
  const rows: [string, string][] = page.sections.map((s) => [
    `${s.sectionTitle}  (${s.layoutPattern} · ${s.contentMapping.targetArea})`,
    full ? t(s.contentMapping.maskedContent) : "",
  ]);
  let y = 1.3;
  for (const [head, body] of rows.slice(0, 6)) {
    slide.addText(head, {
      x: 0.5, y, w: W - 1, h: 0.35, fontSize: 13, bold: true, color: colors.primary,
    });
    y += 0.38;
    if (body) {
      slide.addText(body, {
        x: 0.7, y, w: W - 1.2, h: 0.6, fontSize: 11, color: colors.text, valign: "top",
      });
      y += 0.65;
    }
  }
}

function addOptionSlides(
  pptx: pptxgen,
  o: ConceptOption,
  cfg: RenderConfig,
  t: TextTransform,
  colors: { primary: string; text: string; muted: string },
) {
  const inc = presetIncludes(cfg.preset);

  // 컨셉 축 슬라이드
  const slide = pptx.addSlide();
  slide.addText(o.label + (o.basedOnVariantLabel ? `  (문서 시안 ${o.basedOnVariantLabel} 기반)` : ""), {
    x: 0.5, y: 0.4, w: W - 1, h: 0.6, fontSize: 24, bold: true, color: colors.text,
  });
  o.conceptKeywords.forEach((a, i) => {
    const x = 0.5 + i * ((W - 1) / 3);
    slide.addText(a.no, { x, y: 1.2, w: 0.8, h: 0.5, fontSize: 26, bold: true, color: colors.primary });
    slide.addText(a.title, { x, y: 1.7, w: (W - 1) / 3 - 0.2, h: 0.4, fontSize: 14, bold: true, color: colors.text });
    slide.addText(a.category, { x, y: 2.1, w: (W - 1) / 3 - 0.2, h: 0.3, fontSize: 10, color: colors.muted });
    slide.addText(a.description, { x, y: 2.45, w: (W - 1) / 3 - 0.2, h: 1.4, fontSize: 11, color: colors.text, valign: "top" });
  });
  slide.addText(
    [
      `UI: ${o.uiStructure.mode === "dark" ? "다크" : "라이트"} · GNB ${o.uiStructure.navPosition === "left" ? "좌측" : "상단"} · ${o.uiStructure.infoStructure}`,
      `레이아웃: ${o.uiStructure.layoutConcept}`,
      `키비주얼: ${o.keyVisual.imageTone} · ${o.keyVisual.illustrationStyle} · ${o.keyVisual.backgroundPattern}`,
    ].join("\n"),
    { x: 0.5, y: 4.1, w: W - 1, h: 1.2, fontSize: 11, color: colors.muted, valign: "top" },
  );

  // 표지(시각 대표) — 제안형 이상
  const visualPage = o.pages.find((p) => p.pageId === cfg.visualPageId);
  if (inc.subPages && visualPage) {
    addPageSlide(pptx, visualPage, `${o.label} — 표지(시각 대표)`, t, inc.sectionMapping, colors);
  }
  // 내용 대표 — 항상
  const contentPage = o.pages.find((p) => p.pageId === cfg.contentPageId);
  if (contentPage) {
    addPageSlide(pptx, contentPage, `${o.label} — 내용 대표`, t, true, colors);
  }
  // 서브 — 제안형 이상, 선택한 것만
  if (inc.subPages) {
    for (const p of o.pages.filter((p) => cfg.includedSubPageIds.includes(p.pageId))) {
      addPageSlide(pptx, p, `${o.label} — 서브`, t, inc.sectionMapping, colors);
    }
  }
}

export function buildConceptPptx(
  concept: ConceptJson,
  cfg: RenderConfig,
  t: TextTransform,
  palette?: Palette,
): pptxgen {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: "WIDE", width: W, height: 5.625 });
  pptx.layout = "WIDE";

  const colors = {
    primary: (palette?.primary ?? "#2563EB").replace("#", ""),
    text: "1C1F24",
    muted: "6B7280",
  };

  // 표지
  const cover = pptx.addSlide();
  cover.background = { color: colors.primary };
  cover.addText(t(concept.projectTitle), {
    x: 0.5, y: 1.8, w: W - 1, h: 0.9, fontSize: 30, bold: true, color: "FFFFFF", align: "center",
  });
  cover.addText("디자인 컨셉 제안 — 3안", {
    x: 0.5, y: 2.8, w: W - 1, h: 0.5, fontSize: 16, color: "FFFFFF", align: "center",
  });
  cover.addText(new Date().toISOString().slice(0, 10), {
    x: 0.5, y: 3.4, w: W - 1, h: 0.4, fontSize: 12, color: "FFFFFF", align: "center",
  });

  for (const o of concept.options) {
    addOptionSlides(pptx, o, cfg, t, colors);
  }

  // 이미지 힌트 — 상세형만
  const inc = presetIncludes(cfg.preset);
  if (inc.imageHints && cfg.imageHints && cfg.imageHints.length > 0) {
    const slide = pptx.addSlide();
    slide.addText("이미지 힌트", { x: 0.5, y: 0.4, w: W - 1, h: 0.5, fontSize: 22, bold: true, color: colors.text });
    let y = 1.1;
    for (const h of cfg.imageHints.slice(0, 6)) {
      slide.addText(`${h.area} — ${h.scale} · ${h.direction}`, { x: 0.5, y, w: W - 1, h: 0.3, fontSize: 12, bold: true, color: colors.primary });
      y += 0.32;
      slide.addText(h.prompt, { x: 0.7, y, w: W - 1.2, h: 0.4, fontSize: 10, color: colors.muted });
      y += 0.45;
    }
  }

  return pptx;
}
