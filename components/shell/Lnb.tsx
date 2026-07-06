"use client";

import { Check, Lock } from "lucide-react";
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

export default function Lnb({ state, onNavigate }: LnbProps) {
  return (
    <nav
      aria-label="진행 단계"
      style={{
        width: 240,
        flexShrink: 0,
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        height: "100vh",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        padding: "var(--space-lg) var(--space-md)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xs)",
      }}
    >
      <div
        style={{
          padding: "0 var(--space-md) var(--space-base)",
          fontWeight: 700,
          fontSize: 18,
          color: "var(--text)",
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
            title={locked ? "이전 단계를 먼저 완료하세요" : undefined}
            data-lnb-status={status}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-sm)",
              width: "100%",
              minHeight: 44,
              padding: "10px var(--space-md)",
              border: "none",
              borderRadius: "var(--radius-md)",
              textAlign: "left",
              background:
                status === "current" ? "var(--primary-soft)" : undefined,
              color: locked
                ? "var(--locked)"
                : status === "current"
                  ? "var(--primary-hover)"
                  : "var(--text-strong)",
              fontWeight: 600,
              fontSize: 14,
              cursor: locked ? "not-allowed" : "pointer",
              transition: "background 150ms ease",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 20,
                height: 20,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {status === "done" ? (
                <Check size={18} color="var(--success)" strokeWidth={2} />
              ) : status === "locked" ? (
                <Lock size={16} color="var(--locked)" strokeWidth={1.75} />
              ) : status === "current" ? (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "var(--radius-full)",
                    background: "var(--primary)",
                  }}
                />
              ) : (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "var(--radius-full)",
                    border: "1.5px solid var(--border-strong)",
                  }}
                />
              )}
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
