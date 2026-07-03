import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSourceMaterial } from "../ai/exclusion";
import { buildAnalysisPrompt, buildDirectiveBlock } from "../ai/prompts";
import { classifyDocumentPurpose } from "./documentPurpose";
import { normalizeAnalysis } from "./normalize";
import type { ProjectAnalysis } from "./types";

describe("normalizeAnalysis — Gemini 응답 정규화", () => {
  it("ID 부여·enum 보정·기본 5페이지 선택·후보 상태가 적용된다", () => {
    const raw = {
      title: "[회사A] 홈페이지 리뉴얼",
      domain: "이상한값",
      domainConfidence: 1.7,
      pages: Array.from({ length: 7 }, (_, i) => ({
        pageTitle: `페이지${i + 1}`,
        pageRole: i === 0 ? "cover" : "본문아님",
        sourceSlides: [i + 1, i + 2],
        sections: [
          {
            sectionTitle: "섹션",
            contentSummary: "[회사A] 소개",
            contentType: "hero",
            recommendedLayout: "hero",
            confidence: 0.9,
          },
        ],
      })),
    };
    const a = normalizeAnalysis(raw);
    assert.equal(a.domain, "generic"); // 잘못된 enum 보정
    assert.equal(a.domainConfidence, 1); // clamp
    assert.equal(a.pages.length, 7);
    assert.equal(a.pages[0].pageId, "p1");
    assert.equal(a.pages[0].pageRole, "cover");
    assert.equal(a.pages[1].pageRole, "content"); // 잘못된 role 보정
    assert.deepEqual(a.pages[2].sourceSlides, [3, 4]); // 슬라이드 계보 보존
    assert.equal(a.pages.filter((p) => p.selected).length, 5); // 최대 5개 기본 선택
    assert.equal(a.pages[0].sections[0].sectionId, "p1-s1");
    assert.equal(a.pages[0].sections[0].status, "candidate");
  });

  it("sourceDocumentId·unresolvedNotes·변형·사례분석이 보존된다", () => {
    const a = normalizeAnalysis({
      pages: [
        {
          pageTitle: "메인",
          pageRole: "content",
          sourceDocumentId: "RUC-UI-MAI",
          sections: [
            {
              sectionTitle: "히어로",
              unresolvedNotes: ["[김OO 9/25] 문구 확정 필요"],
            },
          ],
        },
      ],
      existingContentVariants: [
        { label: "Main1", sourceSlides: [3], contentSummary: "시안 1" },
        { label: "Main2", sourceSlides: [4], contentSummary: "시안 2" },
      ],
      detectedCaseStudies: [
        { name: "파타고니아", extractedNote: "지속가능성 사례", sourceUrls: [] },
      ],
    });
    assert.equal(a.pages[0].sourceDocumentId, "RUC-UI-MAI");
    assert.deepEqual(a.pages[0].sections[0].unresolvedNotes, [
      "[김OO 9/25] 문구 확정 필요",
    ]);
    assert.equal(a.existingContentVariants?.length, 2);
    assert.equal(a.detectedCaseStudies?.[0].name, "파타고니아");
  });
});

describe("classifyDocumentPurpose — 문서 성격 판정 (Step 8, 실사용#14)", () => {
  it("기획서/화면설계서 → project-brief", () => {
    const r = classifyDocumentPurpose(
      "홈페이지 리뉴얼 기획서\n프로젝트 개요\n요구사항 정의\n화면설계: 메인 레이아웃과 와이어프레임\nUI 구성",
    );
    assert.equal(r.purpose, "project-brief");
  });

  it("회사소개서 → company-profile", () => {
    const r = classifyDocumentPurpose(
      "회사소개서\n경영이념과 비전\n조직도\n연혁: 2018 설립\n주요 고객사: 테슬라, BMW\n수상 및 인증 내역\n재무제표 요약",
    );
    assert.equal(r.purpose, "company-profile");
  });

  it("표지·간지·목차만 → template-only", () => {
    const r = classifyDocumentPurpose(
      "--- 슬라이드 1 ---\n표지: 사업명 들어갈 자리\n--- 슬라이드 2 ---\n목차\n--- 슬라이드 3 ---\n간지: 1장",
    );
    assert.equal(r.purpose, "template-only");
  });
});

describe("buildDirectiveBlock — 전역 지시 주입 (Step 8)", () => {
  it("지시가 분석 프롬프트에 포함된다", () => {
    const prompt = buildAnalysisPrompt("[회사A] 기획서", [], [
      { text: "ESG 강조" },
    ]);
    assert.ok(prompt.includes("전역 지시"));
    assert.ok(prompt.includes("- ESG 강조"));
  });

  it("지시가 없으면 블록도 없다", () => {
    assert.equal(buildDirectiveBlock([]), "");
    const prompt = buildAnalysisPrompt("[회사A] 기획서");
    assert.ok(!prompt.includes("전역 지시"));
  });
});

describe("buildSourceMaterial — 제외 페이지 차단 (Step 7)", () => {
  const analysis: ProjectAnalysis = normalizeAnalysis({
    title: "T",
    domain: "document",
    pages: [
      {
        pageTitle: "회사 소개",
        pageRole: "content",
        sections: [
          {
            sectionTitle: "연혁",
            contentSummary: "[회사A] 연혁 타임라인",
            contentType: "history",
            recommendedLayout: "timeline",
          },
        ],
      },
      {
        pageTitle: "투자 정보",
        pageRole: "metrics",
        sections: [
          {
            sectionTitle: "투자 현황",
            contentSummary: "[투자금A] 유치 상세",
            contentType: "metrics",
            recommendedLayout: "stat-band",
          },
        ],
      },
    ],
  });
  // 투자 정보 페이지 제외
  analysis.pages[1].selected = false;
  analysis.pages[1].excludedReason = "sensitive";

  it("선택 페이지 내용은 포함, 제외 페이지 내용은 미포함", () => {
    const src = buildSourceMaterial(analysis);
    assert.ok(src.includes("[회사A] 연혁 타임라인"));
    assert.ok(!src.includes("[투자금A] 유치 상세")); // 제외 내용이 프롬프트에 없음
  });

  it("제외 페이지는 참조 금지 조건으로 명시된다", () => {
    const src = buildSourceMaterial(analysis);
    assert.ok(
      src.includes(
        'Excluded page "투자 정보" must not be used as source material. Reason: sensitive content.',
      ),
    );
  });
});
