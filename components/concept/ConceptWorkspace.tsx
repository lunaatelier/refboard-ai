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
import PageLayout, { ErrorState, PageCta } from "../shell/PageLayout";

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
  background: "var(--canvas)",
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
  // 기준 콘텐츠 변형 — 구조 3안 생성에 참고할 톤 하나만 고른다(§6.7). 문서에
  // 변형이 있으면 첫 번째를 기본값으로 하되 사용자가 바꿀 수 있다. 다른 변형은
  // 여기서 3안을 나누지 않고, 확정된 안에만 온디맨드로 나중에 적용한다.
  const [baseContentVariantId, setBaseContentVariantId] = useState<string>(
    variants[0]?.variantId ?? "",
  );
  const [selectedOptionId, setSelectedOptionId] = useState<string>();
  const [previewPageId, setPreviewPageId] = useState<string>();
  const [previewPlatform, setPreviewPlatform] = useState<"web" | "mobile">("web");
  // 미리보기에서 확인할 콘텐츠 변형 — 기준 변형이 아닌 걸 고르면 온디맨드로
  // contentMapping만 다시 받아온다(§6.7, P1 item 12).
  const [previewContentVariantId, setPreviewContentVariantId] = useState<string>();
  const [variantMappingBusy, setVariantMappingBusy] = useState(false);
  const [variantMappingError, setVariantMappingError] = useState<string>();

  const representative =
    references.representative ?? recommendRepresentativePages(analysis);

  const generate = async () => {
    if (!references.confirmedBrief) {
      setError(
        "레퍼런스·무드 단계에서 결정을 먼저 확정해야 합니다 (팔레트·무드 선택 후 \"다음\"을 누르세요).",
      );
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/concept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          analysis,
          directives,
          representative,
          referenceBrief: references.confirmedBrief,
          ...(baseContentVariantId ? { baseContentVariantId } : {}),
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

  const activeVariantId = previewContentVariantId ?? concept?.baseContentVariantId;
  const isNonBaseVariant = Boolean(
    activeVariantId && activeVariantId !== concept?.baseContentVariantId,
  );
  const variantPages = isNonBaseVariant
    ? selected?.contentVariantMappings?.[activeVariantId!]
    : undefined;
  // 웹+모바일 세트가 있으면 토글로 전환, 없으면 pages 단일 세트. 비기준 변형을
  // 고르고 온디맨드 매핑이 이미 받아져 있으면 그걸 우선한다(§6.7).
  const previewPages =
    variantPages ??
    (previewPlatform === "mobile"
      ? selected?.platforms?.mobile
      : selected?.platforms?.web) ??
    selected?.pages;
  const previewPage =
    previewPages?.find((p) => p.pageId === previewPageId) ??
    previewPages?.find(
      (p) => p.pageId === concept?.outputSelection.contentRepresentativePageId,
    ) ??
    previewPages?.[0];

  const selectPreviewVariant = async (variantId: string) => {
    setPreviewContentVariantId(variantId);
    setVariantMappingError(undefined);
    if (!selected || !concept) return;
    // 기준 변형으로 되돌아가면 이미 있는 pages를 그대로 쓰면 되니 호출하지 않는다.
    if (!variantId || variantId === concept.baseContentVariantId) return;
    // 이미 이 옵션에 이 변형의 매핑이 있으면(캐시) 다시 부르지 않는다 — 캐시 키는
    // conceptOptionId(옵션에 스코프됨) + contentVariantId(맵 키)이고, briefHash는
    // 컨셉 전체가 재생성될 때 sourceBasis와 함께 자연히 무효화된다(§6.7).
    if (selected.contentVariantMappings?.[variantId]) return;
    setVariantMappingBusy(true);
    try {
      const res = await fetch("/api/concept/content-variant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          analysis,
          directives,
          contentVariantId: variantId,
          pages: selected.pages,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.pages)) {
        throw new Error(body?.error ?? "콘텐츠 매핑 생성에 실패했습니다.");
      }
      const optionId = selected.optionId;
      onChange({
        ...concept,
        options: concept.options.map((o) =>
          o.optionId === optionId
            ? {
                ...o,
                contentVariantMappings: {
                  ...(o.contentVariantMappings ?? {}),
                  [variantId]: body.pages,
                },
              }
            : o,
        ),
      });
    } catch (e) {
      setVariantMappingError(
        e instanceof Error ? e.message : "콘텐츠 매핑 생성에 실패했습니다.",
      );
    } finally {
      setVariantMappingBusy(false);
    }
  };

  return (
    <PageLayout
      title="컨셉 3안"
      description="레퍼런스·무드에서 확정한 팔레트·무드·레이아웃·벤치마킹 시사점을 반영해 전체 방향 3안을 만듭니다. 3안 모두 컨셉서로 내보냅니다 (1안 확정이 아님)."
    >
      <div style={card}>
        {variants.length >= 2 && (
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <span style={{ fontSize: 14 }}>
              문서에 이미 있는 시안 변형 {variants.length}개 중 기준 변형 선택
              (3안 모두 이 톤으로 작성 — 다른 변형은 확정 후 개별 적용 가능)
            </span>
            <select
              value={baseContentVariantId}
              onChange={(e) => setBaseContentVariantId(e.target.value)}
              className="select-box"
            >
              {variants.map((v) => (
                <option key={v.variantId} value={v.variantId}>
                  {v.label}
                </option>
              ))}
            </select>
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
          <ErrorState title="컨셉 생성에 실패했어요" detail={error} onRetry={generate} />
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
                              : "var(--foreground)",
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
                        ? " (표지 대표)"
                        : p.pageId ===
                            concept.outputSelection
                              .contentRepresentativePageId
                          ? " (본문 대표)"
                          : ""}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  {selected.uiStructure.infoStructure}
                </span>
                {variants.length >= 2 && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                    원고
                    <select
                      value={activeVariantId ?? ""}
                      onChange={(e) => void selectPreviewVariant(e.target.value)}
                      className="select-box"
                    >
                      {variants.map((v) => (
                        <option key={v.variantId} value={v.variantId}>
                          {v.label}
                          {v.variantId === concept.baseContentVariantId ? " (기준)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {variantMappingBusy && (
                  <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                    다른 원고 적용 중…
                  </span>
                )}
              </div>
              {variantMappingError && (
                <ErrorState
                  title="다른 원고 적용에 실패했어요"
                  detail={variantMappingError}
                  onRetry={() =>
                    activeVariantId && void selectPreviewVariant(activeVariantId)
                  }
                />
              )}
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
