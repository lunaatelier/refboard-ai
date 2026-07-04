"use client";

import { useEffect, useState } from "react";
import ImageHintsTab from "./ImageHintsTab";
import PaletteMoodTab from "./PaletteMoodTab";
import SectionRefsTab from "./SectionRefsTab";
import TargetsTab from "./TargetsTab";
import type { DocumentPurpose } from "@/lib/analysis/documentPurpose";
import type { ProjectAnalysis, ProjectDirective } from "@/lib/analysis/types";
import type { ExtractedAnalysisTarget } from "@/lib/masking/types";
import { generatePaletteOptions } from "@/lib/reference/palette";
import type { ReferenceResult } from "@/lib/reference/types";

// ④ 레퍼런스·무드 (Step 10) — 정보량이 많아 탭으로 분할, 세로 무한 스크롤 금지 (flow-spec ④).
// 10-a: [컬러·무드] / 10-b: [섹션별 레퍼런스] / 10-c: [분석 대상 브랜드]

type TabId = "palette-mood" | "section-refs" | "targets" | "image-hints";

const TABS: { id: TabId; label: string; ready: boolean }[] = [
  { id: "palette-mood", label: "컬러·무드", ready: true },
  { id: "section-refs", label: "섹션별 레퍼런스", ready: true },
  { id: "targets", label: "분석 대상 브랜드", ready: true },
  { id: "image-hints", label: "이미지 힌트", ready: true },
];

interface ReferenceWorkspaceProps {
  analysis: ProjectAnalysis;
  directives: ProjectDirective[];
  extractedTargets: ExtractedAnalysisTarget[];
  documentPurpose?: DocumentPurpose;
  references: ReferenceResult;
  onChange: (next: ReferenceResult) => void;
  onConfirm: () => void;
}

export default function ReferenceWorkspace({
  analysis,
  directives,
  extractedTargets,
  documentPurpose,
  references,
  onChange,
  onConfirm,
}: ReferenceWorkspaceProps) {
  const [tab, setTab] = useState<TabId>("palette-mood");

  // 팔레트 3세트는 로컬 생성(외부 호출 없음)이라 진입 시 자동 준비
  useEffect(() => {
    if (!references.paletteOptions) {
      onChange({
        ...references,
        paletteOptions: generatePaletteOptions(analysis.brandColors),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 960 }}>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "16px 24px",
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ marginRight: 8 }}>레퍼런스·무드</h2>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => t.ready && setTab(t.id)}
            disabled={!t.ready}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: `1px solid ${tab === t.id ? "var(--primary)" : "var(--border)"}`,
              background: tab === t.id ? "var(--primary-soft)" : "transparent",
              color: !t.ready
                ? "var(--locked)"
                : tab === t.id
                  ? "var(--primary)"
                  : "var(--text)",
              fontWeight: 600,
            }}
          >
            {t.label}
            {!t.ready && " (준비 중)"}
          </button>
        ))}
      </div>

      {tab === "palette-mood" && (
        <PaletteMoodTab
          analysis={analysis}
          directives={directives}
          references={references}
          onChange={onChange}
        />
      )}
      {tab === "section-refs" && (
        <SectionRefsTab
          analysis={analysis}
          directives={directives}
          references={references}
          onChange={onChange}
        />
      )}
      {tab === "targets" && (
        <TargetsTab
          analysis={analysis}
          directives={directives}
          extractedTargets={extractedTargets}
          references={references}
          onChange={onChange}
        />
      )}
      {tab === "image-hints" && (
        <ImageHintsTab
          analysis={analysis}
          directives={directives}
          documentPurpose={documentPurpose}
          references={references}
          onChange={onChange}
        />
      )}

      <button
        onClick={onConfirm}
        disabled={!references.paletteConfirmed || references.referenceConfirmed}
        title={
          !references.paletteConfirmed
            ? "컬러·무드 탭에서 팔레트·무드를 먼저 확정하세요"
            : undefined
        }
        style={{
          alignSelf: "flex-start",
          padding: "12px 24px",
          borderRadius: 10,
          border: "none",
          background:
            !references.paletteConfirmed || references.referenceConfirmed
              ? "var(--locked)"
              : "var(--primary)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        {references.referenceConfirmed
          ? "✓ 레퍼런스·무드 확정됨"
          : "다음"}
      </button>
    </div>
  );
}
