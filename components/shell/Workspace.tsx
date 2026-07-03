"use client";

import Lnb from "./Lnb";
import { STEP_LABELS, type Step, type WorkflowState } from "@/lib/state/workflow";

interface WorkspaceProps {
  state: WorkflowState;
  onNavigate: (step: Step) => void;
  onConfirmMasking: () => void; // Step 2 더미 — 실제 마스킹 확정은 Step 4에서 대체
}

function StepPanel({
  state,
  onConfirmMasking,
}: {
  state: WorkflowState;
  onConfirmMasking: () => void;
}) {
  const panelStyle: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 32,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    maxWidth: 720,
  };

  switch (state.currentStep) {
    case "upload":
      return (
        <div style={panelStyle}>
          <h2>① 업로드 (완료)</h2>
          <p style={{ color: "var(--text-muted)" }}>
            더미 문서가 업로드되었습니다. 좌측에서 마스킹 검수로 이동하세요.
          </p>
        </div>
      );
    case "masking":
      return (
        <div style={panelStyle}>
          <h2>② 마스킹 검수</h2>
          <p style={{ color: "var(--text-muted)" }}>
            탐지 리스트·검수 UI는 Step 3~4에서 구현됩니다. 지금은 더미 확정으로
            단계 가드 동작만 확인합니다.
          </p>
          {state.maskedText ? (
            <p style={{ color: "var(--success)", fontWeight: 600 }}>
              ✓ 마스킹 확정됨 — ③ 분석 결과가 잠금 해제되었습니다.
            </p>
          ) : (
            <button
              onClick={onConfirmMasking}
              style={{
                alignSelf: "flex-start",
                padding: "10px 20px",
                borderRadius: 10,
                border: "none",
                background: "var(--primary)",
                color: "#fff",
                fontWeight: 600,
              }}
            >
              마스킹 확정 (더미)
            </button>
          )}
        </div>
      );
    default:
      return (
        <div style={panelStyle}>
          <h2>{STEP_LABELS[state.currentStep]}</h2>
          <p style={{ color: "var(--text-muted)" }}>
            이 단계는 이후 Phase에서 구현됩니다. (분석 = Phase 2, 레퍼런스·무드 =
            Phase 3, 컨셉 = Phase 4, 디자인 MD = Phase 5)
          </p>
        </div>
      );
  }
}

export default function Workspace({
  state,
  onNavigate,
  onConfirmMasking,
}: WorkspaceProps) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Lnb state={state} onNavigate={onNavigate} />
      <main style={{ flex: 1, padding: 32 }}>
        <StepPanel state={state} onConfirmMasking={onConfirmMasking} />
      </main>
    </div>
  );
}
