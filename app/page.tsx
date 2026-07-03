"use client";

import { useRef, useState } from "react";
import AnalysisResult from "@/components/AnalysisResult";
import DictionaryManager from "@/components/DictionaryManager";
import MaskedPreview, { type MaskingStats } from "@/components/MaskedPreview";
import MaskingReview from "@/components/MaskingReview";
import LandingUpload from "@/components/shell/LandingUpload";
import Workspace from "@/components/shell/Workspace";
import { addDictionaryEntry, listDictionary } from "@/lib/dictionary/store";
import { finalizeMask } from "@/lib/masking/apply";
import { detect } from "@/lib/masking/detect";
import { maskFileName } from "@/lib/masking/filename";
import { detectNumeric } from "@/lib/masking/numeric";
import type {
  Detection,
  MaskMapping,
  NumericDetection,
} from "@/lib/masking/types";
import { parseViaServer } from "@/lib/parse/server";
import { isBrowserParsable, parseTextFile } from "@/lib/parse/txt";
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
  numericDetections: NumericDetection[];
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

  const [uploadError, setUploadError] = useState<string>();
  const [parsing, setParsing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>();

  const handleFile = async (file: File) => {
    setUploadError(undefined);
    setParsing(true);
    let text: string;
    try {
      // txt/md = 브라우저 파싱(원문이 PC를 안 떠남) / pdf·pptx = 자사 서버(메모리·무저장)
      text = isBrowserParsable(file.name)
        ? await parseTextFile(file)
        : await parseViaServer(file);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "파싱에 실패했습니다.");
      setParsing(false);
      return;
    }
    setParsing(false);
    if (!text.trim()) {
      setUploadError("추출된 텍스트가 없습니다. 텍스트가 포함된 문서인지 확인하세요.");
      return;
    }
    const dictionary = listDictionary();
    const detections = detect(text, dictionary);
    setDraft({
      parsedText: text,
      detections,
      numericDetections: detectNumeric(text, detections),
    });
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
      draft.numericDetections,
    );

    // 복원키 → SecureClientMemory (WorkflowState 아님)
    secureMappingsRef.current = mappings;

    const numericMasked = draft.numericDetections.filter(
      (n) => n.mode !== "keep",
    ).length;
    setMaskingStats({
      detected: draft.detections.length + draft.numericDetections.length,
      applied:
        draft.detections.filter((d) => d.enabled && !d.keepPlaintext).length +
        numericMasked,
      keptPlaintext:
        draft.detections.filter((d) => d.enabled && d.keepPlaintext).length +
        (draft.numericDetections.length - numericMasked),
    });

    setWorkflow((prev) => ({
      ...prev,
      maskedText,
      // "유지"로 확정된 공개 엔티티 → ④ 분석 대상 브랜드 소스 (실명 = 공개 정보)
      // 엔티티 등급(6종)은 검수 드롭다운에서 사용자가 확정한 값을 계승.
      extractedAnalysisTargets: draft.detections
        .filter(
          (d) =>
            d.enabled &&
            d.keepPlaintext &&
            (d.kind === "company" || d.kind === "client"),
        )
        .map((d) => ({
          name: d.raw,
          entityKind: d.entityKind ?? ("publicReference" as const),
        })),
      completedSteps: prev.completedSteps.includes("masking")
        ? prev.completedSteps
        : [...prev.completedSteps, "masking"],
    }));

    setDraft(null); // ← 원문·Detection[]·NumericDetection[](raw 포함) 즉시 폐기
  };

  const handleAnalyze = async () => {
    if (!workflow.maskedText) return;
    setAnalyzing(true);
    setAnalysisError(undefined);
    try {
      // 외부(Gemini)로는 maskedText + 유지 확정된 공개 엔티티 실명만 나간다
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          maskedText: workflow.maskedText,
          keptTargets: (workflow.extractedAnalysisTargets ?? []).map(
            (t) => t.name,
          ),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.analysis) {
        throw new Error(body?.error ?? "분석에 실패했습니다.");
      }
      setWorkflow((prev) => ({ ...prev, analysis: body.analysis }));
    } catch (e) {
      setAnalysisError(
        e instanceof Error ? e.message : "분석에 실패했습니다.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmAnalysis = () => {
    setWorkflow((prev) => {
      if (!prev.analysis) return prev;
      return {
        ...prev,
        // 확정 게이트: 남긴 후보 섹션을 confirmed로 전환 (Phase 3 입력 자격)
        analysis: {
          ...prev.analysis,
          pages: prev.analysis.pages.map((p) => ({
            ...p,
            sections: p.sections.map((s) => ({
              ...s,
              status: "confirmed" as const,
            })),
          })),
        },
        completedSteps: prev.completedSteps.includes("analysis")
          ? prev.completedSteps
          : [...prev.completedSteps, "analysis"],
        currentStep: "reference",
      };
    });
  };

  if (isLanding) {
    return (
      <LandingUpload
        onFile={handleFile}
        error={uploadError}
        parsing={parsing}
      />
    );
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
              numericDetections={draft.numericDetections}
              onUpdateDetections={(next) =>
                setDraft((prev) => prev && { ...prev, detections: next })
              }
              onUpdateNumeric={(next) =>
                setDraft(
                  (prev) => prev && { ...prev, numericDetections: next },
                )
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

      {workflow.currentStep === "analysis" &&
        (workflow.analysis ? (
          <AnalysisResult
            analysis={workflow.analysis}
            onChange={(next) =>
              setWorkflow((prev) => ({ ...prev, analysis: next }))
            }
            onConfirm={handleConfirmAnalysis}
          />
        ) : (
          <Panel title="③ 분석 결과">
            <p style={{ color: "var(--text-muted)" }}>
              마스킹된 텍스트를 Gemini로 분석합니다. 외부로는 마스킹본과
              &ldquo;유지&rdquo;로 확정한 공개 엔티티 실명만 전송됩니다.
            </p>
            {workflow.extractedAnalysisTargets &&
              workflow.extractedAnalysisTargets.length > 0 && (
                <p style={{ color: "var(--text-muted)" }}>
                  유지된 분석 대상:{" "}
                  {workflow.extractedAnalysisTargets
                    .map((t) => t.name)
                    .join(", ")}
                </p>
              )}
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              style={{
                alignSelf: "flex-start",
                padding: "12px 24px",
                borderRadius: 10,
                border: "none",
                background: analyzing ? "var(--locked)" : "var(--primary)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              {analyzing ? "분석 중… (수십 초 걸릴 수 있음)" : "분석 시작"}
            </button>
            {analysisError && (
              <p role="alert" style={{ color: "#dc2626", fontWeight: 600 }}>
                {analysisError}
              </p>
            )}
          </Panel>
        ))}

      {workflow.currentStep !== "upload" &&
        workflow.currentStep !== "masking" &&
        workflow.currentStep !== "analysis" && (
          <Panel title={STEP_LABELS[workflow.currentStep]}>
            <p style={{ color: "var(--text-muted)" }}>
              이 단계는 이후 Phase에서 구현됩니다. (레퍼런스·무드 = Phase 3,
              컨셉 = Phase 4, 디자인 MD = Phase 5)
            </p>
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
