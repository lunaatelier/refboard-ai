import type { ConceptJson, ConceptOption, ConceptPage } from "../concept/types";
import { presetIncludes, type RenderConfig, type TextTransform } from "./output";

// PDF 렌더러 (Step 12-b) — 인쇄 최적화 HTML을 만들어 브라우저 인쇄(PDF 저장)로 출력.
// jsPDF 한글 폰트 임베딩(수 MB)을 피하는 클라이언트 렌더링 경로. 서버 렌더 없음 (CLAUDE.md §4.5).
// isomorphic 순수 함수 — 테스트 가능.

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function pageBlock(
  page: ConceptPage,
  t: TextTransform,
  full: boolean,
): string {
  const sections = page.sections
    .map((s) =>
      full
        ? `<div class="sec">
             <div class="sec-head">${esc(s.sectionTitle)} <span class="meta">${esc(s.layoutPattern)} · ${esc(s.contentMapping.targetArea)}</span></div>
             <p>${esc(t(s.contentMapping.maskedContent))}</p>
           </div>`
        : `<li>${esc(s.sectionTitle)} <span class="meta">${esc(s.layoutPattern)}</span></li>`,
    )
    .join("");
  return `<div class="page-block">
    <h4>${esc(page.pageTitle)}</h4>
    ${full ? sections : `<ul>${sections}</ul>`}
  </div>`;
}

function optionBlock(
  o: ConceptOption,
  concept: ConceptJson,
  cfg: RenderConfig,
  t: TextTransform,
): string {
  const inc = presetIncludes(cfg.preset);
  const contentPage = o.pages.find((p) => p.pageId === cfg.contentPageId);
  const visualPage = o.pages.find((p) => p.pageId === cfg.visualPageId);
  const subPages = o.pages.filter((p) =>
    cfg.includedSubPageIds.includes(p.pageId),
  );

  const axes = o.conceptKeywords
    .map(
      (a) => `<div class="axis">
        <div class="axis-no">${esc(a.no)}</div>
        <div><b>${esc(a.title)}</b><div class="meta">${esc(a.category)}</div><p>${esc(a.description)}</p></div>
      </div>`,
    )
    .join("");

  return `<section class="option">
    <h2>${esc(o.label)}${o.basedOnVariantLabel ? ` <span class="meta">(문서 시안 ${esc(o.basedOnVariantLabel)} 기반)</span>` : ""}</h2>
    <div class="axes">${axes}</div>
    <table class="kv">
      <tr><th>UI 방향</th><td>${esc(o.uiStructure.mode === "dark" ? "다크" : "라이트")} · GNB ${esc(o.uiStructure.navPosition === "left" ? "좌측" : "상단")} · ${esc(o.uiStructure.infoStructure)}</td></tr>
      <tr><th>레이아웃</th><td>${esc(o.uiStructure.layoutConcept)}</td></tr>
      <tr><th>키비주얼</th><td>${esc(o.keyVisual.imageTone)} · ${esc(o.keyVisual.illustrationStyle)} · 배경 ${esc(o.keyVisual.backgroundPattern)} · 장식 ${esc(o.keyVisual.decorativeElements)}</td></tr>
    </table>
    ${inc.subPages && visualPage ? `<h3>표지 (시각 대표)</h3>${pageBlock(visualPage, t, inc.sectionMapping)}` : ""}
    ${contentPage ? `<h3>내용 대표</h3>${pageBlock(contentPage, t, true)}` : ""}
    ${inc.subPages && subPages.length > 0 ? `<h3>서브 페이지</h3>${subPages.map((p) => pageBlock(p, t, inc.sectionMapping)).join("")}` : ""}
  </section>`;
}

export function buildConceptPrintHtml(
  concept: ConceptJson,
  cfg: RenderConfig,
  t: TextTransform,
): string {
  const inc = presetIncludes(cfg.preset);
  const hints =
    inc.imageHints && cfg.imageHints && cfg.imageHints.length > 0
      ? `<section class="option"><h2>이미지 힌트</h2>${cfg.imageHints
          .map(
            (h) =>
              `<div class="sec"><div class="sec-head">${esc(h.area)} <span class="meta">${esc(h.scale)} · ${esc(h.direction)}${h.aspectRatio ? ` · ${esc(h.aspectRatio)}` : ""}</span></div><p class="mono">${esc(h.prompt)}</p></div>`,
          )
          .join("")}</section>`
      : "";

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<title>${esc(t(concept.projectTitle))} — 디자인 컨셉 3안</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: "Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif; color: #1c1f24; line-height: 1.6; padding: 40px; font-size: 14px; }
  .cover { text-align: center; padding: 120px 0; page-break-after: always; }
  .cover h1 { font-size: 30px; margin-bottom: 12px; }
  .meta { color: #6b7280; font-size: 12px; font-weight: 400; }
  .option { page-break-before: always; padding-top: 24px; }
  .option:first-of-type { page-break-before: auto; }
  h2 { font-size: 20px; margin-bottom: 14px; border-bottom: 2px solid #2563eb; padding-bottom: 6px; }
  h3 { font-size: 15px; margin: 18px 0 8px; color: #2563eb; }
  h4 { font-size: 14px; margin: 10px 0 6px; }
  .axes { display: flex; gap: 14px; margin-bottom: 14px; }
  .axis { flex: 1; display: flex; gap: 10px; background: #f7f8fa; border-radius: 8px; padding: 12px; }
  .axis-no { font-size: 20px; font-weight: 800; color: #2563eb; }
  .kv { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .kv th { text-align: left; width: 90px; color: #6b7280; font-weight: 600; padding: 4px 8px 4px 0; vertical-align: top; }
  .kv td { padding: 4px 0; }
  .page-block { border: 1px solid #e3e6ea; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; }
  .sec { margin: 8px 0; }
  .sec-head { font-weight: 700; }
  .mono { font-family: monospace; background: #f7f8fa; padding: 6px 10px; border-radius: 6px; }
  ul { padding-left: 20px; }
  @page { margin: 18mm; }
</style></head><body>
<div class="cover">
  <h1>${esc(t(concept.projectTitle))}</h1>
  <p>디자인 컨셉 제안 — 3안</p>
  <p class="meta">${new Date().toISOString().slice(0, 10)}</p>
</div>
${concept.options.map((o) => optionBlock(o, concept, cfg, t)).join("")}
${hints}
</body></html>`;
}
