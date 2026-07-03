"use client";

import { useState } from "react";
import ConceptPreview from "./ConceptPreview";
import type { ProjectAnalysis, ProjectDirective } from "@/lib/analysis/types";
import type { ConceptJson } from "@/lib/concept/types";
import { recommendRepresentativePages } from "@/lib/reference/imageHints";
import type { ReferenceResult } from "@/lib/reference/types";

// ⑤ 컨셉 3안 (Step 12-a) — 프로젝트 전체를 관통하는 방향 3가지.
// 페이지마다 3안(=15개)을 만들지 않는다. 대표 페이지로 각 안을 시각화.

interface ConceptWorkspaceProps {
  analysis: ProjectAnalysis;
  directives: ProjectDirective[];
  references: ReferenceResult;
  concept?: ConceptJson;
  onChange: (next: ConceptJson) => void;
}

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

export default function ConceptWorkspace({
  analysis,
  directives,
  references,
  concept,
  onChange,
}: ConceptWorkspaceProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const variants = analysis.existingContentVariants ?? [];
  const [useVariants, setUseVariants] = useState(variants.length >= 2);
  const [selectedOptionId, setSelectedOptionId] = useState<string>();
  const [previewPageId, setPreviewPageId] = useState<string>();

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
  const previewPage =
    selected?.pages.find((p) => p.pageId === previewPageId) ??
    selected?.pages.find(
      (p) => p.pageId === concept?.outputSelection.contentRepresentativePageId,
    ) ??
    selected?.pages[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 960 }}>
      <div style={card}>
        <h2>⑤ 컨셉 3안</h2>
        <p style={{ color: "var(--text-muted)" }}>
          ④에서 확정한 팔레트·무드·레이아웃·벤치마킹 시사점을 반영해 전체
          방향 3안을 만듭니다. 3안 모두 컨셉서로 내보냅니다 (1안 확정이
          아님).
        </p>
        {variants.length >= 2 && (
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={useVariants}
              onChange={(e) => setUseVariants(e.target.checked)}
            />
            <span>
              문서에 이미 있는 시안 변형 {variants.length}개(
              {variants.map((v) => v.label).join("/")})를 3안의 기반으로 사용
            </span>
          </label>
        )}
        <button
          onClick={generate}
          disabled={busy}
          style={{
            alignSelf: "flex-start",
            padding: "12px 24px",
            borderRadius: 10,
            border: "none",
            background: busy ? "var(--locked)" : "var(--primary)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {busy ? "컨셉 생성 중… (수십 초)" : concept ? "다시 생성" : "컨셉 3안 생성"}
        </button>
        {error && (
          <p role="alert" style={{ color: "#dc2626", fontWeight: 600 }}>
            {error}
          </p>
        )}
      </div>

      {concept && (
        <>
          {/* ── 3안 비교 ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {concept.options.map((o) => {
              const isSel = selected?.optionId === o.optionId;
              return (
                <button
                  key={o.optionId}
                  onClick={() => setSelectedOptionId(o.optionId)}
                  style={{
                    ...card,
                    padding: 16,
                    textAlign: "left",
                    cursor: "pointer",
                    border: `2px solid ${isSel ? "var(--primary)" : "var(--border)"}`,
                  }}
                >
                  <b style={{ fontSize: 15 }}>
                    {isSel ? "● " : "○ "}
                    {o.label}
                  </b>
                  {o.basedOnVariantLabel && (
                    <span style={{ fontSize: 13, color: "#b45309" }}>
                      문서 시안 {o.basedOnVariantLabel} 기반
                    </span>
                  )}
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {o.uiStructure.mode === "dark" ? "다크" : "라이트"} · GNB{" "}
                    {o.uiStructure.navPosition === "left" ? "좌측" : "상단"} ·{" "}
                    {o.keyVisual.illustrationStyle}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {o.conceptKeywords.map((a) => (
                      <div key={a.no}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--primary)" }}>
                          {a.no} {a.title}
                        </span>
                        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
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
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <h3 style={{ fontSize: 15 }}>미리보기 — {selected.label}</h3>
                <select
                  value={previewPage.pageId}
                  onChange={(e) => setPreviewPageId(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    font: "inherit",
                  }}
                >
                  {selected.pages.map((p) => (
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
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
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
        </>
      )}
    </div>
  );
}
