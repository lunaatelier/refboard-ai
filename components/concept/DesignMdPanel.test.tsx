import "global-jsdom/register";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DesignMdPanel from "./DesignMdPanel";
import { mockConceptJson } from "@/lib/concept/mockConceptJson";
import type { ProjectAnalysis } from "@/lib/analysis/types";
import type { ConceptJson } from "@/lib/concept/types";

// 디자인 MD 화면 배선 검증 — 렌더러(designMd.test.ts) 자체는 이미 순수 함수로
// 검증돼 있으니, 여기서는 화면이 그 결과를 올바르게 보여주는지·안 바꾸기가
// 실제로 다른 안을 렌더링하는지·잘못된 데이터에서 화면이 안 깨지는지만 확인한다.

afterEach(cleanup);

const MINIMAL_ANALYSIS: ProjectAnalysis = {
  title: "가상 프로젝트",
  description: "설명",
  domain: "marketing-web",
  domainConfidence: 0.9,
  targetUser: "일반 사용자",
  tags: [],
  projectType: "랜딩페이지",
  pages: [],
};

describe("DesignMdPanel — 빈 상태", () => {
  it("analysis가 없으면 안내 문구만 보여준다", () => {
    render(<DesignMdPanel analysis={undefined} concept={mockConceptJson} />);
    assert.ok(screen.getByText(/컨셉 3안을 먼저 생성해야/));
  });

  it("concept.options가 비어 있으면(예: 재활용 모드 복원 데이터) 안내 문구만 보여준다", () => {
    const emptyConcept: ConceptJson = { ...mockConceptJson, options: [] };
    render(<DesignMdPanel analysis={MINIMAL_ANALYSIS} concept={emptyConcept} />);
    assert.ok(screen.getByText(/컨셉 3안을 먼저 생성해야/));
  });
});

describe("DesignMdPanel — 정상 렌더링", () => {
  it("기본으로 첫 번째 안(options[0])의 MD를 렌더링한다", () => {
    render(<DesignMdPanel analysis={MINIMAL_ANALYSIS} concept={mockConceptJson} />);
    const pre = document.querySelector("pre");
    assert.ok(pre, "결과 MD가 렌더링돼야 한다");
    assert.match(pre!.textContent ?? "", /mode: light/); // options[0] = A안, light
  });

  it("다른 안을 클릭하면 그 안의 MD로 다시 렌더링된다", () => {
    render(<DesignMdPanel analysis={MINIMAL_ANALYSIS} concept={mockConceptJson} />);
    fireEvent.click(screen.getByText("B안 — 다크 대시보드"));
    const pre = document.querySelector("pre");
    assert.match(pre!.textContent ?? "", /mode: dark/);
  });

  it("복사·다운로드 버튼이 노출된다", () => {
    render(<DesignMdPanel analysis={MINIMAL_ANALYSIS} concept={mockConceptJson} />);
    assert.ok(screen.getByText("복사"));
    assert.ok(screen.getByText(".md 다운로드"));
  });
});

describe("DesignMdPanel — 렌더 오류 처리", () => {
  it("팔레트 hex가 잘못된 안을 골라도 화면이 깨지지 않고 오류 안내만 보여준다", () => {
    const brokenOption = {
      ...mockConceptJson.options[0],
      designBasis: {
        ...mockConceptJson.options[0].designBasis,
        palette: {
          ...mockConceptJson.options[0].designBasis.palette,
          primary: "not-a-hex-color",
        },
      },
    };
    const brokenConcept: ConceptJson = { ...mockConceptJson, options: [brokenOption] };
    render(<DesignMdPanel analysis={MINIMAL_ANALYSIS} concept={brokenConcept} />);

    assert.ok(screen.getByText(/디자인 MD 생성에 실패했습니다/));
    assert.equal(document.querySelector("pre"), null, "실패 시 결과 블록은 렌더링되지 않아야 한다");
  });
});
