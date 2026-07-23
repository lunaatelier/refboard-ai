import "global-jsdom/register";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ReferenceWorkspace from "./ReferenceWorkspace";
import type { ProjectAnalysis } from "@/lib/analysis/types";
import type {
  Palette,
  PaletteOption,
  ReferenceResult,
  ReferenceResultUpdater,
} from "@/lib/reference/types";

// P2.1 — evaluateReviewStatus 자체는 이미 reviewStatus.test.ts에서 순수 함수로
// 검증돼 있다(재검증 안 함). 여기서는 그 판정 결과가 실제 확정 버튼의 disabled 상태·
// 클릭 동작에 올바르게 배선됐는지만 확인한다 — 배선 버그(예: disabled={canConfirm}처럼
// 부호가 뒤집힌 실수)는 순수 함수 테스트로는 못 잡는다.

afterEach(cleanup);

const MINIMAL_ANALYSIS: ProjectAnalysis = {
  title: "가상 프로젝트",
  description: "설명",
  domain: "marketing-web",
  domainConfidence: 0.9,
  targetUser: "일반 사용자",
  tags: [],
  projectType: "랜딩페이지",
  pages: [], // 페이지가 없으면 섹션별 필수 이슈 로직 자체가 안 돈다 — canConfirm은
  // 오직 direction(팔레트·방향) 선택 여부로만 결정된다.
};

function makePalette(mode: "light" | "dark"): Palette {
  return {
    mode,
    primary: "#2563EB",
    secondary: "#64748B",
    accent: "#F97316",
    background: mode === "light" ? "#FFFFFF" : "#0F172A",
    surface: mode === "light" ? "#F8FAFC" : "#1E293B",
    text: mode === "light" ? "#0F172A" : "#F8FAFC",
    navigation: "#1E293B",
  };
}

const SOME_PALETTE_OPTION: PaletteOption = {
  optionId: "trust",
  label: "신뢰형",
  light: makePalette("light"),
  dark: makePalette("dark"),
};

function Harness({
  initialReferences,
  onConfirm,
}: {
  initialReferences: ReferenceResult;
  onConfirm: () => void;
}) {
  const [references, setReferences] = useState<ReferenceResult>(initialReferences);
  const onChange = (next: ReferenceResultUpdater) =>
    setReferences((prev) => (typeof next === "function" ? next(prev) : next));
  return (
    <ReferenceWorkspace
      analysis={MINIMAL_ANALYSIS}
      directives={[]}
      extractedTargets={[]}
      references={references}
      onChange={onChange}
      onConfirm={onConfirm}
    />
  );
}

function goToReviewTab() {
  fireEvent.click(screen.getByText("결정 검토"));
}

describe("ReferenceWorkspace — 확정 버튼 배선", () => {
  it("필수 결정(방향)이 없으면 확정 버튼이 비활성 상태다", () => {
    render(<Harness initialReferences={{}} onConfirm={() => {}} />);
    goToReviewTab();

    const button = screen.getByRole("button", { name: /레퍼런스·무드 확정/ }) as HTMLButtonElement;
    assert.equal(button.disabled, true);
  });

  it("필수 결정을 채우면 확정 버튼이 활성화되고, 클릭 시 onConfirm이 호출된다", () => {
    let confirmCalls = 0;
    render(
      <Harness
        initialReferences={{
          editedPaletteOption: SOME_PALETTE_OPTION,
          selectedDirectionId: "direction-1",
        }}
        onConfirm={() => {
          confirmCalls += 1;
        }}
      />,
    );
    goToReviewTab();

    const button = screen.getByRole("button", { name: /레퍼런스·무드 확정/ }) as HTMLButtonElement;
    assert.equal(button.disabled, false);

    fireEvent.click(button);
    assert.equal(confirmCalls, 1, "클릭하면 onConfirm이 정확히 한 번 호출돼야 한다");
  });
});
