"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import ImageHintsTab from "./ImageHintsTab";
import PaletteMoodTab from "./PaletteMoodTab";
import SectionRefsTab from "./SectionRefsTab";
import TargetsTab from "./TargetsTab";
import type { DocumentPurpose } from "@/lib/analysis/documentPurpose";
import { pickBackgroundColorRequirement } from "@/lib/analysis/requirements";
import type { ProjectAnalysis, ProjectDirective } from "@/lib/analysis/types";
import type { ExtractedAnalysisTarget } from "@/lib/masking/types";
import { generatePaletteOptions } from "@/lib/reference/palette";
import type { ReferenceResult, ReferenceResultUpdater } from "@/lib/reference/types";
import PageLayout, { PageCta } from "../shell/PageLayout";

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
  onChange: (next: ReferenceResultUpdater) => void;
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
        paletteOptions: generatePaletteOptions(
          analysis.brandColors,
          pickBackgroundColorRequirement(analysis.explicitRequirements),
        ),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageLayout title="레퍼런스·무드">
      <div
        style={{
          display: "flex",
          gap: "var(--space-sm)",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => t.ready && setTab(t.id)}
            disabled={!t.ready}
            style={{
              padding: "var(--space-sm) var(--space-base)",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: tab === t.id ? "var(--canvas)" : "var(--surface-alt)",
              color: !t.ready
                ? "var(--locked)"
                : tab === t.id
                  ? "var(--foreground)"
                  : "var(--text-muted)",
              boxShadow: tab === t.id ? "var(--shadow-subtle)" : "none",
              fontSize: 14,
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

      {(() => {
        const selectionComplete = Boolean(
          references.editedPaletteOption && references.selectedMoodId,
        );
        const disabled = !selectionComplete || references.referenceConfirmed;
        return (
          <PageCta
            onClick={onConfirm}
            disabled={disabled}
            locked={disabled}
            title={
              !selectionComplete
                ? "컬러·무드 탭에서 방향 1안을 먼저 선택하세요"
                : undefined
            }
          >
            {references.referenceConfirmed && <Check size={16} color="var(--on-primary)" />}
            {references.referenceConfirmed ? "레퍼런스·무드 확정됨" : "다음"}
          </PageCta>
        );
      })()}
    </PageLayout>
  );
}
