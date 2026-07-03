"use client";

import type { ConceptOption, ConceptPage, ConceptSection } from "@/lib/concept/types";
import type { Palette } from "@/lib/reference/types";

// HTML 미리보기 (Step 12-a) — Concept JSON의 클라이언트 렌더러 1호.
// 픽셀 완벽이 아니라 "정보구조·레이아웃·톤"이 보이는 수준 (보안 > 픽셀, CLAUDE.md §4.5).

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

function SectionBlock({ s, p }: { s: ConceptSection; p: Palette }) {
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
        <div style={{ ...base, padding: 32, alignItems: "center", textAlign: "center", background: `linear-gradient(135deg, ${p.primary}22, ${p.accent}22)` }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: p.text }}>{s.sectionTitle}</span>
          <span style={{ color: p.text, opacity: 0.75, maxWidth: 480 }}>{content}</span>
          <span style={{ background: p.accent, color: p.background, borderRadius: 8, padding: "8px 20px", fontWeight: 700, fontSize: 14 }}>CTA</span>
        </div>
      );
    case /timeline/.test(s.layoutPattern):
      return (
        <div style={base}>
          {title}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {content.split(/[.。]\s*/).filter(Boolean).slice(0, 4).map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: p.primary, marginTop: 5, flexShrink: 0 }} />
                <span style={{ color: p.text, opacity: 0.8, fontSize: 14 }}>{line}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case /stat/.test(s.layoutPattern):
      return (
        <div style={base}>
          {title}
          <div style={{ display: "flex", gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ flex: 1, background: p.background, borderRadius: 8, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: p.primary }}>—</div>
                <div style={{ fontSize: 12, color: p.secondary }}>지표 {i}</div>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 13, color: p.secondary }}>{content}</span>
        </div>
      );
    case /table/.test(s.layoutPattern):
      return (
        <div style={base}>
          {title}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2, fontSize: 13 }}>
            {["항목", "A", "B", "…", "…", "…"].map((c, i) => (
              <div key={i} style={{ background: i < 3 ? p.primary + "22" : p.background, color: p.text, padding: "6px 10px", fontWeight: i < 3 ? 700 : 400 }}>
                {c}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 13, color: p.secondary }}>{content}</span>
        </div>
      );
    default: // card-grid 등
      return (
        <div style={base}>
          {title}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ background: p.background, borderRadius: 8, padding: 10, minHeight: 56 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: p.accent, marginBottom: 6 }} />
                <div style={{ fontSize: 12, color: p.secondary }}>카드 {i}</div>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 13, color: p.secondary }}>{content}</span>
        </div>
      );
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

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: p.background }}>
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
            <SectionBlock key={s.sectionId} s={s} p={p} />
          ))}
          {page.sections.length === 0 && (
            <p style={{ color: p.secondary, fontSize: 14 }}>이 페이지에 매핑된 섹션이 없습니다.</p>
          )}
        </div>
      </div>
      <div style={{ background: p.surface, padding: "8px 16px", fontSize: 12, color: p.secondary }}>
        {option.keyVisual.imageTone} · {option.keyVisual.illustrationStyle} · 배경: {option.keyVisual.backgroundPattern}
      </div>
    </div>
  );
}
