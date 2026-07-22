"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Info, Sparkles, Wand2 } from "lucide-react";
import type { DocumentPurpose } from "@/lib/analysis/documentPurpose";
import type { ProjectAnalysis, ProjectDirective } from "@/lib/analysis/types";
import {
  buildHintSkeletons,
  canGenerateImageHints,
  recommendRepresentativePages,
  representativePageReason,
} from "@/lib/reference/imageHints";
import type {
  ImageHint,
  ReferenceResult,
  ReferenceResultUpdater,
} from "@/lib/reference/types";
import {
  loadImageAssetBlob,
  saveImageAssetFromDataUrl,
} from "@/lib/state/imageAssetStore";
import { ErrorState } from "../shell/PageLayout";

// [이미지 힌트] 탭 (Step 11 + Step 19 + P7) — scale + 방향 + 프롬프트 표출.
// P7: 관련 없는 모든 섹션에 일괄 생성하지 않는다 — [섹션별 레퍼런스] 탭에서
// "새 이미지 필요"로 켜진 확정 섹션만 대상이며, 표지 키비주얼도 예외가 아니다.
// Step 19: NVIDIA_API_KEY가 설정되면 프롬프트로 실제 이미지 생성까지 지원.
// 키가 없으면 기존처럼 프롬프트 복사만 (버튼 비활성 + 안내).

interface ImageHintsTabProps {
  analysis: ProjectAnalysis;
  directives: ProjectDirective[];
  documentPurpose?: DocumentPurpose;
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

const SCALE_LABELS: Record<ImageHint["scale"], string> = {
  hero: "HERO (표지급)",
  section: "SECTION (섹션 삽화)",
  icon: "ICON (아이콘)",
};

const SCALE_COLORS: Record<ImageHint["scale"], string> = {
  hero: "var(--primary)",
  section: "var(--info)",
  icon: "var(--success)",
};

const DIRECTIONS = ["사진형", "미니멀 3D", "3D 렌더", "일러스트 2D", "라인 일러스트"];

export default function ImageHintsTab({
  analysis,
  directives,
  documentPurpose,
  references,
  onChange,
}: ImageHintsTabProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState<string>();
  const [refiningKey, setRefiningKey] = useState<string>();
  const [refineError, setRefineError] = useState<string>();

  // 이미지 실제 생성 (Step 19) — 서버에 키가 있어야 활성화
  const [genEnabled, setGenEnabled] = useState(false);
  const [generating, setGenerating] = useState<string>();
  const [genError, setGenError] = useState<string>();
  const [genErrorKey, setGenErrorKey] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/generate-image")
      .then((r) => r.json())
      .then((b) => {
        if (!cancelled) setGenEnabled(Boolean(b?.enabled));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 대표 페이지 — 추천값으로 초기화, 사용자 변경 가능. 추천 이유는 저장하지 않고
  // 매번 계산한다(§P0 검토 — 저장하면 사용자가 바꾼 뒤에도 낡은 문구가 남는다).
  const rep = references.representative ?? recommendRepresentativePages(analysis);
  const { visualReason, contentReason } = representativePageReason(analysis, rep);
  const selectedPages = analysis.pages.filter((p) => p.selected);
  const [splitRoles, setSplitRoles] = useState(rep.visualPageId !== rep.contentPageId);
  const showSplit = splitRoles || rep.visualPageId !== rep.contentPageId;

  // 템플릿 문서는 원본 이미지 무시가 기본 (실사용#20)
  const defaultMode: ImageHint["sourceReferenceMode"] =
    documentPurpose === "template-only"
      ? "text-only-ignore-source"
      : "use-source-image";
  const [sourceMode, setSourceMode] = useState(defaultMode);

  const setRep = (patch: Partial<typeof rep>) =>
    onChange((prev) => ({
      ...prev,
      representative: {
        ...(prev.representative ?? recommendRepresentativePages(analysis)),
        ...patch,
      },
    }));

  const selectedDirection = references.directionOptions?.find(
    (d) => d.directionId === references.selectedDirectionId,
  );
  const mood = references.moodOptions?.find((m) => m.id === selectedDirection?.moodOptionId);
  const avoidDirections = selectedDirection?.avoidDirections ?? [];
  const primaryColor =
    references.editedPaletteOption?.[references.paletteMode ?? "light"].primary;

  // 지금 조건(새 이미지 필요 + 확정 섹션)을 만족하는 스켈레톤 — 이 키 집합에 없는
  // 기존 힌트는 화면에서 숨긴다(섹션을 껐다고 데이터를 바로 지우진 않는다).
  const skeletons = buildHintSkeletons(analysis, references, mood);
  const requiredKeys = new Set(skeletons.map((s) => s.key));
  const visibleHints = (references.imageHints ?? []).filter((h) => requiredKeys.has(h.key));

  const gate = canGenerateImageHints(analysis, references);

  const generate = async () => {
    if (!gate.ok) return;
    setBusy(true);
    setError(undefined);
    try {
      const existingByKey = new Map((references.imageHints ?? []).map((h) => [h.key, h]));
      // 새로 체크됐거나 프롬프트가 비어 있는 힌트만 채운다 — 기존 편집값을
      // 전체 재생성이 덮어쓰지 않는다(§P0 검토).
      const toFill = skeletons.filter((s) => !existingByKey.get(s.key)?.prompt);
      if (toFill.length === 0) {
        setBusy(false);
        return;
      }
      const res = await fetch("/api/image-hints", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          skeletons: toFill,
          directives,
          moodKeywords: mood?.keywords ?? [],
          primaryColor,
          avoidDirections,
          sourceReferenceMode: sourceMode,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.prompts)) {
        throw new Error(body?.error ?? "프롬프트 생성에 실패했습니다.");
      }
      const built: ImageHint[] = toFill.map((s, i) => ({
        key: s.key,
        area: s.area,
        scale: s.scale,
        direction: s.direction,
        aspectRatio: s.aspectRatio,
        prompt: body.prompts[i] ?? "",
        sourceReferenceMode: sourceMode,
      }));
      onChange((prev) => {
        const merged = [...(prev.imageHints ?? [])];
        for (const hint of built) {
          const idx = merged.findIndex((h) => h.key === hint.key);
          if (idx >= 0) merged[idx] = { ...merged[idx], ...hint };
          else merged.push(hint);
        }
        return {
          ...prev,
          imageHints: merged,
          representative: prev.representative ?? rep,
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "프롬프트 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const patchHint = (key: string, patch: Partial<ImageHint>) =>
    onChange((prev) => ({
      ...prev,
      imageHints: (prev.imageHints ?? []).map((h) => (h.key === key ? { ...h, ...patch } : h)),
    }));

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(undefined), 1500);
  };

  // "프롬프트 다듬기" — /api/image-hints를 다시 호출해 이 힌트만 재작성한다.
  // 이미지 자체를 다시 만드는 generateOne(/api/generate-image)과는 별개 동작이다.
  const refinePrompt = async (hint: ImageHint) => {
    setRefiningKey(hint.key);
    setRefineError(undefined);
    try {
      const skeleton = skeletons.find((s) => s.key === hint.key);
      const res = await fetch("/api/image-hints", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          skeletons: [
            {
              area: hint.area,
              scale: hint.scale,
              direction: hint.direction,
              aspectRatio: hint.aspectRatio,
              contextSummary: skeleton?.contextSummary ?? hint.area,
              priorPrompt: hint.prompt,
            },
          ],
          directives,
          moodKeywords: mood?.keywords ?? [],
          primaryColor,
          avoidDirections,
          sourceReferenceMode: hint.sourceReferenceMode,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.prompts)) {
        throw new Error(body?.error ?? "프롬프트 다듬기에 실패했습니다.");
      }
      patchHint(hint.key, { prompt: body.prompts[0] ?? hint.prompt });
    } catch (e) {
      setRefineError(e instanceof Error ? e.message : "프롬프트 다듬기에 실패했습니다.");
    } finally {
      setRefiningKey(undefined);
    }
  };

  const generateOne = async (hint: ImageHint) => {
    setGenerating(hint.key);
    setGenError(undefined);
    setGenErrorKey(undefined);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: hint.prompt,
          aspectRatio: hint.aspectRatio,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || typeof body?.dataUrl !== "string") {
        throw new Error(body?.error ?? "이미지 생성에 실패했습니다.");
      }
      // data URL을 워크플로 상태에 직접 넣지 않는다(§6.6) — Blob store에 저장하고
      // assetId만 보관한다.
      const assetId = await saveImageAssetFromDataUrl(body.dataUrl);
      patchHint(hint.key, { generatedImageAssetId: assetId });
    } catch (e) {
      setGenError(
        e instanceof Error ? e.message : "이미지 생성에 실패했습니다.",
      );
      setGenErrorKey(hint.key);
    } finally {
      setGenerating(undefined);
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
          대표 페이지를 확인하고, [섹션별 레퍼런스] 탭에서 새 이미지가 필요한
          섹션을 체크한 뒤 힌트를 생성하세요
        </span>
      </div>

      {/* ── 대표 페이지 ── */}
      <div style={card}>
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>
          대표 페이지{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 14 }}>
            표지(첫인상)와 본문(정보구조)의 대표 페이지 — 컨셉서 구성에 사용
          </span>
        </h3>
        {!showSplit ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>표지·키비주얼 및 본문 레이아웃 기준 페이지</span>
              <select
                value={rep.visualPageId ?? ""}
                onChange={(e) => setRep({ visualPageId: e.target.value, contentPageId: e.target.value })}
                className="select-box"
              >
                {selectedPages.map((p) => (
                  <option key={p.pageId} value={p.pageId}>
                    {p.pageTitle} ({p.pageRole})
                  </option>
                ))}
              </select>
            </label>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{visualReason}</p>
            <button
              onClick={() => setSplitRoles(true)}
              className="btn-tertiary"
              style={{
                alignSelf: "flex-start",
                border: "none",
                padding: 0,
                fontSize: 13,
                fontWeight: 600,
                color: "var(--primary)",
              }}
            >
              역할별로 다르게 지정
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "var(--space-lg)", flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>표지·키비주얼 기준 페이지</span>
              <select
                value={rep.visualPageId ?? ""}
                onChange={(e) => setRep({ visualPageId: e.target.value })}
                className="select-box"
              >
                {selectedPages.map((p) => (
                  <option key={p.pageId} value={p.pageId}>
                    {p.pageTitle} ({p.pageRole})
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{visualReason}</span>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>본문 레이아웃 기준 페이지</span>
              <select
                value={rep.contentPageId ?? ""}
                onChange={(e) => setRep({ contentPageId: e.target.value })}
                className="select-box"
              >
                {selectedPages.map((p) => (
                  <option key={p.pageId} value={p.pageId}>
                    {p.pageTitle} ({p.pageRole})
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{contentReason}</span>
            </label>
          </div>
        )}
      </div>

      {/* ── 이미지 힌트 ── */}
      <div style={card}>
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>
          이미지 힌트{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 14 }}>
            [섹션별 레퍼런스] 탭에서 "새 이미지 필요"로 켠 확정 섹션만 대상 —
            프롬프트는 다른 생성 도구에 바로 사용 가능
          </span>
        </h3>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <input
            type="checkbox"
            checked={sourceMode === "text-only-ignore-source"}
            onChange={(e) =>
              setSourceMode(
                e.target.checked
                  ? "text-only-ignore-source"
                  : "use-source-image",
              )
            }
          />
          <span style={{ fontSize: 14 }}>
            원본 이미지 무시 — 텍스트 의미만으로 새로 구상
            {documentPurpose === "template-only" &&
              " (템플릿 문서라 기본 권장)"}
          </span>
        </label>
        <button
          onClick={generate}
          disabled={busy || !gate.ok}
          title={gate.ok ? undefined : gate.reason}
          className={references.imageHints ? "btn-weak-primary" : "btn-primary"}
          style={{
            alignSelf: "flex-start",
            padding: "10px var(--space-base)",
            borderRadius: "var(--radius-md)",
            border: "none",
            background: busy ? "var(--locked)" : undefined,
            color: busy ? "var(--on-primary)" : undefined,
            fontWeight: 600,
            fontSize: 14,
            opacity: !busy && !gate.ok ? 0.6 : 1,
          }}
        >
          {busy
            ? "프롬프트 생성 중…"
            : references.imageHints
              ? "다시 생성"
              : "이미지 힌트 생성"}
        </button>
        {!gate.ok && (
          <p style={{ fontSize: 13, color: "var(--warning-weak-text)" }}>{gate.reason}</p>
        )}
        {error && (
          <ErrorState
            title="이미지 힌트 생성에 실패했어요"
            detail={error}
            onRetry={generate}
          />
        )}
      </div>

      {visibleHints.map((h) => (
        <div key={h.key} style={{ ...card, padding: "var(--space-base)" }}>
          <b style={{ fontSize: 16 }}>{h.area}</b>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: SCALE_COLORS[h.scale],
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-full)",
                padding: "1px 10px",
              }}
            >
              {SCALE_LABELS[h.scale]}
            </span>
            <select
              value={h.direction}
              onChange={(e) => patchHint(h.key, { direction: e.target.value })}
              className="select-box"
            >
              {[...new Set([h.direction, ...DIRECTIONS])].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
              {h.aspectRatio}
            </span>
            {h.sourceReferenceMode === "text-only-ignore-source" && (
              <span style={{ fontSize: 14, color: "var(--warning-weak-text)" }}>
                원본 이미지 무시
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "flex-start" }}>
            <textarea
              value={h.prompt}
              onChange={(e) => patchHint(h.key, { prompt: e.target.value })}
              rows={3}
              style={{
                flex: 1,
                fontSize: 14,
                color: "var(--foreground)",
                fontFamily: "monospace",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "8px 12px",
                resize: "vertical",
              }}
              placeholder="(프롬프트 없음)"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button
                onClick={() => copy(h.key, h.prompt)}
                className="btn-tertiary"
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "6px 12px",
                  fontSize: 14,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {copied === h.key ? (
                  <Check size={16} color="var(--success)" />
                ) : (
                  <Copy size={16} color="var(--text-muted)" />
                )}
                {copied === h.key ? "복사됨" : "복사"}
              </button>
              <button
                onClick={() => refinePrompt(h)}
                disabled={refiningKey != null}
                title="편집한 내용과 방향 제외 키워드를 반영해 이 프롬프트만 다시 다듬습니다"
                className="btn-tertiary"
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "6px 12px",
                  fontSize: 14,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Wand2 size={16} color="var(--text-muted)" />
                {refiningKey === h.key ? "다듬는 중…" : "프롬프트 다듬기"}
              </button>
              <button
                onClick={() => generateOne(h)}
                disabled={!genEnabled || generating != null || !h.prompt}
                title={
                  genEnabled
                    ? "NVIDIA NIM으로 이 프롬프트의 이미지를 생성"
                    : "NVIDIA_API_KEY 미설정 — .env.local에 추가하면 활성화됩니다"
                }
                className="btn-weak-primary"
                style={{
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  padding: "6px 12px",
                  fontSize: 14,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  opacity: genEnabled ? 1 : 0.6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Sparkles size={16} color={genEnabled ? "var(--primary-hover)" : "var(--text-muted)"} />
                {generating === h.key
                  ? "생성 중…"
                  : h.generatedImageAssetId
                    ? "다시 생성"
                    : "이미지 생성"}
              </button>
            </div>
          </div>
          {refineError && refiningKey == null && (
            <ErrorState
              title="프롬프트 다듬기에 실패했어요"
              detail={refineError}
              onRetry={() => refinePrompt(h)}
            />
          )}
          {h.generatedImageAssetId && (
            <GeneratedImagePreview
              assetId={h.generatedImageAssetId}
              alt={`${h.area} 생성 이미지`}
            />
          )}
        </div>
      ))}
      {genError &&
        generating == null &&
        genErrorKey != null &&
        (() => {
          const failedHint = visibleHints.find((h) => h.key === genErrorKey);
          return failedHint ? (
            <ErrorState
              title="이미지 생성에 실패했어요"
              description="서버 응답이 지연되었거나 요청이 처리되지 않았을 수 있습니다."
              detail={genError}
              onRetry={() => generateOne(failedHint)}
            />
          ) : null;
        })()}
    </div>
  );
}

// Blob store(assetId)를 브라우저에서만 유효한 object URL로 비동기 해석해 렌더링한다.
// 언마운트/assetId 변경 시 이전 object URL은 반드시 해제한다(메모리 누수 방지).
function GeneratedImagePreview({ assetId, alt }: { assetId: string; alt: string }) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;
    setFailed(false);
    loadImageAssetBlob(assetId)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setFailed(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  if (failed) {
    return (
      <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
        생성 이미지를 불러오지 못했습니다. 다시 생성해 주세요.
      </p>
    );
  }
  if (!url) {
    return (
      <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
        이미지 불러오는 중…
      </p>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt={alt}
      style={{
        maxWidth: 480,
        width: "100%",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border)",
      }}
    />
  );
}
