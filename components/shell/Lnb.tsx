"use client";

import { useState } from "react";
import { Check, Lock, Menu, X } from "lucide-react";
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
  const accessible = canAccessStep(step, state);
  if (!accessible) return "locked";
  if (state.completedSteps.includes(step)) return "done";
  return "available";
}

// 1024px 미만(모바일·태블릿)에서는 고정 사이드바 대신 상단 바 + 슬라이드 드로어로
// 전환한다 (app/globals.css §11의 브레이크포인트와 짝을 이룬다).
export default function Lnb({ state, onNavigate }: LnbProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentIndex = STEP_ORDER.indexOf(state.currentStep);

  const stepButtons = (onNavigated?: () => void) =>
    STEP_ORDER.map((step, i) => {
      const status = stepStatus(step, state);
      const locked = status === "locked";
      return (
        <button
          key={step}
          onClick={() => {
            onNavigate(step);
            onNavigated?.();
          }}
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
            background: status === "current" ? "var(--primary-soft)" : undefined,
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
    });

  return (
    <>
      {/* 데스크톱 — 고정 사이드바 (≥1024px) */}
      <nav
        aria-label="진행 단계"
        className="lnb-sidebar"
        style={{
          width: 240,
          flexShrink: 0,
          position: "sticky",
          top: 0,
          alignSelf: "flex-start",
          height: "100vh",
          background: "var(--canvas)",
          borderRight: "1px solid var(--border)",
          padding: "var(--space-lg) var(--space-md)",
          flexDirection: "column",
          gap: "var(--space-xs)",
        }}
      >
        <div
          style={{
            padding: "0 var(--space-md) var(--space-base)",
            fontWeight: 700,
            fontSize: 18,
            color: "var(--foreground)",
          }}
        >
          RefBoard AI
        </div>
        {stepButtons()}
      </nav>

      {/* 모바일·태블릿 — 상단 바 (<1024px) */}
      <div
        className="lnb-mobile-bar"
        style={{
          alignItems: "center",
          gap: "var(--space-sm)",
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "var(--canvas)",
          borderBottom: "1px solid var(--border)",
          padding: "var(--space-sm) var(--space-base)",
        }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="진행 단계 메뉴 열기"
          className="btn-icon-neutral"
        >
          <Menu size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 16, color: "var(--foreground)" }}>
          RefBoard AI
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--primary-hover)",
            background: "var(--primary-soft)",
            borderRadius: "var(--radius-full)",
            padding: "4px 12px",
            whiteSpace: "nowrap",
          }}
        >
          {currentIndex + 1}. {STEP_LABELS[state.currentStep]}
        </span>
      </div>

      {/* 모바일·태블릿 — 슬라이드 드로어 (열렸을 때만) */}
      {mobileOpen && (
        <>
          <div
            className="lnb-backdrop"
            onClick={() => setMobileOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "var(--scrim)",
              zIndex: 30,
            }}
          />
          <nav
            aria-label="진행 단계"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              width: 260,
              maxWidth: "80vw",
              zIndex: 31,
              background: "var(--canvas)",
              padding: "var(--space-lg) var(--space-md)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-xs)",
              overflowY: "auto",
              boxShadow: "var(--shadow-modal)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 var(--space-md) var(--space-base)",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 18, color: "var(--foreground)" }}>
                RefBoard AI
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="메뉴 닫기"
                className="btn-icon-neutral"
              >
                <X size={20} />
              </button>
            </div>
            {stepButtons(() => setMobileOpen(false))}
          </nav>
        </>
      )}
    </>
  );
}
