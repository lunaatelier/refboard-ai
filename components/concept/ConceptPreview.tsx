"use client";

import {
  extractStat,
  splitChips,
  splitContentItems,
} from "@/lib/concept/previewContent";
import type { ConceptOption, ConceptPage, ConceptSection } from "@/lib/concept/types";
import type { MoodImage, Palette } from "@/lib/reference/types";

// HTML 미리보기 (Step 12-a, P9-B) — Concept JSON의 클라이언트 렌더러 1호.
// 픽셀 완벽이 아니라 "정보구조·레이아웃·톤"이 보이는 수준 (보안 > 픽셀, CLAUDE.md §4.5).
// 카드·지표·표는 고정 개수 플레이스홀더가 아니라 실제 maskedContent를 의미 단위로
// 쪼갠 결과다 — 구조화된 값(숫자 등)을 못 찾은 자리에만 "데이터 없음"을 보여준다.

const FALLBACK: Record<"light" | "dark", Palette> = {
  light: {
    mode: "light", primary: "#2563EB", secondary: "#64748B", accent: "#0EA5E9",
    background: "#FFFFFF", surface: "#F7F8FA", text: "#1C1F24", navigation: "#FFFFFF",
  },
  dark: {
    mode: "dark", primary: "#5B8DEF", secondary: "#8B95A5", accent: "#38BDF8",
    background: "#0F1115", surface: "#171A21", text: "#E8EAED", navigation: "#12151B",
  },
};

function NoDataBadge({ p }: { p: Palette }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: p.secondary,
        background: `${p.secondary}22`,
        borderRadius: 999,
        padding: "2px 8px",
        alignSelf: "flex-start",
      }}
    >
      데이터 없음
    </span>
  );
}

function SectionBlock({
  s,
  p,
  moodImage,
}: {
  s: ConceptSection;
  p: Palette;
  moodImage?: MoodImage;
}) {
  const base: React.CSSProperties = {
    background: p.surface,
    borderRadius: 10,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };
  const title = (
    <span style={{ fontWeight: 700, color: p.text }}>
      {s.sectionTitle}{" "}
      <span style={{ fontSize: 12, color: p.secondary, fontWeight: 400 }}>
        {s.layoutPattern} · {s.contentMapping.targetArea}
      </span>
    </span>
  );
  const content = s.contentMapping.maskedContent;

  switch (true) {
    case /hero/.test(s.layoutPattern):
      return (
        <div
          style={{
            ...base,
            padding: 32,
            alignItems: "center",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
            background: moodImage
              ? p.background
              : `linear-gradient(135deg, ${p.primary}22, ${p.accent}22)`,
          }}
        >
          {moodImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={moodImage.url}
              alt={moodImage.attribution}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.32,
              }}
            />
          )}
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 20, fontWeight: 700, color: p.text }}>{s.sectionTitle}</span>
            <span style={{ color: p.text, opacity: 0.75, maxWidth: 480 }}>{content}</span>
            <span style={{ background: p.accent, color: p.background, borderRadius: 8, padding: "8px 20px", fontWeight: 700, fontSize: 14 }}>CTA</span>
          </div>
        </div>
      );
    case /timeline/.test(s.layoutPattern): {
      const items = splitContentItems(content, 4);
      return (
        <div style={base}>
          {title}
          {items.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: p.primary, marginTop: 5, flexShrink: 0 }} />
                  <span style={{ color: p.text, opacity: 0.8, fontSize: 14 }}>{line}</span>
                </div>
              ))}
            </div>
          ) : (
            <NoDataBadge p={p} />
          )}
        </div>
      );
    }
    case /stat/.test(s.layoutPattern): {
      const stats = splitContentItems(content, 3).map(extractStat);
      return (
        <div style={base}>
          {title}
          {stats.length > 0 ? (
            <div style={{ display: "flex", gap: 10 }}>
              {stats.map((stat, i) => (
                <div key={i} style={{ flex: 1, background: p.background, borderRadius: 8, padding: 12, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  {stat.value ? (
                    <div style={{ fontSize: 18, fontWeight: 700, color: p.primary }}>{stat.value}</div>
                  ) : (
                    <NoDataBadge p={p} />
                  )}
                  <div style={{ fontSize: 12, color: p.secondary }}>{stat.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <NoDataBadge p={p} />
          )}
        </div>
      );
    }
    case /table/.test(s.layoutPattern): {
      const rows = splitContentItems(content, 4).map((chunk) => {
        const [label, ...rest] = chunk.split(/[:：]\s*/);
        return rest.length > 0
          ? { label: label.trim(), value: rest.join(": ").trim() }
          : { label: chunk, value: "" };
      });
      return (
        <div style={base}>
          {title}
          {rows.length > 0 ? (
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
                overflow: "hidden",
                border: `1px solid ${p.secondary}33`,
                borderRadius: 8,
                background: p.background,
                color: p.text,
                fontSize: 13,
              }}
            >
              <thead>
                <tr>
                  {["항목", "내용"].map((c) => (
                    <th key={c} style={{ padding: "6px 10px", background: `${p.primary}22`, color: p.text, fontWeight: 700, textAlign: "left" }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: "6px 10px", borderTop: `1px solid ${p.secondary}22`, fontWeight: 600 }}>
                      {row.label}
                    </td>
                    <td style={{ padding: "6px 10px", borderTop: `1px solid ${p.secondary}22` }}>
                      {row.value || <NoDataBadge p={p} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <NoDataBadge p={p} />
          )}
        </div>
      );
    }
    case /tech-stack|diagram/.test(s.layoutPattern): {
      const chips = splitChips(content, 6);
      return (
        <div style={base}>
          {title}
          {chips.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {chips.map((chip, i) => (
                <span key={i} style={{ background: p.background, border: `1px solid ${p.secondary}33`, borderRadius: 999, padding: "4px 12px", fontSize: 13, color: p.text }}>
                  {chip}
                </span>
              ))}
            </div>
          ) : (
            <NoDataBadge p={p} />
          )}
        </div>
      );
    }
    case /carousel|marquee/.test(s.layoutPattern): {
      const items = splitContentItems(content, 5);
      return (
        <div style={base}>
          {title}
          {items.length > 0 ? (
            <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
              {items.map((item, i) => (
                <div key={i} style={{ flex: "0 0 auto", minWidth: 120, maxWidth: 160, background: p.background, borderRadius: 8, padding: 10, fontSize: 13, color: p.text }}>
                  {item}
                </div>
              ))}
            </div>
          ) : (
            <NoDataBadge p={p} />
          )}
        </div>
      );
    }
    default: { // card-grid 등
      const items = splitContentItems(content, 4);
      return (
        <div style={base}>
          {title}
          {items.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, 1fr)`, gap: 8 }}>
              {items.map((item, i) => (
                <div key={i} style={{ background: p.background, borderRadius: 8, padding: 10, minHeight: 56, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: p.accent }} />
                  <div style={{ fontSize: 12, color: p.secondary }}>{item}</div>
                </div>
              ))}
            </div>
          ) : (
            <NoDataBadge p={p} />
          )}
        </div>
      );
    }
  }
}

interface ConceptPreviewProps {
  option: ConceptOption;
  page: ConceptPage;
  palette?: Palette; // 확정 팔레트 (모드는 option.uiStructure.mode 따름)
}

export default function ConceptPreview({ option, page, palette }: ConceptPreviewProps) {
  const mode = option.uiStructure.mode;
  const p: Palette = palette
    ? { ...palette, mode }
    : FALLBACK[mode];
  const sideNav = option.uiStructure.navPosition === "left";
  const moodImage = option.designBasis.moodImages?.[0];
  const avoidDirections = option.designBasis.avoidDirections ?? [];

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: p.background }}>
      <div style={{ display: "flex", flexDirection: sideNav ? "row" : "column" }}>
        <div
          style={{
            background: p.navigation,
            padding: sideNav ? "16px 12px" : "10px 20px",
            display: "flex",
            flexDirection: sideNav ? "column" : "row",
            gap: 14,
            alignItems: sideNav ? "stretch" : "center",
            width: sideNav ? 140 : undefined,
            flexShrink: 0,
            borderRight: sideNav ? `1px solid ${p.surface}` : undefined,
            borderBottom: sideNav ? undefined : `1px solid ${p.surface}`,
          }}
        >
          <span style={{ color: p.primary, fontWeight: 800 }}>Logo</span>
          {option.pages.slice(0, 4).map((pg) => (
            <span key={pg.pageId} style={{ color: p.text, opacity: pg.pageId === page.pageId ? 1 : 0.5, fontSize: 13, fontWeight: pg.pageId === page.pageId ? 700 : 400 }}>
              {pg.pageTitle}
            </span>
          ))}
        </div>
        <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {page.sections.map((s) => (
            <SectionBlock
              key={s.sectionId}
              s={s}
              p={p}
              moodImage={/hero/.test(s.layoutPattern) ? moodImage : undefined}
            />
          ))}
          {page.sections.length === 0 && (
            <p style={{ color: p.secondary, fontSize: 14 }}>이 페이지에 매핑된 섹션이 없습니다.</p>
          )}
        </div>
      </div>
      <div style={{ background: p.surface, padding: "var(--space-sm) var(--space-base)", fontSize: 14, color: p.secondary }}>
        {option.keyVisual.imageTone} · {option.keyVisual.illustrationStyle} · 배경: {option.keyVisual.backgroundPattern}
        {avoidDirections.length > 0 && <> · 금지: {avoidDirections.join(", ")}</>}
      </div>
    </div>
  );
}
