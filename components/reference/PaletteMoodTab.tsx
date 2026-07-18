"use client";

import { useRef, useState } from "react";
import { Check, Info } from "lucide-react";
import SkinPreview from "./SkinPreview";
import { pickBackgroundColorRequirement } from "@/lib/analysis/requirements";
import type { ProjectAnalysis, ProjectDirective } from "@/lib/analysis/types";
import {
  generatePaletteOptions,
  hexToHsl,
  regenerateBrandOption,
} from "@/lib/reference/palette";
import type {
  MoodOption,
  Palette,
  PaletteOption,
  PaletteRole,
  ReferenceResult,
  ReferenceResultUpdater,
} from "@/lib/reference/types";
import { ErrorState } from "../shell/PageLayout";

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
  onChange: (next: ReferenceResultUpdater) => void;
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

export default function PaletteMoodTab({
  analysis,
  directives,
  references,
  onChange,
}: PaletteMoodTabProps) {
  const [moodBusy, setMoodBusy] = useState(false);
  const [imagesBusy, setImagesBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [customHex, setCustomHex] = useState("");
  const [customHexError, setCustomHexError] = useState<string>();
  const [roleHexDraft, setRoleHexDraft] = useState<Record<string, string>>({});

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

  const commitRoleHex = (role: PaletteRole, raw: string) => {
    const normalized = raw.trim();
    if (!hexToHsl(normalized)) return; // 잘못된 값은 무시(다음 렌더에서 기존 값으로 되돌아감)
    setRole(role, normalized.startsWith("#") ? normalized.toUpperCase() : `#${normalized.toUpperCase()}`);
  };

  // 원하는 키 컬러로 팔레트 3세트를 다시 생성 (기본 3세트가 전부 마음에 안 들 때 대안).
  const regenerateWithCustomColor = () => {
    if (!hexToHsl(customHex)) {
      setCustomHexError("올바른 hex 색상 코드를 입력하세요 (예: #2563EB)");
      return;
    }
    setCustomHexError(undefined);
    const brand = customHex.trim();
    onChange({
      ...references,
      paletteOptions: generatePaletteOptions(
        [brand],
        pickBackgroundColorRequirement(analysis.explicitRequirements),
      ),
      paletteBrandHex: brand,
      editedPaletteOption: undefined,
      paletteMode: undefined,
    });
  };

  // 3세트 중 이 카드 하나만 다른 변주로 다시 뽑기 (나머지 2개는 유지).
  const regenerateOption = (optionId: string) => {
    const brand = references.paletteBrandHex;
    if (!brand) return;
    const fresh = regenerateBrandOption(
      brand,
      optionId,
      pickBackgroundColorRequirement(analysis.explicitRequirements),
    );
    if (!fresh) return;
    const nextOptions = (references.paletteOptions ?? []).map((o) =>
      o.optionId === optionId ? fresh : o,
    );
    const wasSelected = edited?.optionId === optionId;
    onChange({
      ...references,
      paletteOptions: nextOptions,
      editedPaletteOption: wasSelected ? structuredClone(fresh) : edited,
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
      onChange((prev) => ({ ...prev, moodOptions: body.moods }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "무드 생성에 실패했습니다.");
    } finally {
      setMoodBusy(false);
    }
  };

  // 진행 중인 무드 이미지 요청 — 다른 무드를 선택하면 이전 요청은 취소한다
  // (§P1 item 8). hash 비교로 응답을 버리는 것과 별개로, 어차피 버려질 요청을
  // 굳이 끝까지 기다리지 않는다.
  const moodImagesAbortRef = useRef<AbortController | null>(null);

  const selectMood = async (mood: MoodOption) => {
    onChange((prev) => ({ ...prev, selectedMoodId: mood.id }));
    moodImagesAbortRef.current?.abort();
    const controller = new AbortController();
    moodImagesAbortRef.current = controller;
    setImagesBusy(true);
    try {
      const res = await fetch("/api/mood-images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: mood.imageQuery }),
        signal: controller.signal,
      });
      const body = await res.json().catch(() => null);
      onChange((prev) => {
        // 그 사이 사용자가 다른 무드를 선택했으면 이 응답은 버린다(늦게 도착한
        // 이전 선택의 이미지가 최신 선택을 덮어쓰지 않게, §2.9/§6.5).
        if (prev.selectedMoodId !== mood.id) return prev;
        return {
          ...prev,
          globalMood: {
            keywords: mood.keywords,
            description: mood.description,
            images: Array.isArray(body?.images) ? body.images : [],
          },
        };
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    } finally {
      if (moodImagesAbortRef.current === controller) {
        setImagesBusy(false);
      }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-base)" }}>
      <div
        style={{
          ...card,
          padding: "16px 20px",
          background: "var(--primary-soft)",
          border: "1px solid var(--primary)",
          flexDirection: "row",
          alignItems: "center",
          gap: "var(--space-md)",
          flexWrap: "wrap",
        }}
      >
        <Info size={18} color="var(--primary)" />
        <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: 14 }}>
          팔레트 1세트와 무드 1종을 선택하세요 — 완료되면 하단 &ldquo;다음&rdquo; 버튼이 활성화됩니다
        </span>
      </div>

      {/* ── 팔레트 ── */}
      <div style={card}>
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>
          컬러 팔레트{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 14 }}>
            {analysis.brandColors?.length
              ? "브랜드 컬러 기반 3변주"
              : "무드 기반 3세트"}{" "}
            — 1세트 선택 후 역할 배치를 편집하세요
          </span>
        </h3>
        <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
            3세트가 다 마음에 안 들면 원하는 키 컬러로 다시 생성하세요
          </span>
          <input
            value={customHex}
            onChange={(e) => setCustomHex(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && regenerateWithCustomColor()}
            placeholder="#2563EB"
            style={{
              width: 110,
              padding: "6px 10px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              font: "inherit",
              fontFamily: "monospace",
            }}
          />
          <button
            onClick={regenerateWithCustomColor}
            className="btn-weak-primary"
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-md)",
              border: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            이 컬러로 3세트 재생성
          </button>
        </div>
        {customHexError && (
          <p role="alert" style={{ color: "var(--error-weak-text)", fontWeight: 600, fontSize: 13 }}>
            {customHexError}
          </p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-md)" }}>
          {(references.paletteOptions ?? []).map((opt) => {
            const selected = edited?.optionId === opt.optionId;
            const p = opt[mode];
            const canRegenerate = Boolean(references.paletteBrandHex);
            return (
              <div
                key={opt.optionId}
                className="hoverable-card"
                style={{
                  border: selected ? "2px solid var(--primary)" : undefined,
                  borderRadius: "var(--radius-lg)",
                  padding: "var(--space-md)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-sm)",
                }}
              >
                <button
                  onClick={() => selectOption(opt)}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-sm)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                    {selected && <Check size={14} color="var(--primary)" strokeWidth={2.5} />}
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
                            borderRadius: "var(--radius-sm)",
                            background: c,
                            border: "1px solid var(--border)",
                          }}
                        />
                      ),
                    )}
                  </span>
                </button>
                {canRegenerate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      regenerateOption(opt.optionId);
                    }}
                    style={{
                      alignSelf: "flex-start",
                      padding: "3px 10px",
                      borderRadius: "var(--radius-full)",
                      border: "1px solid var(--border)",
                      background: "transparent",
                      color: "var(--text-muted)",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    🔄 이 세트만 다시
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {edited && currentPalette && (
          <>
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 4 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>모드</span>
                {(["light", "dark"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => onChange({ ...references, paletteMode: m })}
                    style={{
                      padding: "4px 14px",
                      borderRadius: "var(--radius-md)",
                      border: `1px solid ${mode === m ? "var(--primary)" : "var(--border)"}`,
                      background: mode === m ? "var(--primary-soft)" : "transparent",
                      color: mode === m ? "var(--primary)" : "var(--foreground)",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {m === "light" ? "라이트" : "다크"}
                  </button>
                ))}
              </div>
              {analysis.domain === "dashboard-ops" && (
                <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
                  대시보드는 다크 기본 추천
                </span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-base)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {(Object.keys(ROLE_LABELS) as PaletteRole[]).map((role) => (
                  <label
                    key={role}
                    style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}
                  >
                    <span style={{ flex: 1, fontSize: 14 }}>
                      {ROLE_LABELS[role]}
                    </span>
                    <span
                      aria-hidden="true"
                      title={currentPalette[role]}
                      style={{
                        width: 30,
                        height: 30,
                        flex: "0 0 30px",
                        display: "inline-block",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        background: currentPalette[role],
                      }}
                    />
                    <input
                      type="text"
                      value={roleHexDraft[role] ?? currentPalette[role]}
                      onChange={(e) =>
                        setRoleHexDraft({ ...roleHexDraft, [role]: e.target.value })
                      }
                      onBlur={(e) => {
                        commitRoleHex(role, e.target.value);
                        setRoleHexDraft((d) => {
                          const next = { ...d };
                          delete next[role];
                          return next;
                        });
                      }}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      placeholder="#RRGGBB"
                      title="원하는 hex 값을 직접 입력"
                      style={{
                        width: 100,
                        padding: "8px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border)",
                        font: "inherit",
                        fontSize: 14,
                        fontFamily: "monospace",
                      }}
                    />
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
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
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>
          무드보드{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 14 }}>
            3종 제시 → 선택 (도메인: {analysis.domain})
          </span>
        </h3>
        {!references.moodOptions ? (
          <button
            onClick={generateMoods}
            disabled={moodBusy}
            className="btn-weak-primary"
            style={{
              alignSelf: "flex-start",
              padding: "10px var(--space-base)",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: moodBusy ? "var(--locked)" : undefined,
              color: moodBusy ? "var(--on-primary)" : undefined,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {moodBusy ? "무드 생성 중…" : "무드 3종 생성"}
          </button>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-md)" }}>
            {references.moodOptions.map((m) => {
              const selected = references.selectedMoodId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => selectMood(m)}
                  className="hoverable-card"
                  style={{
                    border: selected ? "2px solid var(--primary)" : undefined,
                    borderRadius: "var(--radius-lg)",
                    padding: "var(--space-md)",
                    background: "transparent",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-sm)",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                    {selected && <Check size={14} color="var(--primary)" strokeWidth={2.5} />}
                    {m.label}
                  </span>
                  <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {m.keywords.map((k) => (
                      <span
                        key={k}
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          background: "var(--primary-weak-bg)",
                          color: "var(--primary-hover)",
                          borderRadius: "var(--radius-full)",
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
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {analysis.domain === "document" &&
              selectedMood?.styleAttributes.typographyNote && (
                <p style={{ color: "var(--text-muted)" }}>
                  타이포 방향: {selectedMood.styleAttributes.typographyNote}
                </p>
              )}
            {imagesBusy ? (
              <p style={{ color: "var(--text-muted)" }}>이미지 불러오는 중…</p>
            ) : references.globalMood.images.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "var(--space-sm)" }}>
                {references.globalMood.images.map((img, i) => (
                  <figure key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.attribution}
                      style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: "var(--radius-md)" }}
                    />
                    <figcaption style={{ fontSize: 14, color: "var(--text-muted)" }}>
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
          <ErrorState
            title="무드 생성에 실패했어요"
            detail={error}
            onRetry={generateMoods}
          />
        )}
      </div>
    </div>
  );
}
