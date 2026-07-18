"use client";

import { useState } from "react";
import { Check, Info } from "lucide-react";
import SkinPreview from "./SkinPreview";
import { pickBackgroundColorRequirement } from "@/lib/analysis/requirements";
import type { ProjectAnalysis, ProjectDirective } from "@/lib/analysis/types";
import { buildDirectionOptions } from "@/lib/reference/direction";
import {
  generatePaletteOptions,
  hexToHsl,
  regenerateBrandOption,
} from "@/lib/reference/palette";
import type {
  DirectionOption,
  MoodOption,
  Palette,
  PaletteRole,
  ReferenceResult,
  ReferenceResultUpdater,
} from "@/lib/reference/types";
import { ErrorState } from "../shell/PageLayout";

// [컬러·무드] 탭 (Step 10-a, P3) — 팔레트+무드를 DirectionOption으로 묶어
// 방향 3안을 카드로 비교한 뒤 정확히 1안을 선택한다. 이미지는 세 방향 모두
// 생성 시점에 한 번에 가져온다(§P4 호출 예산 "방향안별 대표 query 약 3회")
// — 그래야 카드 하나만 봐도 컬러+이미지가 결합된 전체 인상을 비교할 수 있다.
//
// P3-5 전까지는 confirmBrief.ts/ImageHintsTab/ConceptWorkspace가 여전히
// references.editedPaletteOption/paletteMode/selectedMoodId/globalMood를
// 직접 읽으므로, 방향을 선택할 때 이 필드들도 함께 채워 하위 호환을 유지한다.

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

const chip: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  background: "var(--primary-weak-bg)",
  color: "var(--primary-hover)",
  borderRadius: "var(--radius-full)",
  padding: "1px 10px",
};

async function fetchMoodImages(query: string) {
  try {
    const res = await fetch("/api/mood-images", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const body = await res.json().catch(() => null);
    return Array.isArray(body?.images) ? body.images : [];
  } catch {
    return [];
  }
}

export default function PaletteMoodTab({
  analysis,
  directives,
  references,
  onChange,
}: PaletteMoodTabProps) {
  const [directionBusy, setDirectionBusy] = useState(false);
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
  const directions = references.directionOptions ?? [];
  const selectedDirection = directions.find(
    (d) => d.directionId === references.selectedDirectionId,
  );

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

  // 원하는 키 컬러로 팔레트 3세트를 다시 생성 — 기존 방향 3안은 다른 팔레트
  // 후보를 참조하고 있어 더 이상 유효하지 않으므로 함께 초기화한다.
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
      moodOptions: undefined,
      directionOptions: undefined,
      selectedDirectionId: undefined,
      selectedMoodId: undefined,
      editedPaletteOption: undefined,
      paletteMode: undefined,
      globalMood: undefined,
    });
  };

  // 방향 카드 하나의 팔레트만 다시 뽑기. direction은 paletteOptionId를 참조로만
  // 갖고 있어(스냅샷 아님), paletteOptions 배열만 바꾸면 카드도 즉시 갱신된다.
  const regenerateCardPalette = (optionId: string) => {
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

  const generateDirections = async () => {
    const paletteOptions = references.paletteOptions ?? [];
    if (paletteOptions.length === 0) {
      setError("팔레트 후보가 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.");
      return;
    }
    setDirectionBusy(true);
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
          paletteOptions,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.moods)) {
        throw new Error(body?.error ?? "무드 생성에 실패했습니다.");
      }
      const moods: MoodOption[] = body.moods;

      // 방향 3안 각각의 대표 이미지 — 배치로 한 번에 가져온다 (§P4 "약 3회").
      const imageLists = await Promise.all(
        moods.map((m) => fetchMoodImages(m.imageQuery)),
      );
      const imagesByMoodId = Object.fromEntries(
        moods.map((m, i) => [m.id, imageLists[i]]),
      );
      const nextDirections = buildDirectionOptions(moods, paletteOptions, imagesByMoodId);

      onChange((prev) => ({
        ...prev,
        moodOptions: moods,
        directionOptions: nextDirections,
        selectedDirectionId: undefined,
        selectedMoodId: undefined,
        editedPaletteOption: undefined,
        paletteMode: undefined,
        globalMood: undefined,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "방향 생성에 실패했습니다.");
    } finally {
      setDirectionBusy(false);
    }
  };

  const selectDirection = (direction: DirectionOption) => {
    const palette = (references.paletteOptions ?? []).find(
      (p) => p.optionId === direction.paletteOptionId,
    );
    const mood = references.moodOptions?.find((m) => m.id === direction.moodOptionId);
    onChange((prev) => ({
      ...prev,
      selectedDirectionId: direction.directionId,
      // 하위 호환 — P3-5에서 confirmBrief.ts가 directionOptions 기준으로
      // 바뀌기 전까지, 아래 필드들을 직접 읽는 화면들이 있다.
      selectedMoodId: direction.moodOptionId,
      editedPaletteOption: palette ? structuredClone(palette) : prev.editedPaletteOption,
      paletteMode:
        prev.paletteMode ?? (analysis.domain === "dashboard-ops" ? "dark" : "light"),
      globalMood: mood
        ? {
            keywords: mood.keywords,
            description: mood.description,
            images: direction.imageCandidates
              .filter((c) => c.selected)
              .map((c) => ({ url: c.url, source: c.source, attribution: c.attribution })),
          }
        : prev.globalMood,
    }));
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
          방향 3안을 비교한 뒤 정확히 1안을 선택하세요 — 완료되면 하단 &ldquo;다음&rdquo; 버튼이 활성화됩니다
        </span>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>
          글로벌 방향{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 14 }}>
            팔레트·무드·이미지가 결합된 방향안 3개 (도메인: {analysis.domain})
          </span>
        </h3>
        <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
            3안이 다 마음에 안 들면 원하는 키 컬러로 팔레트부터 다시 생성하세요
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
            이 컬러로 팔레트 재생성
          </button>
        </div>
        {customHexError && (
          <p role="alert" style={{ color: "var(--error-weak-text)", fontWeight: 600, fontSize: 13 }}>
            {customHexError}
          </p>
        )}

        {directions.length === 0 ? (
          <button
            onClick={generateDirections}
            disabled={directionBusy}
            className="btn-weak-primary"
            style={{
              alignSelf: "flex-start",
              padding: "10px var(--space-base)",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: directionBusy ? "var(--locked)" : undefined,
              color: directionBusy ? "var(--on-primary)" : undefined,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {directionBusy ? "방향 3안 생성 중…" : "방향 3안 생성"}
          </button>
        ) : (
          <>
            <button
              onClick={generateDirections}
              disabled={directionBusy}
              style={{
                alignSelf: "flex-start",
                padding: "6px 14px",
                borderRadius: "var(--radius-full)",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {directionBusy ? "다시 생성 중…" : "🔄 방향 3안 다시 생성"}
            </button>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "var(--space-md)",
              }}
            >
              {directions.map((direction) => {
                const selected = direction.directionId === references.selectedDirectionId;
                const palette = (references.paletteOptions ?? []).find(
                  (p) => p.optionId === direction.paletteOptionId,
                );
                const swatchPalette = palette?.light;
                const hero = direction.imageCandidates.find((c) => c.role === "hero");
                const supporting = direction.imageCandidates.filter(
                  (c) => c.role === "supporting",
                );
                return (
                  <div
                    key={direction.directionId}
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
                    <span style={{ fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
                      {selected && <Check size={14} color="var(--primary)" strokeWidth={2.5} />}
                      {direction.label}
                    </span>
                    <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                      {direction.description}
                    </span>

                    {hero && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={hero.url}
                        alt={direction.label}
                        style={{
                          width: "100%",
                          height: 140,
                          objectFit: "cover",
                          borderRadius: "var(--radius-md)",
                        }}
                      />
                    )}
                    {supporting.length > 0 && (
                      <div style={{ display: "flex", gap: 4 }}>
                        {supporting.map((c, i) => (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            key={i}
                            src={c.url}
                            alt=""
                            style={{
                              flex: 1,
                              height: 60,
                              objectFit: "cover",
                              borderRadius: "var(--radius-sm)",
                            }}
                          />
                        ))}
                      </div>
                    )}
                    {direction.imageCandidates.length === 0 && (
                      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                        이미지 후보 없음 (키워드만으로 계속 진행 가능)
                      </p>
                    )}

                    {swatchPalette && (
                      <span style={{ display: "flex", gap: 4 }}>
                        {[
                          swatchPalette.primary,
                          swatchPalette.secondary,
                          swatchPalette.accent,
                          swatchPalette.surface,
                          swatchPalette.background,
                          swatchPalette.text,
                        ].map((c, i) => (
                          <span
                            key={i}
                            title={c}
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: "var(--radius-sm)",
                              background: c,
                              border: "1px solid var(--border)",
                            }}
                          />
                        ))}
                      </span>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span
                        title={direction.typography.title.note}
                        style={{ fontSize: 16, fontWeight: 700 }}
                      >
                        {direction.typography.title.sampleText || direction.label}
                      </span>
                      <span
                        title={direction.typography.body.note}
                        style={{ fontSize: 13, color: "var(--text-muted)" }}
                      >
                        {direction.typography.body.sampleText}
                      </span>
                    </div>

                    <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {direction.keywords.map((k) => (
                        <span key={k} style={chip}>
                          {k}
                        </span>
                      ))}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {direction.styleAttributes.radius === "sharp" ? "각진" : "둥근"} ·{" "}
                      {direction.styleAttributes.density === "compact" ? "집약" : "여백"} ·{" "}
                      {direction.styleAttributes.contrast === "high" ? "고대비" : "부드러운 대비"}
                    </span>
                    {(direction.recommendedDirections.length > 0 ||
                      direction.avoidDirections.length > 0) && (
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                        {direction.recommendedDirections.length > 0 && (
                          <>추천: {direction.recommendedDirections.join(", ")}. </>
                        )}
                        {direction.avoidDirections.length > 0 && (
                          <>지양: {direction.avoidDirections.join(", ")}.</>
                        )}
                      </span>
                    )}

                    <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
                      <button
                        onClick={() => selectDirection(direction)}
                        className={selected ? undefined : "btn-weak-primary"}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "var(--radius-md)",
                          border: selected ? "1px solid var(--primary)" : "none",
                          background: selected ? "var(--primary-soft)" : undefined,
                          color: selected ? "var(--primary)" : undefined,
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        {selected ? "선택됨" : "이 방향 선택"}
                      </button>
                      {references.paletteBrandHex && (
                        <button
                          onClick={() => regenerateCardPalette(direction.paletteOptionId)}
                          style={{
                            padding: "3px 10px",
                            borderRadius: "var(--radius-full)",
                            border: "1px solid var(--border)",
                            background: "transparent",
                            color: "var(--text-muted)",
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          🔄 팔레트만 다시
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {error && (
          <ErrorState
            title="방향 생성에 실패했어요"
            detail={error}
            onRetry={generateDirections}
          />
        )}
      </div>

      {/* ── 선택된 방향 상세 — 팔레트 역할 편집 + 실시간 프리뷰 ── */}
      {selectedDirection && edited && currentPalette && (
        <div style={card}>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>
            {selectedDirection.label}{" "}
            <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 14 }}>
              색은 유지한 채 역할 배치만 편집할 수 있습니다
            </span>
          </h3>
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "var(--space-base)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {(Object.keys(ROLE_LABELS) as PaletteRole[]).map((role) => (
                <label
                  key={role}
                  style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}
                >
                  <span style={{ flex: 1, fontSize: 14 }}>{ROLE_LABELS[role]}</span>
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
              <span style={{ fontSize: 14, color: "var(--text-muted)" }}>실시간 프리뷰</span>
              <SkinPreview palette={currentPalette} mood={selectedMood} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
