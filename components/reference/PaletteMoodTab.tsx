"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Info } from "lucide-react";
import SkinPreview from "./SkinPreview";
import { pickBackgroundColorRequirement } from "@/lib/analysis/requirements";
import type { ProjectAnalysis, ProjectDirective } from "@/lib/analysis/types";
import {
  applyRegeneratedImages,
  buildDirectionOptions,
  moveSelectedImage,
  replaceImageCandidate,
  setImageRole,
  setImageSelected,
  type SearchedImageLike,
} from "@/lib/reference/direction";
import {
  generatePaletteOptions,
  hexToHsl,
  regenerateBrandOption,
} from "@/lib/reference/palette";
import { RequestGuard } from "@/lib/reference/requestGuard";
import type {
  DirectionOption,
  ImageRole,
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
// selectedDirectionId가 무드·이미지 선택의 단일 출처다(P3-5) — confirmBrief.ts/
// ImageHintsTab은 이걸로 directionOptions에서 직접 조회한다. editedPaletteOption/
// paletteMode만 별도 상태다 — direction은 paletteOptionId 참조만 가지므로,
// 역할 재배치(색 유지, 배치만 변경) 편집 결과는 여기 따로 보관해야 한다.

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

interface MoodImageQuery {
  query: string;
  colorHex?: string;
  excludeKeywords?: string[];
  page?: number;
}

async function fetchMoodImages(
  params: MoodImageQuery,
  signal?: AbortSignal,
): Promise<SearchedImageLike[]> {
  try {
    const res = await fetch("/api/mood-images", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
      signal,
    });
    const body = await res.json().catch(() => null);
    return Array.isArray(body?.images) ? body.images : [];
  } catch {
    return [];
  }
}

const IMAGE_ROLE_LABELS: Record<ImageRole, string> = {
  hero: "대표",
  supporting: "보조",
  detail: "디테일",
  texture: "텍스처",
  layout: "레이아웃",
};

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

  // 이미지 상세 조작 (P3-4) — 다시 생성 컨트롤과 진행 상태.
  const [subjectDraft, setSubjectDraft] = useState<Record<string, string>>({});
  const [styleDraft, setStyleDraft] = useState<Record<string, string>>({});
  const [keepSubject, setKeepSubject] = useState(true);
  const [keepColor, setKeepColor] = useState(false);
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
  const [excludeDraft, setExcludeDraft] = useState("");
  const [regenPage, setRegenPage] = useState(2); // 1은 최초 방향 생성 때 이미 사용됨
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenError, setRegenError] = useState<string>();
  const [replaceBusyUrl, setReplaceBusyUrl] = useState<string>();
  const [selectionNotice, setSelectionNotice] = useState<string>();

  // 방향 3안 전체를 다루는 모든 비동기 작업(재생성/이미지 교체/커스텀 컬러
  // 재생성)이 공유하는 늦은 응답 가드(P10-A) — 하나의 key("directions")로
  // 묶어, 방향 전체가 다시 만들어지는 순간 그 이전에 진행 중이던 요청(다른
  // 이미지 교체 등)은 전부 취소되고 응답이 와도 무시된다.
  const directionGuard = useRef(new RequestGuard()).current;
  // 이 탭이 언마운트되면(다른 탭으로 이동) 남아있는 요청은 전부 취소하고 늦게
  // 도착해도 무시한다 — epoch 비교만으로는 "같은 탭 안의 새 요청"만 잡아내고
  // "탭을 아예 떠남"은 잡지 못한다.
  useEffect(() => () => directionGuard.cancelAll(), [directionGuard]);

  const mode = references.paletteMode ?? "light";
  const edited = references.editedPaletteOption;
  const currentPalette: Palette | undefined = edited?.[mode];
  const directions = references.directionOptions ?? [];
  const selectedDirection = directions.find(
    (d) => d.directionId === references.selectedDirectionId,
  );
  const selectedMood = references.moodOptions?.find(
    (m) => m.id === selectedDirection?.moodOptionId,
  );

  const defaultSubjectFor = (direction: DirectionOption) =>
    references.moodOptions?.find((m) => m.id === direction.moodOptionId)?.imageQuery ??
    direction.label;
  const subjectFor = (direction: DirectionOption) =>
    subjectDraft[direction.directionId] ?? defaultSubjectFor(direction);
  const styleFor = (direction: DirectionOption) => styleDraft[direction.directionId] ?? "";
  const queryFor = (direction: DirectionOption) =>
    `${subjectFor(direction)} ${styleFor(direction)}`.trim();

  // 방향 하나의 이미지 후보를 references.directionOptions에 반영한다 — 이미지
  // 선택 상태의 단일 출처이므로(P3-5), 별도 필드를 다시 맞출 필요가 없다.
  const updateDirection = (updated: DirectionOption) => {
    onChange((prev) => ({
      ...prev,
      directionOptions: (prev.directionOptions ?? []).map((d) =>
        d.directionId === updated.directionId ? updated : d,
      ),
    }));
  };

  const toggleImageSelected = (direction: DirectionOption, url: string, selected: boolean) => {
    const next = setImageSelected(direction, url, selected);
    if (next === direction && selected) {
      setSelectionNotice("최대 4장까지 선택할 수 있습니다. 다른 이미지를 먼저 해제하세요.");
      return;
    }
    setSelectionNotice(undefined);
    updateDirection(next);
  };

  const changeImageRole = (direction: DirectionOption, url: string, role: ImageRole) =>
    updateDirection(setImageRole(direction, url, role));

  const moveImage = (direction: DirectionOption, url: string, delta: -1 | 1) =>
    updateDirection(moveSelectedImage(direction, url, delta));

  const addExcludeKeyword = () => {
    const word = excludeDraft.trim();
    if (!word || excludeKeywords.includes(word)) return;
    setExcludeKeywords([...excludeKeywords, word]);
    setExcludeDraft("");
  };

  const replaceOneImage = async (direction: DirectionOption, url: string) => {
    setReplaceBusyUrl(url);
    setRegenError(undefined);
    const { epoch, signal } = directionGuard.begin("directions");
    try {
      const images = await fetchMoodImages(
        {
          query: queryFor(direction),
          colorHex: keepColor ? currentPalette?.primary : undefined,
          excludeKeywords,
          page: regenPage,
        },
        signal,
      );
      // 그 사이 방향 3안이 재생성/재선택돼 이 응답이 더 이상 유효하지 않으면
      // (§P10-A) 조용히 버린다 — busy 해제만 finally에서 계속 수행한다.
      if (!directionGuard.isCurrent("directions", epoch)) return;
      setRegenPage((p) => p + 1);
      const existingUrls = new Set(direction.imageCandidates.map((c) => c.url));
      const fresh = images.find((img) => !existingUrls.has(img.url));
      if (!fresh) {
        setRegenError("교체할 새 이미지를 찾지 못했습니다. 검색어를 바꿔보세요.");
        return;
      }
      updateDirection(replaceImageCandidate(direction, url, fresh));
    } finally {
      setReplaceBusyUrl(undefined);
    }
  };

  const regenerateDirectionImages = async (direction: DirectionOption) => {
    setRegenBusy(true);
    setRegenError(undefined);
    const { epoch, signal } = directionGuard.begin("directions");
    try {
      const images = await fetchMoodImages(
        {
          query: queryFor(direction),
          colorHex: keepColor ? currentPalette?.primary : undefined,
          excludeKeywords,
          page: regenPage,
        },
        signal,
      );
      if (!directionGuard.isCurrent("directions", epoch)) return;
      setRegenPage((p) => p + 1);
      if (images.length === 0) {
        setRegenError("이미지를 찾지 못했습니다. 검색어를 바꿔보세요.");
        return;
      }
      updateDirection(applyRegeneratedImages(direction, images));
    } finally {
      setRegenBusy(false);
    }
  };

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
    // 방향 3안 전체를 새로 만드므로, 진행 중이던 이미지 교체/재생성 요청은
    // 지금 취소하고 그 응답이 나중에 와도 무시한다(P10-A).
    directionGuard.begin("directions");
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
      editedPaletteOption: undefined,
      paletteMode: undefined,
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
    // 방향 3안을 통째로 새로 만드는 작업(P10-A) — 진행 중이던 이미지 교체/재생성
    // 요청을 취소하고, 이 요청보다 나중에 시작된 다른 재생성이 먼저 끝나면
    // 이 결과는 버린다.
    const { epoch, signal } = directionGuard.begin("directions");
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
        signal,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.moods)) {
        throw new Error(body?.error ?? "무드 생성에 실패했습니다.");
      }
      const moods: MoodOption[] = body.moods;

      // 방향 3안 각각의 대표 이미지 — 배치로 한 번에 가져온다 (§P4 "약 3회").
      const imageLists = await Promise.all(
        moods.map((m) => fetchMoodImages({ query: m.imageQuery }, signal)),
      );
      if (!directionGuard.isCurrent("directions", epoch)) return;
      const imagesByMoodId = Object.fromEntries(
        moods.map((m, i) => [m.id, imageLists[i]]),
      );
      const nextDirections = buildDirectionOptions(moods, paletteOptions, imagesByMoodId);

      onChange((prev) => ({
        ...prev,
        moodOptions: moods,
        directionOptions: nextDirections,
        selectedDirectionId: undefined,
        editedPaletteOption: undefined,
        paletteMode: undefined,
      }));
    } catch (e) {
      // AbortError는 다른 재생성이 이걸 대체했다는 뜻 — 사용자가 이미 다음
      // 행동을 시작한 것이므로 에러로 보여주지 않는다.
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "방향 생성에 실패했습니다.");
    } finally {
      setDirectionBusy(false);
    }
  };

  // 팔레트 역할 편집본(editedPaletteOption/paletteMode)만 별도 상태로 시드한다 —
  // 나머지(무드·이미지 선택)는 selectedDirectionId 하나로 directionOptions에서
  // 바로 읽으므로 별도로 맞춰줄 필드가 없다(P3-5).
  const selectDirection = (direction: DirectionOption) => {
    const palette = (references.paletteOptions ?? []).find(
      (p) => p.optionId === direction.paletteOptionId,
    );
    onChange((prev) => ({
      ...prev,
      selectedDirectionId: direction.directionId,
      editedPaletteOption: palette ? structuredClone(palette) : prev.editedPaletteOption,
      paletteMode:
        prev.paletteMode ?? (analysis.domain === "dashboard-ops" ? "dark" : "light"),
    }));
  };

  // 방향 3안 전체를 다루는 비동기 작업들은 전부 같은 "directions" 리소스를
  // 공유한다(P10-A) — 하나라도 진행 중이면 서로 겹쳐 시작하지 못하게 막아서,
  // 겹쳐 시작됐을 때 busy 표시가 실제 진행 상태와 어긋나는 걸 UI 단에서부터
  // 방지한다(개별 요청의 결과 자체는 어차피 directionGuard가 막지만, 그와
  // 별개로 사용자에게 보이는 버튼 상태도 정확해야 한다).
  const anyDirectionOpBusy = directionBusy || regenBusy || Boolean(replaceBusyUrl);

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
            disabled={anyDirectionOpBusy}
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
            disabled={anyDirectionOpBusy}
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
              disabled={anyDirectionOpBusy}
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
        <>
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

        {/* ── 이미지 상세 조작 (P3-4) — 선택/역할/순서/교체 + 다시 생성 컨트롤 ── */}
        <div style={card}>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>
            이미지 구성{" "}
            <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 14 }}>
              최대 4장 선택 · 역할·순서 조정 가능
            </span>
          </h3>

          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={keepSubject}
                onChange={(e) => setKeepSubject(e.target.checked)}
              />
              피사체 유지
            </label>
            <input
              value={subjectFor(selectedDirection)}
              onChange={(e) =>
                setSubjectDraft({ ...subjectDraft, [selectedDirection.directionId]: e.target.value })
              }
              disabled={keepSubject}
              placeholder="피사체 (예: office desk)"
              style={{
                width: 180,
                padding: "6px 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                font: "inherit",
                fontSize: 14,
                opacity: keepSubject ? 0.6 : 1,
              }}
            />
            <input
              value={styleFor(selectedDirection)}
              onChange={(e) =>
                setStyleDraft({ ...styleDraft, [selectedDirection.directionId]: e.target.value })
              }
              placeholder="스타일 키워드 (예: minimal bright)"
              style={{
                width: 200,
                padding: "6px 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                font: "inherit",
                fontSize: 14,
              }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={keepColor}
                onChange={(e) => setKeepColor(e.target.checked)}
              />
              컬러 유지{currentPalette && ` (${currentPalette.primary})`}
            </label>
          </div>

          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>제외 키워드</span>
            {excludeKeywords.map((k) => (
              <span key={k} style={{ ...chip, display: "flex", alignItems: "center", gap: 4 }}>
                {k}
                <button
                  onClick={() => setExcludeKeywords(excludeKeywords.filter((x) => x !== k))}
                  aria-label={`${k} 제외 키워드 삭제`}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "inherit",
                    cursor: "pointer",
                    fontWeight: 700,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={excludeDraft}
              onChange={(e) => setExcludeDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addExcludeKeyword()}
              placeholder="단어 입력 후 Enter"
              style={{
                width: 140,
                padding: "4px 8px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                font: "inherit",
                fontSize: 13,
              }}
            />
          </div>

          <button
            onClick={() => regenerateDirectionImages(selectedDirection)}
            disabled={regenBusy || directionBusy}
            className="btn-weak-primary"
            style={{
              alignSelf: "flex-start",
              padding: "6px 14px",
              borderRadius: "var(--radius-md)",
              border: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {regenBusy ? "다시 생성 중…" : "이 방향 이미지 다시 생성"}
          </button>
          {selectionNotice && (
            <p role="alert" style={{ color: "var(--warning-weak-text)", fontWeight: 600, fontSize: 13 }}>
              {selectionNotice}
            </p>
          )}
          {regenError && (
            <p role="alert" style={{ color: "var(--error-weak-text)", fontWeight: 600, fontSize: 13 }}>
              {regenError}
            </p>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "var(--space-sm)",
            }}
          >
            {selectedDirection.imageCandidates.map((c) => {
              const selectedIndex = selectedDirection.imageCandidates
                .filter((x) => x.selected)
                .sort((a, b) => a.order - b.order)
                .findIndex((x) => x.url === c.url);
              return (
                <div
                  key={c.url}
                  style={{
                    border: `1px solid ${c.selected ? "var(--primary)" : "var(--border)"}`,
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-xs)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.url}
                    alt={c.attribution}
                    style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: "var(--radius-sm)" }}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={c.selected}
                      onChange={(e) =>
                        toggleImageSelected(selectedDirection, c.url, e.target.checked)
                      }
                    />
                    선택{c.selected ? ` (${selectedIndex + 1}번)` : ""}
                  </label>
                  <select
                    value={c.role}
                    onChange={(e) =>
                      changeImageRole(selectedDirection, c.url, e.target.value as ImageRole)
                    }
                    className="select-box"
                    style={{ fontSize: 13, padding: "2px 6px" }}
                  >
                    {(Object.keys(IMAGE_ROLE_LABELS) as ImageRole[]).map((r) => (
                      <option key={r} value={r}>
                        {IMAGE_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {c.selected && (
                      <>
                        <button
                          onClick={() => moveImage(selectedDirection, c.url, -1)}
                          disabled={selectedIndex <= 0}
                          title="앞으로"
                          style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "transparent", fontSize: 12, padding: "1px 6px" }}
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveImage(selectedDirection, c.url, 1)}
                          title="뒤로"
                          style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "transparent", fontSize: 12, padding: "1px 6px" }}
                        >
                          ▼
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => replaceOneImage(selectedDirection, c.url)}
                      disabled={Boolean(replaceBusyUrl) || regenBusy || directionBusy}
                      style={{
                        marginLeft: "auto",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-full)",
                        background: "transparent",
                        color: "var(--text-muted)",
                        fontSize: 12,
                        padding: "1px 8px",
                      }}
                    >
                      {replaceBusyUrl === c.url ? "교체 중…" : "🔄 교체"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
