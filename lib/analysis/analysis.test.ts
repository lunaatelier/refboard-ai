import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSourceMaterial } from "../ai/exclusion";
import { buildAnalysisPrompt, buildDirectiveBlock } from "../ai/prompts";
import { confirmSelectedSections } from "./confirm";
import { classifyDocumentPurpose } from "./documentPurpose";
import { filterBrandColorCandidates, normalizeAnalysis } from "./normalize";
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
        { name: "가상아웃도어", extractedNote: "지속가능성 사례", sourceUrls: [] },
      ],
    });
    assert.equal(a.pages[0].sourceDocumentId, "RUC-UI-MAI");
    assert.deepEqual(a.pages[0].sections[0].unresolvedNotes, [
      "[김OO 9/25] 문구 확정 필요",
    ]);
    assert.equal(a.existingContentVariants?.length, 2);
    assert.equal(a.detectedCaseStudies?.[0].name, "가상아웃도어");
  });

  it("parentSiteRelation: AI 후보는 confirmed:false로 시작, 없으면 필드 없음 (실사용#31)", () => {
    const withRelation = normalizeAnalysis({
      pages: [{ pageTitle: "관리", pageRole: "content", sections: [] }],
      parentSiteRelation: {
        relationNote: "[회사A] 대민 홈페이지의 콘텐츠를 관리하는 백오피스로 추정",
      },
    });
    assert.equal(
      withRelation.parentSiteRelation?.relationNote,
      "[회사A] 대민 홈페이지의 콘텐츠를 관리하는 백오피스로 추정",
    );
    assert.equal(withRelation.parentSiteRelation?.confirmed, false);

    const without = normalizeAnalysis({
      pages: [{ pageTitle: "메인", pageRole: "content", sections: [] }],
      parentSiteRelation: null,
    });
    assert.equal(without.parentSiteRelation, undefined);
  });

  it("배경/테마 설명에만 등장한 hex는 brandColors에서 제외한다 (팔레트 그레이 버그 원인)", () => {
    const sourceText =
      "Theme: 반드시 'Dark Mode'를 기본 테마로 설정하세요. 배경은 깊은 네이비/차콜(#0f172a 또는 #1e293b) 계열을 사용해 장시간 관제 시 눈의 피로를 낮추세요.";
    const a = normalizeAnalysis(
      {
        pages: [{ pageTitle: "메인", pageRole: "content", sections: [] }],
        brandColors: ["#0f172a", "#1e293b"],
      },
      sourceText,
    );
    assert.equal(a.brandColors, undefined);
  });

  it("brandColors에서 제외된 배경색은 explicitRequirements(background-color)로 자동 승격된다 (게이트 1 정정 — 버리지 않고 분류)", () => {
    const sourceText =
      "배경은 깊은 네이비(#0f172a) 계열을 사용해 장시간 관제 시 눈의 피로를 낮추세요.";
    const a = normalizeAnalysis(
      {
        pages: [{ pageTitle: "메인", pageRole: "content", sections: [] }],
        brandColors: ["#0f172a"],
      },
      sourceText,
    );
    assert.equal(a.brandColors, undefined);
    assert.equal(a.explicitRequirements?.length, 1);
    assert.equal(a.explicitRequirements?.[0].kind, "background-color");
    assert.equal(a.explicitRequirements?.[0].value, "#0f172a");
  });

  it("Gemini가 이미 explicitRequirements로 같은 색을 보고했으면 중복 추가하지 않는다", () => {
    const sourceText = "배경은 #0f172a 계열을 사용하세요.";
    const a = normalizeAnalysis(
      {
        pages: [{ pageTitle: "메인", pageRole: "content", sections: [] }],
        brandColors: ["#0f172a"],
        explicitRequirements: [
          { kind: "background-color", text: "배경은 #0f172a 계열", value: "#0f172a" },
        ],
      },
      sourceText,
    );
    assert.equal(a.explicitRequirements?.length, 1);
  });

  it("explicitRequirements: mode·layout 지시를 정규화하고 알 수 없는 kind는 other로 보정한다", () => {
    const a = normalizeAnalysis({
      pages: [{ pageTitle: "메인", pageRole: "content", sections: [] }],
      explicitRequirements: [
        { kind: "mode", text: "다크모드로 만들어주세요", value: "dark" },
        { kind: "layout", text: "GNB는 좌측 고정으로" },
        { kind: "이상한값", text: "알 수 없는 지시" },
        { kind: "other", text: "" }, // 빈 text는 제외
      ],
    });
    assert.equal(a.explicitRequirements?.length, 3);
    assert.equal(a.explicitRequirements?.[0].kind, "mode");
    assert.equal(a.explicitRequirements?.[0].value, "dark");
    assert.equal(a.explicitRequirements?.[1].kind, "layout");
    assert.equal(a.explicitRequirements?.[2].kind, "other");
  });

  it("브랜드/로고 라벨이 붙은 hex는 배경 언급이 섞여 있어도 유지한다", () => {
    const sourceText =
      "배경은 흰색을 사용합니다. 브랜드 로고 컬러는 #2563EB 입니다.";
    const a = normalizeAnalysis(
      {
        pages: [{ pageTitle: "메인", pageRole: "content", sections: [] }],
        brandColors: ["#2563EB"],
      },
      sourceText,
    );
    assert.deepEqual(a.brandColors, ["#2563EB"]);
  });
});

describe("filterBrandColorCandidates — 배경/테마 라벨 hex 제외", () => {
  it("소스 텍스트가 없으면 필터링하지 않는다 (보수적 기본값)", () => {
    assert.deepEqual(filterBrandColorCandidates(["#0f172a"], ""), ["#0f172a"]);
  });

  it("문서에서 찾을 수 없는 hex는 보수적으로 유지한다", () => {
    assert.deepEqual(
      filterBrandColorCandidates(["#0f172a"], "이 문서엔 색상 언급이 없다."),
      ["#0f172a"],
    );
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
    const src = buildSourceMaterial(confirmSelectedSections(analysis));
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

describe("confirmSelectedSections — 선택 페이지 확정 게이트", () => {
  it("선택한 페이지 섹션만 confirmed로 바꾸고, 미선택 페이지 섹션은 후보로 남긴다", () => {
    const analysis = normalizeAnalysis({
      pages: [
        {
          pageTitle: "선택",
          pageRole: "content",
          sections: [{ sectionTitle: "포함", contentSummary: "포함 내용" }],
        },
        {
          pageTitle: "제외",
          pageRole: "content",
          sections: [{ sectionTitle: "제외", contentSummary: "제외 내용" }],
        },
      ],
    });
    analysis.pages[1].selected = false;

    const confirmed = confirmSelectedSections(analysis);

    assert.equal(confirmed.pages[0].sections[0].status, "confirmed");
    assert.equal(confirmed.pages[1].sections[0].status, "candidate");
  });

  it("후속 소스 자료에는 선택됐지만 아직 확정되지 않은 섹션도 포함하지 않는다", () => {
    const analysis = normalizeAnalysis({
      pages: [
        {
          pageTitle: "선택",
          pageRole: "content",
          sections: [
            { sectionTitle: "확정 전", contentSummary: "아직 후보인 내용" },
          ],
        },
      ],
    });

    const beforeConfirm = buildSourceMaterial(analysis);
    assert.ok(!beforeConfirm.includes("아직 후보인 내용"));

    const afterConfirm = buildSourceMaterial(confirmSelectedSections(analysis));
    assert.ok(afterConfirm.includes("아직 후보인 내용"));
  });
});
