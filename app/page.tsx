"use client";

import { useRef, useState } from "react";
import DictionaryManager from "@/components/DictionaryManager";
import MaskedPreview, { type MaskingStats } from "@/components/MaskedPreview";
import MaskingReview from "@/components/MaskingReview";
import LandingUpload from "@/components/shell/LandingUpload";
import Workspace from "@/components/shell/Workspace";
import { addDictionaryEntry, listDictionary } from "@/lib/dictionary/store";
import { finalizeMask } from "@/lib/masking/apply";
import { detect } from "@/lib/masking/detect";
import { maskFileName } from "@/lib/masking/filename";
import type { Detection, MaskMapping } from "@/lib/masking/types";
import { parseTextFile } from "@/lib/parse/txt";
import { canAccessStep } from "@/lib/state/guards";
import {
  initialWorkflowState,
  STEP_LABELS,
  type Step,
  type WorkflowState,
} from "@/lib/state/workflow";

// 검수 중 임시 상태 — 원문(parsedText)과 raw 포함 Detection[].
// ⚠️ 민감 등급: 이 상태는 확정 즉시 통째로 폐기된다. 영속화·전송 절대 금지.
interface DraftState {
  parsedText: string;
  detections: Detection[];
}

export default function Home() {
  const [workflow, setWorkflow] = useState<WorkflowState>(initialWorkflowState);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [fileDisplayName, setFileDisplayName] = useState<string>();
  const [maskingStats, setMaskingStats] = useState<MaskingStats>();

  // SecureClientMemory — 복원키. 메모리에만 존재, 새로고침 시 소멸 (CLAUDE.md §4.4).
  // React 상태가 아닌 ref: 렌더 데이터로 흘러들어가는 것을 구조적으로 차단.
  const secureMappingsRef = useRef<MaskMapping[]>([]);

  const isLanding =
    workflow.currentStep === "upload" &&
    !workflow.completedSteps.includes("upload");

  const handleFile = async (file: File) => {
    const text = await parseTextFile(file); // 브라우저 파싱 — 서버 호출 없음
    const dictionary = listDictionary();
    setDraft({ parsedText: text, detections: detect(text, dictionary) });
    // 원본 파일명도 마스킹 (실사용#32) — 화면에는 displayName만
    setFileDisplayName(maskFileName(file.name, dictionary).displayName);
    setWorkflow((prev) => ({
      ...prev,
      completedSteps: prev.completedSteps.includes("upload")
        ? prev.completedSteps
        : [...prev.completedSteps, "upload"],
      currentStep: "masking",
      maskedText: undefined, // 재업로드 시 이전 마스킹 무효화
      extractedAnalysisTargets: undefined,
    }));
    setMaskingStats(undefined);
    secureMappingsRef.current = [];
  };

  const handleNavigate = (target: Step) => {
    // UI 잠금(버튼 disabled)과 별개로 로직에서도 가드 검증 (이중 방어)
    setWorkflow((prev) =>
      canAccessStep(target, prev) ? { ...prev, currentStep: target } : prev,
    );
  };

  const handleConfirmMasking = () => {
    if (!draft) return;
    const { maskedText, mappings } = finalizeMask(
      draft.parsedText,
      draft.detections,
    );

    // 복원키 → SecureClientMemory (WorkflowState 아님)
    secureMappingsRef.current = mappings;

    setMaskingStats({
      detected: draft.detections.length,
      applied: draft.detections.filter((d) => d.enabled && !d.keepPlaintext)
        .length,
      keptPlaintext: draft.detections.filter(
        (d) => d.enabled && d.keepPlaintext,
      ).length,
    });

    setWorkflow((prev) => ({
      ...prev,
      maskedText,
      // "유지"로 확정된 공개 엔티티 → ④ 분석 대상 브랜드 소스 (실명 = 공개 정보)
      // Step 4는 2분 토글이라 등급은 publicReference로 통일, 6종 세분화는 Step 6.
      extractedAnalysisTargets: draft.detections
        .filter(
          (d) =>
            d.enabled &&
            d.keepPlaintext &&
            (d.kind === "company" || d.kind === "client"),
        )
        .map((d) => ({ name: d.raw, entityKind: "publicReference" as const })),
      completedSteps: prev.completedSteps.includes("masking")
        ? prev.completedSteps
        : [...prev.completedSteps, "masking"],
    }));

    setDraft(null); // ← 원문·Detection[](raw 포함) 즉시 폐기
  };

  if (isLanding) {
    return <LandingUpload onFile={handleFile} />;
  }

  return (
    <Workspace state={workflow} onNavigate={handleNavigate}>
      {workflow.currentStep === "upload" && (
        <Panel title="① 업로드 (완료)">
          <p style={{ color: "var(--text-muted)" }}>
            업로드된 파일: <b>{fileDisplayName ?? "(알 수 없음)"}</b>
          </p>
          <p style={{ color: "var(--text-muted)" }}>
            다른 문서로 시작하려면 새로고침하세요. (메모리의 원문·복원키가 모두
            소멸됩니다)
          </p>
        </Panel>
      )}

      {workflow.currentStep === "masking" &&
        (draft ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <MaskingReview
              parsedText={draft.parsedText}
              detections={draft.detections}
              onUpdateDetections={(next) =>
                setDraft((prev) => prev && { ...prev, detections: next })
              }
              onAddToDictionary={(value, kind) => {
                addDictionaryEntry(value, kind);
              }}
              onConfirm={handleConfirmMasking}
            />
            <DictionaryManager />
          </div>
        ) : workflow.maskedText ? (
          <MaskedPreview
            maskedText={workflow.maskedText}
            stats={maskingStats}
            onNext={() => handleNavigate("analysis")}
          />
        ) : (
          <Panel title="② 마스킹 검수">
            <p style={{ color: "var(--text-muted)" }}>
              검수할 문서가 없습니다. 문서를 먼저 업로드하세요.
            </p>
          </Panel>
        ))}

      {workflow.currentStep !== "upload" &&
        workflow.currentStep !== "masking" && (
          <Panel title={STEP_LABELS[workflow.currentStep]}>
            <p style={{ color: "var(--text-muted)" }}>
              이 단계는 이후 Phase에서 구현됩니다. (분석 = Phase 2,
              레퍼런스·무드 = Phase 3, 컨셉 = Phase 4, 디자인 MD = Phase 5)
            </p>
            {workflow.currentStep === "analysis" &&
              workflow.extractedAnalysisTargets &&
              workflow.extractedAnalysisTargets.length > 0 && (
                <p style={{ color: "var(--text-muted)" }}>
                  마스킹에서 유지된 분석 대상:{" "}
                  {workflow.extractedAnalysisTargets
                    .map((t) => t.name)
                    .join(", ")}
                </p>
              )}
          </Panel>
        )}
    </Workspace>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 32,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        maxWidth: 860,
      }}
    >
      <h2>{title}</h2>
      {children}
    </div>
  );
}
