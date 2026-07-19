import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { derivePageBoardSummary, resolvePageBoardSummary } from "./pageBoard";
import type { Page, ProjectAnalysis } from "../analysis/types";

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    pageId: "p1",
    pageTitle: "홈",
    pageRole: "cover",
    selected: true,
    sections: [
      {
        sectionId: "s1",
        sectionTitle: "히어로",
        contentSummary: "[회사A] 소개",
        contentType: "hero",
        recommendedLayout: "hero",
        status: "confirmed",
      },
      {
        sectionId: "s2",
        sectionTitle: "후보",
        contentSummary: "아직 확정 안 됨",
        contentType: "feature",
        recommendedLayout: "card-grid",
        status: "candidate",
      },
    ],
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<ProjectAnalysis> = {}): ProjectAnalysis {
  return {
    title: "테스트 프로젝트",
    description: "설명",
    domain: "marketing-web",
    domainConfidence: 0.9,
    targetUser: "30대 직장인",
    tags: [],
    projectType: "랜딩페이지",
    pages: [],
    ...overrides,
  };
}

describe("derivePageBoardSummary — Page 원본을 건드리지 않고 로컬 파생", () => {
  it("pageRole별 목적 템플릿을 반환한다", () => {
    const s = derivePageBoardSummary(makePage({ pageRole: "cover" }), makeAnalysis());
    assert.equal(s.purposeSummary, "첫인상과 핵심 가치 제안 전달");
  });

  it("핵심 대상은 ProjectAnalysis.targetUser를 그대로 쓴다", () => {
    const s = derivePageBoardSummary(makePage(), makeAnalysis({ targetUser: "40대 자영업자" }));
    assert.equal(s.audienceSummary, "40대 자영업자");
  });

  it("targetUser가 비어있으면 안내 문구로 대체된다", () => {
    const s = derivePageBoardSummary(makePage(), makeAnalysis({ targetUser: "" }));
    assert.equal(s.audienceSummary, "지정된 타겟 없음");
  });

  it("확정 섹션 수는 candidate를 제외하고 센다", () => {
    const s = derivePageBoardSummary(makePage(), makeAnalysis());
    assert.equal(s.confirmedSectionCount, 1);
  });

  it("콘텐츠 요약은 확정 섹션의 contentSummary만 이어붙인다", () => {
    const s = derivePageBoardSummary(makePage(), makeAnalysis());
    assert.equal(s.contentSummary, "[회사A] 소개");
    assert.ok(!s.contentSummary.includes("아직 확정 안 됨"));
  });

  it("확정 섹션이 없으면 안내 문구를 반환한다", () => {
    const page = makePage({
      sections: [
        {
          sectionId: "s1",
          sectionTitle: "후보",
          contentSummary: "아직",
          contentType: "feature",
          recommendedLayout: "card-grid",
          status: "candidate",
        },
      ],
    });
    const s = derivePageBoardSummary(page, makeAnalysis());
    assert.equal(s.contentSummary, "확정된 섹션이 없습니다.");
    assert.equal(s.confirmedSectionCount, 0);
  });

  it("등록되지 않은 pageRole은 기본 문구로 대체된다(방어적)", () => {
    const page = makePage({ pageRole: "unknown-role" as never });
    const s = derivePageBoardSummary(page, makeAnalysis());
    assert.equal(s.purposeSummary, "정보 전달");
  });
});

describe("resolvePageBoardSummary — 사용자 덮어쓰기 우선", () => {
  it("override가 있으면 파생값 대신 override를 쓴다", () => {
    const s = resolvePageBoardSummary(makePage(), makeAnalysis(), {
      purposeSummary: "직접 쓴 목적",
      audienceSummary: "직접 쓴 대상",
    });
    assert.equal(s.purposeSummary, "직접 쓴 목적");
    assert.equal(s.audienceSummary, "직접 쓴 대상");
  });

  it("override가 없으면 파생값을 그대로 쓴다", () => {
    const s = resolvePageBoardSummary(makePage(), makeAnalysis(), undefined);
    assert.equal(s.purposeSummary, "첫인상과 핵심 가치 제안 전달");
  });

  it("override의 일부 필드만 있어도 나머지는 파생값을 유지한다", () => {
    const s = resolvePageBoardSummary(makePage(), makeAnalysis(), {
      purposeSummary: "직접 쓴 목적",
    });
    assert.equal(s.purposeSummary, "직접 쓴 목적");
    assert.equal(s.audienceSummary, "30대 직장인"); // 파생값 유지
  });

  it("confirmedSectionCount/contentSummary는 override 대상이 아니다(항상 파생값)", () => {
    const s = resolvePageBoardSummary(makePage(), makeAnalysis(), {
      purposeSummary: "직접 쓴 목적",
    });
    assert.equal(s.confirmedSectionCount, 1);
    assert.equal(s.contentSummary, "[회사A] 소개");
  });
});
