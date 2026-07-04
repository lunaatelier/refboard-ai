"use client";

import { useEffect, useState } from "react";
import type { DocumentPurpose } from "@/lib/analysis/documentPurpose";
import type { ProjectAnalysis, ProjectDirective } from "@/lib/analysis/types";
import {
  buildHintSkeletons,
  recommendRepresentativePages,
} from "@/lib/reference/imageHints";
import type { ImageHint, ReferenceResult } from "@/lib/reference/types";

// [이미지 힌트] 탭 (Step 11 + Step 19) — scale + 방향 + 프롬프트 표출.
// Step 19: NVIDIA_API_KEY가 설정되면 프롬프트로 실제 이미지 생성까지 지원.
// 키가 없으면 기존처럼 프롬프트 복사만 (버튼 비활성 + 안내).

interface ImageHintsTabProps {
  analysis: ProjectAnalysis;
  directives: ProjectDirective[];
  documentPurpose?: DocumentPurpose;
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

const SCALE_LABELS: Record<ImageHint["scale"], string> = {
  hero: "HERO (표지급)",
  section: "SECTION (섹션 삽화)",
  icon: "ICON (아이콘)",
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
  const [copied, setCopied] = useState<number>();

  // 이미지 실제 생성 (Step 19) — 서버에 키가 있어야 활성화
  const [genEnabled, setGenEnabled] = useState(false);
  const [generating, setGenerating] = useState<number>();
  const [genError, setGenError] = useState<string>();

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

  // 대표 페이지 — 추천값으로 초기화, 사용자 변경 가능
  const rep =
    references.representative ?? recommendRepresentativePages(analysis);
  const selectedPages = analysis.pages.filter((p) => p.selected);

  // 템플릿 문서는 원본 이미지 무시가 기본 (실사용#20)
  const defaultMode: ImageHint["sourceReferenceMode"] =
    documentPurpose === "template-only"
      ? "text-only-ignore-source"
      : "use-source-image";
  const [sourceMode, setSourceMode] = useState(defaultMode);

  const setRep = (patch: Partial<typeof rep>) =>
    onChange({ ...references, representative: { ...rep, ...patch } });

  const generate = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const mood = references.moodOptions?.find(
        (m) => m.id === references.selectedMoodId,
      );
      const skeletons = buildHintSkeletons(analysis, mood);
      const res = await fetch("/api/image-hints", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          skeletons,
          directives,
          moodKeywords: mood?.keywords ?? [],
          primaryColor:
            references.editedPaletteOption?.[references.paletteMode ?? "light"]
              .primary,
          sourceReferenceMode: sourceMode,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.prompts)) {
        throw new Error(body?.error ?? "프롬프트 생성에 실패했습니다.");
      }
      const hints: ImageHint[] = skeletons.map((s, i) => ({
        area: s.area,
        scale: s.scale,
        direction: s.direction,
        aspectRatio: s.aspectRatio,
        prompt: body.prompts[i] ?? "",
        sourceReferenceMode: sourceMode,
      }));
      onChange({ ...references, imageHints: hints, representative: rep });
    } catch (e) {
      setError(e instanceof Error ? e.message : "프롬프트 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const patchHint = (index: number, patch: Partial<ImageHint>) =>
    onChange({
      ...references,
      imageHints: (references.imageHints ?? []).map((h, i) =>
        i === index ? { ...h, ...patch } : h,
      ),
    });

  const copy = async (index: number, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(undefined), 1500);
  };

  const generateOne = async (index: number, hint: ImageHint) => {
    setGenerating(index);
    setGenError(undefined);
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
      patchHint(index, { generatedImageUrl: body.dataUrl });
    } catch (e) {
      setGenError(
        e instanceof Error ? e.message : "이미지 생성에 실패했습니다.",
      );
    } finally {
      setGenerating(undefined);
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
          👉 대표 페이지를 확인하고, 이미지 힌트를 생성해 다른 생성 도구에
          쓸 프롬프트를 준비하세요
        </span>
      </div>

      {/* ── 대표 페이지 (표지 ≠ 대표) ── */}
      <div style={card}>
        <h3 style={{ fontSize: 15 }}>
          대표 페이지 추천{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
            표지(첫인상)와 내용 대표(정보구조)를 분리합니다 — 컨셉서 구성에
            사용
          </span>
        </h3>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {(
            [
              ["visualPageId", "시각 대표 (키비주얼·표지)"],
              ["contentPageId", "내용 대표 (정보구조·섹션 배치)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
              <select
                value={rep[key] ?? ""}
                onChange={(e) => setRep({ [key]: e.target.value })}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  font: "inherit",
                }}
              >
                {selectedPages.map((p) => (
                  <option key={p.pageId} value={p.pageId}>
                    {p.pageTitle} ({p.pageRole})
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      {/* ── 이미지 힌트 ── */}
      <div style={card}>
        <h3 style={{ fontSize: 15 }}>
          이미지 힌트{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
            도메인+무드로 타입·스케일 자동 판정 — 프롬프트는 다른 생성 도구에
            바로 사용 가능
          </span>
        </h3>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
          disabled={busy}
          style={{
            alignSelf: "flex-start",
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: busy ? "var(--locked)" : "var(--primary)",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          {busy
            ? "프롬프트 생성 중…"
            : references.imageHints
              ? "다시 생성"
              : "이미지 힌트 생성"}
        </button>
        {error && (
          <p role="alert" style={{ color: "#dc2626", fontWeight: 600 }}>
            {error}
          </p>
        )}
      </div>

      {(references.imageHints ?? []).map((h, i) => (
        <div key={i} style={{ ...card, padding: 16 }}>
          <b style={{ fontSize: 16 }}>{h.area}</b>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color:
                  h.scale === "hero"
                    ? "#7c3aed"
                    : h.scale === "section"
                      ? "#0e7490"
                      : "#16a34a",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 999,
                padding: "1px 10px",
              }}
            >
              {SCALE_LABELS[h.scale]}
            </span>
            <select
              value={h.direction}
              onChange={(e) => patchHint(i, { direction: e.target.value })}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                font: "inherit",
                fontSize: 14,
              }}
            >
              {[...new Set([h.direction, ...DIRECTIONS])].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {h.aspectRatio}
            </span>
            {h.sourceReferenceMode === "text-only-ignore-source" && (
              <span style={{ fontSize: 13, color: "#b45309" }}>
                원본 이미지 무시
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <p
              style={{
                flex: 1,
                fontSize: 14,
                color: "var(--text-muted)",
                fontFamily: "monospace",
                background: "var(--bg)",
                borderRadius: 8,
                padding: "8px 12px",
              }}
            >
              {h.prompt || "(프롬프트 없음)"}
            </p>
            <button
              onClick={() => copy(i, h.prompt)}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "6px 12px",
                background: "transparent",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
              }}
            >
              {copied === i ? "✓ 복사됨" : "📋 복사"}
            </button>
            <button
              onClick={() => generateOne(i, h)}
              disabled={!genEnabled || generating != null || !h.prompt}
              title={
                genEnabled
                  ? "NVIDIA NIM으로 이 프롬프트의 이미지를 생성"
                  : "NVIDIA_API_KEY 미설정 — .env.local에 추가하면 활성화됩니다"
              }
              style={{
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "6px 12px",
                background: "transparent",
                fontSize: 14,
                fontWeight: 600,
                color: genEnabled ? "var(--primary)" : "var(--text-muted)",
                whiteSpace: "nowrap",
                opacity: genEnabled ? 1 : 0.6,
              }}
            >
              {generating === i
                ? "생성 중…"
                : h.generatedImageUrl
                  ? "🎨 다시 생성"
                  : "🎨 이미지 생성"}
            </button>
          </div>
          {h.generatedImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={h.generatedImageUrl}
              alt={`${h.area} 생성 이미지`}
              style={{
                maxWidth: 480,
                width: "100%",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            />
          )}
        </div>
      ))}
      {genError && generating == null && (
        <p role="alert" style={{ color: "#dc2626", fontWeight: 600 }}>
          {genError}
        </p>
      )}
    </div>
  );
}
