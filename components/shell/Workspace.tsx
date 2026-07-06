"use client";

import Lnb from "./Lnb";
import type { Step, WorkflowState } from "@/lib/state/workflow";

interface WorkspaceProps {
  state: WorkflowState;
  onNavigate: (step: Step) => void;
  children: React.ReactNode; // 현재 단계의 작업 영역 (page.tsx가 결정)
}

export default function Workspace({
  state,
  onNavigate,
  children,
}: WorkspaceProps) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Lnb state={state} onNavigate={onNavigate} />
      <main
        style={{
          flex: 1,
          padding: "var(--space-xl)",
          maxWidth: 1200,
          width: "100%",
          margin: "0 auto",
        }}
      >
        {children}
      </main>
    </div>
  );
}
