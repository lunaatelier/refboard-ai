"use client";

import { useState } from "react";
import SkinPreview from "./SkinPreview";
import type { ProjectAnalysis, ProjectDirective } from "@/lib/analysis/types";
import { colorPool } from "@/lib/reference/palette";
import type {
  MoodOption,
  Palette,
  PaletteOption,
  PaletteRole,
  ReferenceResult,
} from "@/lib/reference/types";

// [컬러·무드] 탭 (Step 10-a, flow-spec ④)
// 팔레트 3세트 → 1선택 → 역할 매핑 편집 (색 유지, 배치만 변경) → 무드 3종 → 선택 → 스킨 프리뷰.

const ROLE_LABELS: Record<PaletteRole, string> = {
  primary: "Primary (강조)",
  secondary: "Secondary (보조)",
  accent: "Accent (포인트/CTA)",
  background: "Background (배경)",
  surface: "Surface (카드 배경)",
  text: "Text (본문)",
  navigation: "Navigation (LNB/GNB)",
};

interface PaletteMoodTabProps {
  analysis: ProjectAnalysis;
  directives: ProjectDirective[];
  references: ReferenceResult;
  onChange: (next: ReferenceResult) => void;
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

export default function PaletteMoodTab({
  analysis,
  directives,
  references,
  onChange,
}: PaletteMoodTabProps) {
  const [moodBusy, setMoodBusy] = useState(false);
  const [imagesBusy, setImagesBusy] = useState(false);
  const [error, setError] = useState<string>();

  const mode = references.paletteMode ?? "light";
  const edited = references.editedPaletteOption;
  const currentPalette: Palette | undefined = edited?.[mode];
  const selectedMood = references.moodOptions?.find(
    (m) => m.id === references.selectedMoodId,
  );

  const selectOption = (opt: PaletteOption) =>
    onChange({
      ...references,
      editedPaletteOption: structuredClone(opt),
      // 대시보드는 다크 기본 추천 (flow-spec ④)
      paletteMode:
        references.paletteMode ??
        (analysis.domain === "dashboard-ops" ? "dark" : "light"),
    });

  const setRole = (role: PaletteRole, color: string) => {
    if (!edited) return;
    onChange({
      ...references,
      editedPaletteOption: {
        ...edited,
        [mode]: { ...edited[mode], [role]: color },
      },
    });
  };

  const generateMoods = async () => {
    setMoodBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/mood", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: analysis.title,
          description: analysis.description,
          domain: analysis.domain,
          projectType: analysis.projectType,
          tags: analysis.tags,
          directives,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.moods)) {
        throw new Error(body?.error ?? "무드 생성에 실패했습니다.");
      }
      onChange({ ...references, moodOptions: body.moods });
    } catch (e) {
      setError(e instanceof Error ? e.message : "무드 생성에 실패했습니다.");
    } finally {
      setMoodBusy(false);
    }
  };

  const selectMood = async (mood: MoodOption) => {
    onChange({ ...references, selectedMoodId: mood.id });
    setImagesBusy(true);
    try {
      const res = await fetch("/api/mood-images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: mood.imageQuery }),
      });
      const body = await res.json().catch(() => null);
      onChange({
        ...references,
        selectedMoodId: mood.id,
        globalMood: {
          keywords: mood.keywords,
          description: mood.description,
          images: Array.isArray(body?.images) ? body.images : [],
        },
      });
    } finally {
      setImagesBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          ...card,
          padding: "16px 20px",
          background: "var(--primary-soft)",
          border: "1px solid var(--primary)",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--primary)" }}>
          👉 팔레트 1세트와 무드 1종을 선택한 뒤 하단에서 확정하세요
        </span>
      </div>

      {/* ── 팔레트 ── */}
      <div style={card}>
        <h3 style={{ fontSize: 15 }}>
          컬러 팔레트{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
            {analysis.brandColors?.length
              ? "브랜드 컬러 기반 3변주"
              : "무드 기반 3세트"}{" "}
            — 1세트 선택 후 역할 배치를 편집하세요
          </span>
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {(references.paletteOptions ?? []).map((opt) => {
            const selected = edited?.optionId === opt.optionId;
            const p = opt[mode];
            return (
              <button
                key={opt.optionId}
                onClick={() => selectOption(opt)}
                style={{
                  border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                  borderRadius: 10,
                  padding: 12,
                  background: "transparent",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  textAlign: "left",
                }}
              >
                <span style={{ fontWeight: 700 }}>
                  {selected ? "● " : "○ "}
                  {opt.label}
                </span>
                <span style={{ display: "flex", gap: 4 }}>
                  {[p.primary, p.secondary, p.accent, p.surface, p.text].map(
                    (c, i) => (
                      <span
                        key={i}
                        title={c}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: c,
                          border: "1px solid var(--border)",
                        }}
                      />
                    ),
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {edited && currentPalette && (
          <>
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 4 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>모드</span>
                {(["light", "dark"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => onChange({ ...references, paletteMode: m })}
                    style={{
                      padding: "4px 14px",
                      borderRadius: 8,
                      border: `1px solid ${mode === m ? "var(--primary)" : "var(--border)"}`,
                      background: mode === m ? "var(--primary-soft)" : "transparent",
                      color: mode === m ? "var(--primary)" : "var(--text)",
                      fontWeight: 600,
                    }}
                  >
                    {m === "light" ? "라이트" : "다크"}
                  </button>
                ))}
              </div>
              {analysis.domain === "dashboard-ops" && (
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  대시보드는 다크 기본 추천
                </span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(Object.keys(ROLE_LABELS) as PaletteRole[]).map((role) => (
                  <label
                    key={role}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={{ flex: 1, fontSize: 14 }}>
                      {ROLE_LABELS[role]}
                    </span>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 5,
                        background: currentPalette[role],
                        border: "1px solid var(--border)",
                      }}
                    />
                    <select
                      value={currentPalette[role]}
                      onChange={(e) => setRole(role, e.target.value)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        font: "inherit",
                        fontSize: 14,
                        fontFamily: "monospace",
                      }}
                    >
                      {[...new Set([...colorPool(edited), currentPalette[role]])].map(
                        (c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  실시간 프리뷰
                </span>
                <SkinPreview palette={currentPalette} mood={selectedMood} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── 무드 ── */}
      <div style={card}>
        <h3 style={{ fontSize: 15 }}>
          무드보드{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
            3종 제시 → 선택 (도메인: {analysis.domain})
          </span>
        </h3>
        {!references.moodOptions ? (
          <button
            onClick={generateMoods}
            disabled={moodBusy}
            style={{
              alignSelf: "flex-start",
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: moodBusy ? "var(--locked)" : "var(--primary)",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            {moodBusy ? "무드 생성 중…" : "무드 3종 생성"}
          </button>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {references.moodOptions.map((m) => {
              const selected = references.selectedMoodId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => selectMood(m)}
                  style={{
                    border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                    borderRadius: 10,
                    padding: 12,
                    background: "transparent",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontWeight: 700 }}>
                    {selected ? "● " : "○ "}
                    {m.label}
                  </span>
                  <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {m.keywords.map((k) => (
                      <span
                        key={k}
                        style={{
                          fontSize: 14,
                          background: "var(--primary-soft)",
                          color: "var(--primary)",
                          borderRadius: 999,
                          padding: "1px 10px",
                        }}
                      >
                        {k}
                      </span>
                    ))}
                  </span>
                  <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                    {m.description}
                  </span>
                  <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                    {m.styleAttributes.radius === "sharp" ? "각진" : "둥근"} ·{" "}
                    {m.styleAttributes.density === "compact" ? "집약" : "여백"} ·{" "}
                    {m.styleAttributes.contrast === "high" ? "고대비" : "부드러운 대비"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {references.globalMood && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {analysis.domain === "document" &&
              selectedMood?.styleAttributes.typographyNote && (
                <p style={{ color: "var(--text-muted)" }}>
                  타이포 방향: {selectedMood.styleAttributes.typographyNote}
                </p>
              )}
            {imagesBusy ? (
              <p style={{ color: "var(--text-muted)" }}>이미지 불러오는 중…</p>
            ) : references.globalMood.images.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                {references.globalMood.images.map((img, i) => (
                  <figure key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.attribution}
                      style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 8 }}
                    />
                    <figcaption style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {img.attribution}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)" }}>
                이미지를 불러오지 못했습니다 (키워드 기반으로 계속 진행 가능).
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" style={{ color: "#dc2626", fontWeight: 600 }}>
            {error}
          </p>
        )}
      </div>

      {/* ── 확정 ── */}
      <button
        onClick={() => onChange({ ...references, paletteConfirmed: true })}
        disabled={!edited || !references.selectedMoodId || references.paletteConfirmed}
        style={{
          alignSelf: "flex-start",
          padding: "12px 24px",
          borderRadius: 10,
          border: "none",
          background:
            !edited || !references.selectedMoodId || references.paletteConfirmed
              ? "var(--locked)"
              : "var(--primary)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        {references.paletteConfirmed
          ? "✓ 팔레트·무드 확정됨"
          : "팔레트·무드 확정"}
      </button>
    </div>
  );
}
