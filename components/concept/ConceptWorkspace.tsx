"use client";

import { useState } from "react";
import { Check, Download, Printer, Smartphone } from "lucide-react";
import ConceptPreview from "./ConceptPreview";
import type { ProjectAnalysis, ProjectDirective } from "@/lib/analysis/types";
import type { ConceptJson, OutputPreset } from "@/lib/concept/types";
import { recommendRepresentativePages } from "@/lib/reference/imageHints";
import type { ReferenceResult } from "@/lib/reference/types";
import {
  PRESET_LABELS,
  type RenderConfig,
  type TextTransform,
} from "@/lib/render/output";
import { buildConceptPptx } from "@/lib/render/pptx";
import { buildConceptPrintHtml } from "@/lib/render/printHtml";
import PageLayout, { PageCta } from "../shell/PageLayout";

// ⑤ 컨셉 3안 (Step 12-a) — 프로젝트 전체를 관통하는 방향 3가지.
// 페이지마다 3안(=15개)을 만들지 않는다. 대표 페이지로 각 안을 시각화.

interface ConceptWorkspaceProps {
  analysis: ProjectAnalysis;
  directives: ProjectDirective[];
  references: ReferenceResult;
  concept?: ConceptJson;
  onChange: (next: ConceptJson) => void;
  canRestore: boolean; // 복원키가 메모리에 있을 때만 실명본 가능
  makeTransform: (restored: boolean) => TextTransform;
  confirmed: boolean;
  onConfirm: () => void;
}

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-lg)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-md)",
};

export default function ConceptWorkspace({
  analysis,
  directives,
  references,
  concept,
  onChange,
  canRestore,
  makeTransform,
  confirmed,
  onConfirm,
}: ConceptWorkspaceProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const variants = analysis.existingContentVariants ?? [];
  const [useVariants, setUseVariants] = useState(variants.length >= 2);
  const [selectedOptionId, setSelectedOptionId] = useState<string>();
  const [previewPageId, setPreviewPageId] = useState<string>();
  const [previewPlatform, setPreviewPlatform] = useState<"web" | "mobile">("web");

  const representative =
    references.representative ?? recommendRepresentativePages(analysis);

  const generate = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const mood = references.globalMood;
      const adopted = (references.analysisTargetList ?? []).filter(
        (t) => t.adopted,
      );
      const res = await fetch("/api/concept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          analysis,
          directives,
          representative,
          palette:
            references.editedPaletteOption?.[references.paletteMode ?? "light"],
          moodSummary: mood
            ? `${mood.keywords.join(", ")} — ${mood.description}`
            : "",
          layoutBySection: Object.fromEntries(
            Object.entries(references.bySectionId ?? {}).map(([id, r]) => [
              id,
              r.layoutPattern,
            ]),
          ),
          targetImplications: adopted
            .map((t) => references.targetAnalyses?.[t.id])
            .filter(Boolean)
            .map((a) => `${a!.name}: ${a!.implications}`),
          useVariants,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.concept) {
        throw new Error(body?.error ?? "컨셉 생성에 실패했습니다.");
      }
      onChange(body.concept as ConceptJson);
      const first = (body.concept as ConceptJson).options[0];
      setSelectedOptionId(first?.optionId);
      setPreviewPageId(
        (body.concept as ConceptJson).outputSelection
          .contentRepresentativePageId,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "컨셉 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const selected =
    concept?.options.find((o) => o.optionId === selectedOptionId) ??
    concept?.options[0];
  // 웹+모바일 세트가 있으면 토글로 전환, 없으면 pages 단일 세트
  const previewPages =
    (previewPlatform === "mobile"
      ? selected?.platforms?.mobile
      : selected?.platforms?.web) ?? selected?.pages;
  const previewPage =
    previewPages?.find((p) => p.pageId === previewPageId) ??
    previewPages?.find(
      (p) => p.pageId === concept?.outputSelection.contentRepresentativePageId,
    ) ??
    previewPages?.[0];

  return (
    <PageLayout
      title="컨셉 3안"
      description="레퍼런스·무드에서 확정한 팔레트·무드·레이아웃·벤치마킹 시사점을 반영해 전체 방향 3안을 만듭니다. 3안 모두 컨셉서로 내보냅니다 (1안 확정이 아님)."
    >
      <div style={card}>
        {variants.length >= 2 && (
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <input
              type="checkbox"
              checked={useVariants}
              onChange={(e) => setUseVariants(e.target.checked)}
            />
            <span style={{ fontSize: 14 }}>
              문서에 이미 있는 시안 변형 {variants.length}개(
              {variants.map((v) => v.label).join("/")})를 3안의 기반으로 사용
            </span>
          </label>
        )}
        <button
          onClick={generate}
          disabled={busy}
          className="btn-weak-primary"
          style={{
            alignSelf: "flex-start",
            padding: "10px var(--space-base)",
            borderRadius: "var(--radius-md)",
            border: "none",
            background: busy ? "var(--locked)" : undefined,
            color: busy ? "var(--on-primary)" : undefined,
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {busy ? "컨셉 생성 중… (수십 초)" : concept ? "다시 생성" : "컨셉 3안 생성"}
        </button>
        {error && (
          <p role="alert" style={{ color: "var(--error-weak-text)", fontWeight: 600 }}>
            {error}
          </p>
        )}
      </div>

      {concept && (
        <>
          {/* ── 3안 비교 ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--space-md)" }}>
            {concept.options.map((o) => {
              const isSel = selected?.optionId === o.optionId;
              return (
                <button
                  key={o.optionId}
                  onClick={() => setSelectedOptionId(o.optionId)}
                  className="hoverable-card"
                  style={{
                    ...card,
                    borderRadius: "var(--radius-xl)",
                    padding: "var(--space-lg)",
                    textAlign: "left",
                    cursor: "pointer",
                    border: isSel ? "2px solid var(--primary)" : undefined,
                  }}
                >
                  <b style={{ fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    {isSel && <Check size={16} color="var(--primary)" strokeWidth={2.5} />}
                    {o.label}
                  </b>
                  {o.basedOnVariantLabel && (
                    <span style={{ fontSize: 14, color: "var(--warning-weak-text)" }}>
                      문서 시안 {o.basedOnVariantLabel} 기반
                    </span>
                  )}
                  {o.platforms && (
                    <span style={{ fontSize: 14, color: "var(--info)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Smartphone size={14} color="var(--info)" />
                      웹+모바일 별도 세트
                    </span>
                  )}
                  <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                    {o.uiStructure.mode === "dark" ? "다크" : "라이트"} · GNB{" "}
                    {o.uiStructure.navPosition === "left" ? "좌측" : "상단"} ·{" "}
                    {o.keyVisual.illustrationStyle}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {o.conceptKeywords.map((a) => (
                      <div key={a.no}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--primary)" }}>
                          {a.no} {a.title}
                        </span>
                        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                          {a.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── HTML 미리보기 ── */}
          {selected && previewPage && (
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap" }}>
                <h3 style={{ fontSize: 18, fontWeight: 600 }}>미리보기 — {selected.label}</h3>
                {selected.platforms && (
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["web", "mobile"] as const).map((pf) => (
                      <button
                        key={pf}
                        onClick={() => setPreviewPlatform(pf)}
                        disabled={!selected.platforms?.[pf]}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "var(--radius-md)",
                          border: `1px solid ${previewPlatform === pf ? "var(--primary)" : "var(--border)"}`,
                          background:
                            previewPlatform === pf
                              ? "var(--primary-soft)"
                              : "transparent",
                          color: !selected.platforms?.[pf]
                            ? "var(--locked)"
                            : previewPlatform === pf
                              ? "var(--primary)"
                              : "var(--text)",
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        {pf === "web" ? "웹" : "모바일"}
                      </button>
                    ))}
                  </div>
                )}
                <select
                  value={previewPage.pageId}
                  onChange={(e) => setPreviewPageId(e.target.value)}
                  className="select-box"
                >
                  {(previewPages ?? []).map((p) => (
                    <option key={p.pageId} value={p.pageId}>
                      {p.pageTitle}
                      {p.pageId ===
                      concept.outputSelection.visualRepresentativePageId
                        ? " (시각 대표)"
                        : p.pageId ===
                            concept.outputSelection
                              .contentRepresentativePageId
                          ? " (내용 대표)"
                          : ""}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  {selected.uiStructure.infoStructure}
                </span>
              </div>
              <ConceptPreview
                option={selected}
                page={previewPage}
                palette={
                  references.editedPaletteOption?.[selected.uiStructure.mode]
                }
              />
            </div>
          )}

          {/* ── ⑥ 컨셉서 출력 (Step 12-b) ── */}
          <OutputPanel
            analysis={analysis}
            references={references}
            concept={concept}
            onChange={onChange}
            canRestore={canRestore}
            makeTransform={makeTransform}
            confirmed={confirmed}
            onConfirm={onConfirm}
          />
        </>
      )}
    </PageLayout>
  );
}

function OutputPanel({
  analysis,
  references,
  concept,
  onChange,
  canRestore,
  makeTransform,
  confirmed,
  onConfirm,
}: {
  analysis: ProjectAnalysis;
  references: ReferenceResult;
  concept: ConceptJson;
  onChange: (next: ConceptJson) => void;
  canRestore: boolean;
  makeTransform: (restored: boolean) => TextTransform;
  confirmed: boolean;
  onConfirm: () => void;
}) {
  const [downloadError, setDownloadError] = useState<string>();
  const sel = concept.outputSelection;
  const selectedPages = analysis.pages.filter((p) => p.selected);
  const subCandidates = selectedPages.filter(
    (p) =>
      p.pageId !== sel.visualRepresentativePageId &&
      p.pageId !== sel.contentRepresentativePageId,
  );

  const cfg: RenderConfig = {
    preset: sel.outputPreset,
    visualPageId: sel.visualRepresentativePageId,
    contentPageId: sel.contentRepresentativePageId,
    includedSubPageIds: sel.includedSubPageIds,
    imageHints: references.imageHints,
  };

  const setSel = (patch: Partial<typeof sel>) =>
    onChange({ ...concept, outputSelection: { ...sel, ...patch } });

  const downloadPptx = async (restored: boolean) => {
    setDownloadError(undefined);
    try {
      const pptx = buildConceptPptx(
        concept,
        cfg,
        makeTransform(restored),
        references.editedPaletteOption?.[references.paletteMode ?? "light"],
      );
      await pptx.writeFile({
        fileName: restored ? "design-concept-restored.pptx" : "design-concept-masked.pptx",
      });
    } catch {
      setDownloadError("PPT 생성에 실패했습니다.");
    }
  };

  const printPdf = (restored: boolean) => {
    setDownloadError(undefined);
    const html = buildConceptPrintHtml(concept, cfg, makeTransform(restored));
    const win = window.open("", "_blank");
    if (!win) {
      setDownloadError("팝업이 차단되었습니다. 팝업을 허용해 주세요.");
      return;
    }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const btn = (disabled: boolean): React.CSSProperties => ({
    padding: "10px var(--space-base)",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border)",
    fontWeight: 600,
    fontSize: 14,
    color: disabled ? "var(--locked)" : undefined,
    display: "flex",
    alignItems: "center",
    gap: 6,
  });

  return (
    <div style={card}>
      <h3 style={{ fontSize: 18, fontWeight: 600 }}>컨셉서 출력 — 3안 모두 내보내기</h3>

      <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
        {(Object.keys(PRESET_LABELS) as OutputPreset[]).map((p) => (
          <button
            key={p}
            onClick={() => setSel({ outputPreset: p })}
            className="hoverable-card"
            style={{
              flex: 1,
              minWidth: 180,
              textAlign: "left",
              padding: "var(--space-md)",
              borderRadius: "var(--radius-lg)",
              border: sel.outputPreset === p ? "2px solid var(--primary)" : undefined,
              background: sel.outputPreset === p ? "var(--primary-soft)" : "transparent",
            }}
          >
            <b style={{ fontSize: 16, fontWeight: 600 }}>{PRESET_LABELS[p].label}</b>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              {PRESET_LABELS[p].desc}
            </p>
          </button>
        ))}
      </div>

      {sel.outputPreset !== "summary" && subCandidates.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>서브 페이지</span>
          {subCandidates.map((p) => (
            <label key={p.pageId} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={sel.includedSubPageIds.includes(p.pageId)}
                onChange={(e) =>
                  setSel({
                    includedSubPageIds: e.target.checked
                      ? [...sel.includedSubPageIds, p.pageId]
                      : sel.includedSubPageIds.filter((id) => id !== p.pageId),
                  })
                }
              />
              {p.pageTitle}
            </label>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => downloadPptx(false)} className="btn-tertiary" style={btn(false)}>
          <Download size={16} />
          PPT (마스킹본)
        </button>
        <button onClick={() => printPdf(false)} className="btn-tertiary" style={btn(false)}>
          <Printer size={16} />
          PDF 인쇄 (마스킹본)
        </button>
        <button
          onClick={() => downloadPptx(true)}
          disabled={!canRestore}
          className="btn-tertiary"
          style={btn(!canRestore)}
        >
          <Download size={16} color={canRestore ? undefined : "var(--locked)"} />
          PPT (실명본)
        </button>
        <button
          onClick={() => printPdf(true)}
          disabled={!canRestore}
          className="btn-tertiary"
          style={btn(!canRestore)}
        >
          <Printer size={16} color={canRestore ? undefined : "var(--locked)"} />
          PDF 인쇄 (실명본)
        </button>
      </div>
      <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
        기본은 마스킹본입니다. 실명본은 이 세션의 메모리에서만 복원되며, 어떤
        데이터도 서버로 전송되지 않습니다.
        {!canRestore &&
          " (복원키가 없어 실명본 불가 — 새로고침했거나 재활용 모드입니다)"}
      </p>
      {downloadError && (
        <p role="alert" style={{ color: "var(--error-weak-text)", fontWeight: 600 }}>
          {downloadError}
        </p>
      )}

      <PageCta onClick={onConfirm} disabled={confirmed} locked={confirmed}>
        {confirmed && <Check size={16} color="var(--on-primary)" strokeWidth={2.5} />}
        {confirmed ? "컨셉 확정됨" : "다음"}
      </PageCta>
    </div>
  );
}
