"use client";

import { canAccessStep } from "@/lib/state/guards";
import {
  STEP_LABELS,
  STEP_ORDER,
  type Step,
  type WorkflowState,
} from "@/lib/state/workflow";

interface LnbProps {
  state: WorkflowState;
  onNavigate: (step: Step) => void;
}

type StepStatus = "done" | "current" | "available" | "locked";

function stepStatus(step: Step, state: WorkflowState): StepStatus {
  if (step === state.currentStep) return "current";
  if (state.completedSteps.includes(step)) return "done";
  return canAccessStep(step, state) ? "available" : "locked";
}

const STATUS_ICON: Record<StepStatus, string> = {
  done: "✓",
  current: "●",
  available: "○",
  locked: "●",
};

export default function Lnb({ state, onNavigate }: LnbProps) {
  return (
    <nav
      aria-label="진행 단계"
      style={{
        width: 220,
        flexShrink: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        padding: "24px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          padding: "0 12px 16px",
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        RefBoard AI
      </div>
      {STEP_ORDER.map((step, i) => {
        const status = stepStatus(step, state);
        const locked = status === "locked";
        return (
          <button
            key={step}
            onClick={() => onNavigate(step)}
            disabled={locked}
            aria-current={status === "current" ? "step" : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "10px 12px",
              border: "none",
              borderRadius: 8,
              textAlign: "left",
              background:
                status === "current" ? "var(--primary-soft)" : "transparent",
              color: locked
                ? "var(--locked)"
                : status === "current"
                  ? "var(--primary)"
                  : "var(--text)",
              fontWeight: status === "current" ? 700 : 400,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 20,
                textAlign: "center",
                color:
                  status === "done"
                    ? "var(--success)"
                    : status === "current"
                      ? "var(--primary)"
                      : "inherit",
              }}
            >
              {STATUS_ICON[status]}
            </span>
            <span>
              {i + 1}. {STEP_LABELS[step]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
