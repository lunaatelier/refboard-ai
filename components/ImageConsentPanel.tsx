"use client";

import { useState } from "react";
import TokenText from "./TokenText";

// 이미지 opt-in 동의 (Step 9, flow-spec ①)
// 기본값 = 텍스트만. 체크(동의)한 이미지만 Gemini 멀티모달로 전송된다.

export interface ConsentImage {
  assetId: string;
  dataUrl: string;
  sourceSlide?: number;
  sensitivityHint: "none" | "possible" | "high";
}

export interface ImageInsight {
  assetId: string;
  maskedDescription: string;
}

interface ImageConsentPanelProps {
  images: ConsentImage[];
  insights: ImageInsight[];
  canAnalyze: boolean; // 마스킹 확정 후에만 true (재마스킹 시드 필요)
  busy: boolean;
  error?: string;
  onAnalyze: (assetIds: string[]) => void;
}

export default function ImageConsentPanel({
  images,
  insights,
  canAnalyze,
  busy,
  error,
  onAnalyze,
}: ImageConsentPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const insightFor = (id: string) =>
    insights.find((i) => i.assetId === id)?.maskedDescription;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 24,
        maxWidth: 860,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h3 style={{ fontSize: 15 }}>
        문서 속 이미지 {images.length}장 — 분석은 선택 사항입니다
      </h3>
      <p
        style={{
          color: "#92400e",
          background: "#fffbeb",
          border: "1px solid #f59e0b",
          borderRadius: 8,
          padding: "10px 14px",
        }}
      >
        이미지 분석을 선택하면 해당 이미지가 Gemini로 전송됩니다. 무료 Gemini는
        데이터를 학습에 쓸 수 있으니, <b>민감한 이미지는 체크하지 마세요.</b>{" "}
        기본값은 &ldquo;텍스트만 분석&rdquo;이며 체크한 이미지만 전송됩니다.
        분석 결과는 저장 전에 마스킹 엔진을 한 번 더 통과합니다.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {images.map((img) => {
          const insight = insightFor(img.assetId);
          return (
            <div
              key={img.assetId}
              style={{
                border: `1px solid ${selected.has(img.assetId) ? "var(--primary)" : "var(--border)"}`,
                borderRadius: 10,
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.dataUrl}
                alt={`이미지 ${img.assetId}`}
                style={{
                  width: "100%",
                  height: 110,
                  objectFit: "contain",
                  background: "var(--bg)",
                  borderRadius: 6,
                }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={selected.has(img.assetId)}
                  disabled={busy || !!insight}
                  onChange={(e) => toggle(img.assetId, e.target.checked)}
                />
                <span style={{ fontSize: 14 }}>
                  분석 동의
                  {img.sourceSlide != null && ` · 슬라이드 ${img.sourceSlide}`}
                </span>
              </label>
              {img.sensitivityHint === "possible" && !insight && (
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#b45309",
                    background: "#fef3c7",
                    borderRadius: 6,
                    padding: "1px 8px",
                    alignSelf: "flex-start",
                  }}
                >
                  민감 가능성 — 확인 필요
                </span>
              )}
              {insight && (
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  <TokenText text={insight} />
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => onAnalyze([...selected])}
          disabled={busy || selected.size === 0 || !canAnalyze}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background:
              busy || selected.size === 0 || !canAnalyze
                ? "var(--locked)"
                : "var(--primary)",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          {busy
            ? "이미지 분석 중…"
            : `동의한 ${selected.size}장 분석 (나머지는 전송 안 함)`}
        </button>
        {!canAnalyze && (
          <span style={{ color: "var(--text-muted)" }}>
            마스킹 확정 후 분석할 수 있습니다.
          </span>
        )}
      </div>
      {error && (
        <p role="alert" style={{ color: "#dc2626", fontWeight: 600 }}>
          {error}
        </p>
      )}
    </div>
  );
}
