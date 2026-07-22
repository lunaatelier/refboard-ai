"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import ImageHintsTab from "./ImageHintsTab";
import PaletteMoodTab from "./PaletteMoodTab";
import ReviewTab from "./ReviewTab";
import SectionRefsTab from "./SectionRefsTab";
import TargetsTab from "./TargetsTab";
import type { DocumentPurpose } from "@/lib/analysis/documentPurpose";
import { pickBackgroundColorRequirement } from "@/lib/analysis/requirements";
import type { ProjectAnalysis, ProjectDirective } from "@/lib/analysis/types";
import type { ExtractedAnalysisTarget } from "@/lib/masking/types";
import { generatePaletteOptions } from "@/lib/reference/palette";
import { evaluateReviewStatus } from "@/lib/reference/reviewStatus";
import type { ReferenceResult, ReferenceResultUpdater } from "@/lib/reference/types";
import PageLayout, { PageCta } from "../shell/PageLayout";

// ④ 레퍼런스·무드 (Step 10) — 정보량이 많아 탭으로 분할, 세로 무한 스크롤 금지 (flow-spec ④).
// 10-a: [컬러·무드] / 10-b: [섹션별 레퍼런스] / 10-c: [분석 대상 브랜드] / 10-d: [결정 검토](P8)

type TabId = "palette-mood" | "section-refs" | "targets" | "image-hints" | "review";

const TABS: { id: TabId; label: string; ready: boolean }[] = [
  { id: "palette-mood", label: "컬러·무드", ready: true },
  { id: "section-refs", label: "섹션별 레퍼런스", ready: true },
  { id: "targets", label: "분석 대상 브랜드", ready: true },
  { id: "image-hints", label: "이미지 힌트", ready: true },
  { id: "review", label: "결정 검토", ready: true },
];

interface ReferenceWorkspaceProps {
  analysis: ProjectAnalysis;
  directives: ProjectDirective[];
  extractedTargets: ExtractedAnalysisTarget[];
  documentPurpose?: DocumentPurpose;
  references: ReferenceResult;
  onChange: (next: ReferenceResultUpdater) => void;
  onConfirm: () => void;
  projectId?: string;
}

export default function ReferenceWorkspace({
  analysis,
  directives,
  extractedTargets,
  documentPurpose,
  references,
  onChange,
  onConfirm,
  projectId,
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
          projectId={projectId}
        />
      )}
      {tab === "image-hints" && (
        <ImageHintsTab
          analysis={analysis}
          directives={directives}
          documentPurpose={documentPurpose}
          references={references}
          onChange={onChange}
          projectId={projectId}
        />
      )}
      {tab === "review" && (
        <ReviewTab
          analysis={analysis}
          references={references}
          onChange={onChange}
          onNavigateTab={setTab}
        />
      )}

      {(() => {
        // 다른 탭에서는 검토 화면으로 이동만 시킨다 — 레퍼런스 수집·브랜드 분석
        // 자체를 의무화하지 않는다(P8). 실제 확정/재확정 버튼은 검토 탭에서만
        // 등장하고, evaluateReviewStatus의 필수 미결정(canConfirm)만 막는다.
        if (tab !== "review") {
          return <PageCta onClick={() => setTab("review")}>결정 검토로 이동</PageCta>;
        }
        const status = evaluateReviewStatus(analysis, references);
        const alreadyConfirmed = Boolean(references.confirmedBrief) && !status.priorConfirmationStale;
        const disabled = !status.canConfirm || alreadyConfirmed;
        return (
          <PageCta
            onClick={onConfirm}
            disabled={disabled}
            locked={disabled}
            title={!status.canConfirm ? "필수 미결정 항목을 먼저 해결하세요" : undefined}
          >
            {alreadyConfirmed && <Check size={16} color="var(--on-primary)" />}
            {alreadyConfirmed
              ? "레퍼런스·무드 확정됨"
              : references.confirmedBrief
                ? "재확정"
                : "레퍼런스·무드 확정"}
          </PageCta>
        );
      })()}
    </PageLayout>
  );
}
