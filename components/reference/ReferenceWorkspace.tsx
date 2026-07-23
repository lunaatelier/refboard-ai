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

const WORKFLOW_GUIDE: { id: TabId; title: string; description: string }[] = [
  {
    id: "palette-mood",
    title: "1. 전체 디자인 방향",
    description: "문서 전체에 사용할 색상과 분위기 1안을 선택합니다.",
  },
  {
    id: "section-refs",
    title: "2. 핵심 섹션 참고 사례",
    description: "중요한 화면만 사례를 찾고 적용 여부를 결정합니다.",
  },
  {
    id: "targets",
    title: "3. 비교 브랜드 (선택)",
    description: "참고하거나 피할 브랜드가 있을 때만 정리합니다.",
  },
  {
    id: "image-hints",
    title: "4. 새 이미지 계획 (선택)",
    description: "새 이미지가 필요한 섹션의 생성 방향을 확인합니다.",
  },
  {
    id: "review",
    title: "5. 최종 확인",
    description: "빠진 필수 결정을 확인한 뒤 이 단계를 확정합니다.",
  },
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

      <section
        aria-label="레퍼런스·무드 사용 순서"
        style={{
          padding: "var(--space-base)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--surface)",
          display: "grid",
          gap: "var(--space-sm)",
        }}
      >
        <div>
          <strong style={{ display: "block", marginBottom: 4 }}>
            무엇을 해야 하나요?
          </strong>
          <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
            아래 순서대로 진행하세요. 1·2는 핵심 작업이고, 3·4는 필요한 경우에만
            확인하면 됩니다.
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "var(--space-sm)",
          }}
        >
          {WORKFLOW_GUIDE.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => setTab(step.id)}
              aria-current={tab === step.id ? "step" : undefined}
              style={{
                padding: "var(--space-sm)",
                border: `1px solid ${
                  tab === step.id ? "var(--primary)" : "var(--border)"
                }`,
                borderRadius: "var(--radius-md)",
                background:
                  tab === step.id ? "var(--primary-soft)" : "var(--canvas)",
                color: "var(--foreground)",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <strong style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                {step.title}
              </strong>
              <span
                style={{
                  display: "block",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
              >
                {step.description}
              </span>
            </button>
          ))}
        </div>
      </section>

      {tab === "palette-mood" && (
        <PaletteMoodTab
          analysis={analysis}
          directives={directives}
          references={references}
          onChange={onChange}
          projectId={projectId}
        />
      )}
      {tab === "section-refs" && (
        <SectionRefsTab
          analysis={analysis}
          directives={directives}
          references={references}
          onChange={onChange}
          projectId={projectId}
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
