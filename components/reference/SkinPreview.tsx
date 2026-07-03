"use client";

import type { MoodOption, Palette } from "@/lib/reference/types";

// 스킨 프리뷰 (Step 10-a) — 팔레트·무드 선택이 샘플 UI(내비/카드/버튼)에 즉각 반영.
// 순서 원칙: 팔레트·무드 확정 → 스킨 적용 (CLAUDE.md Phase 3 내부 순서).

interface SkinPreviewProps {
  palette: Palette;
  mood?: MoodOption;
}

export default function SkinPreview({ palette, mood }: SkinPreviewProps) {
  const radius = mood?.styleAttributes.radius === "sharp" ? 2 : 12;
  const gap = mood?.styleAttributes.density === "compact" ? 8 : 16;

  return (
    <div
      style={{
        background: palette.background,
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: palette.navigation,
          padding: "10px 16px",
          display: "flex",
          gap: 16,
          alignItems: "center",
          borderBottom: `1px solid ${palette.surface}`,
        }}
      >
        <span style={{ color: palette.primary, fontWeight: 700 }}>Logo</span>
        <span style={{ color: palette.text, opacity: 0.8, fontSize: 14 }}>메뉴</span>
        <span style={{ color: palette.text, opacity: 0.5, fontSize: 14 }}>메뉴</span>
      </div>
      <div style={{ padding: gap, display: "flex", flexDirection: "column", gap }}>
        <div
          style={{
            background: palette.surface,
            borderRadius: radius,
            padding: gap,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <span style={{ color: palette.text, fontWeight: 700 }}>
            카드 제목
          </span>
          <span style={{ color: palette.text, opacity: 0.7, fontSize: 14 }}>
            본문 텍스트 샘플입니다. {mood?.styleAttributes.typographyNote ?? ""}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <span
              style={{
                background: palette.primary,
                color: palette.background,
                borderRadius: radius,
                padding: "6px 14px",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              주요 버튼
            </span>
            <span
              style={{
                background: palette.accent,
                color: palette.background,
                borderRadius: radius,
                padding: "6px 14px",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              포인트 CTA
            </span>
            <span
              style={{
                border: `1px solid ${palette.secondary}`,
                color: palette.secondary,
                borderRadius: radius,
                padding: "6px 14px",
                fontSize: 14,
              }}
            >
              보조
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
