"use client";

import { useState } from "react";
import LandingUpload from "@/components/shell/LandingUpload";
import Workspace from "@/components/shell/Workspace";
import { canAccessStep } from "@/lib/state/guards";
import {
  initialWorkflowState,
  type Step,
  type WorkflowState,
} from "@/lib/state/workflow";

// 랜딩 ↔ 워크스페이스는 라우트 이동이 아니라 같은 페이지 상태 전환.
// 메모리(민감 데이터 포함)를 유지하기 위한 구조 (CLAUDE.md §8).
export default function Home() {
  const [state, setState] = useState<WorkflowState>(initialWorkflowState);

  const isLanding =
    state.currentStep === "upload" && !state.completedSteps.includes("upload");

  const handleUpload = () => {
    // Step 2 더미: 업로드 완료 처리 후 마스킹 단계로 전환.
    // 실제 파싱(parsedText → SecureClientMemory)은 Step 4에서 연결.
    setState((prev) => ({
      ...prev,
      completedSteps: [...prev.completedSteps, "upload"],
      currentStep: "masking",
    }));
  };

  const handleNavigate = (target: Step) => {
    // UI 잠금(버튼 disabled)과 별개로 로직에서도 가드 검증 (이중 방어)
    setState((prev) =>
      canAccessStep(target, prev) ? { ...prev, currentStep: target } : prev,
    );
  };

  const handleConfirmMasking = () => {
    // Step 2 더미: maskedText를 채워 보안 게이트를 통과시킨다.
    // 실제 Draft→Final 변환·parsedText 폐기는 Step 4에서 구현.
    setState((prev) => ({
      ...prev,
      maskedText: "[더미] 마스킹된 텍스트",
      completedSteps: prev.completedSteps.includes("masking")
        ? prev.completedSteps
        : [...prev.completedSteps, "masking"],
      currentStep: "analysis",
    }));
  };

  if (isLanding) {
    return <LandingUpload onUpload={handleUpload} />;
  }

  return (
    <Workspace
      state={state}
      onNavigate={handleNavigate}
      onConfirmMasking={handleConfirmMasking}
    />
  );
}
