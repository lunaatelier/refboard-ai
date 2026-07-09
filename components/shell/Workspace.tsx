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
    <div className="workspace-shell" style={{ background: "var(--bg)" }}>
      <Lnb state={state} onNavigate={onNavigate} />
      <main
        className="workspace-main"
        style={{
          flex: 1,
          minWidth: 0,
          padding: 40,
          maxWidth: 1600,
          width: "100%",
          margin: "0 auto",
        }}
      >
        {children}
      </main>
    </div>
  );
}
