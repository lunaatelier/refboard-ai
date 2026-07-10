import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeAnalysis } from "../analysis/normalize";
import { canAccessStep } from "./guards";
import { buildAnalysisExport, parseAnalysisImport } from "./recycle";
import {
  buildRecoveryKeyExport,
  parseRecoveryKeyImport,
} from "./recoveryKey";
import type { WorkflowState } from "./workflow";

const analysis = normalizeAnalysis({
  title: "[고객사A] 리뉴얼",
  domain: "marketing-web",
  pages: [
    { pageTitle: "메인", pageRole: "content", sections: [{ sectionTitle: "히어로" }] },
  ],
});

describe("Step 13 — 가드 확장 (재활용 모드)", () => {
  it("일반 모드: maskedText 없으면 analysis 이후 차단 (기존 동작 유지)", () => {
    const s: WorkflowState = {
      currentStep: "masking",
      completedSteps: ["upload", "masking"],
    };
    assert.equal(canAccessStep("analysis", s), false);
  });

  it("재활용 모드: analysis-json + analysis 있으면 maskedText 없어도 reference 접근", () => {
    const s: WorkflowState = {
      currentStep: "reference",
      completedSteps: ["upload", "masking", "analysis"],
      sourceType: "analysis-json",
      analysis,
    };
    assert.equal(canAccessStep("reference", s), true);
    // concept은 reference를 완료해야 열림 (순차 게이트는 재활용 모드에서도 유지)
    assert.equal(canAccessStep("concept", s), false);
    assert.equal(
      canAccessStep("concept", {
        ...s,
        completedSteps: [...s.completedSteps, "reference"],
      }),
      true,
    );
  });

  it("재활용 모드라도 analysis가 없으면 차단", () => {
    const s: WorkflowState = {
      currentStep: "upload",
      completedSteps: ["upload", "masking", "analysis"],
      sourceType: "analysis-json",
    };
    assert.equal(canAccessStep("reference", s), false);
  });
});

describe("Step 13 — 분석 JSON 저장/불러오기", () => {
  const state: WorkflowState = {
    currentStep: "analysis",
    completedSteps: ["upload", "masking", "analysis"],
    maskedText: "[고객사A] 텍스트",
    analysis,
    extractedAnalysisTargets: [
      { name: "가상아웃도어", entityKind: "benchmarkBrand" },
    ],
    projectDirective: [{ text: "ESG 강조" }],
    documentPurpose: "project-brief",
  };

  it("저장→불러오기 라운드트립이 성립하고 복원키는 포함되지 않는다", () => {
    const json = buildAnalysisExport(state, "test-export-id");
    assert.ok(!json.includes("mappings")); // 복원키 절대 미포함
    assert.ok(!json.includes("maskedText")); // 본문 텍스트도 미포함 (분석만)
    const imported = parseAnalysisImport(json);
    assert.equal(imported.analysis.title, "[고객사A] 리뉴얼");
    assert.equal(imported.extractedAnalysisTargets[0].name, "가상아웃도어");
    assert.equal(imported.projectDirective[0].text, "ESG 강조");
    assert.equal(imported.documentPurpose, "project-brief");
  });

  it("businessDomains 배열은 재활용 라운드트립에서 그대로 보존된다 (실사용#11)", () => {
    const stateWithDomains: WorkflowState = {
      ...state,
      analysis: { ...analysis, businessDomains: ["스마트시티", "통합관제"] },
    };
    const json = buildAnalysisExport(stateWithDomains, "test-export-id");
    const imported = parseAnalysisImport(json);
    assert.deepEqual(imported.analysis.businessDomains, ["스마트시티", "통합관제"]);
  });

  it("구버전(v1) businessDomain: string 저장 JSON을 불러와도 businessDomains 배열로 정규화된다 (실사용#11)", () => {
    const legacyJson = JSON.parse(buildAnalysisExport(state, "legacy-test"));
    legacyJson.analysis.businessDomain = "스마트시티"; // 구버전 필드명(단일 문자열)
    const imported = parseAnalysisImport(JSON.stringify(legacyJson));
    assert.deepEqual(imported.analysis.businessDomains, ["스마트시티"]);
  });

  it("형식이 다른 JSON은 명확한 에러로 거부", () => {
    assert.throws(
      () => parseAnalysisImport('{"foo": 1}'),
      /이 앱에서 저장한 분석 JSON이 아닙니다/,
    );
    assert.throws(() => parseAnalysisImport("not json"), /JSON 파싱/);
  });

  it("미래 버전은 거부", () => {
    const json = buildAnalysisExport(state, "test-export-id").replace(
      '"version": 1',
      '"version": 99',
    );
    assert.throws(() => parseAnalysisImport(json), /버전/);
  });

  it("exportId가 그대로 왕복되고, 없는 구버전 JSON은 undefined로 처리된다", () => {
    const json = buildAnalysisExport(state, "abc-123");
    const imported = parseAnalysisImport(json);
    assert.equal(imported.exportId, "abc-123");

    const legacyJson = JSON.stringify(
      JSON.parse(buildAnalysisExport(state, "unused")),
    );
    const legacyWithoutExportId = JSON.parse(legacyJson);
    delete legacyWithoutExportId.exportId;
    const importedLegacy = parseAnalysisImport(
      JSON.stringify(legacyWithoutExportId),
    );
    assert.equal(importedLegacy.exportId, undefined);
  });
});

describe("Step 14 — 복원키 파일 내보내기/가져오기", () => {
  const mappings = [
    { token: "[회사A]", raw: "가상전자", kind: "company" as const },
    { token: "[담당자A]", raw: "가상담당자C", kind: "personName" as const },
  ];

  it("내보내기 → 가져오기 왕복: exportId와 매핑이 보존된다", () => {
    const json = buildRecoveryKeyExport(mappings, "doc-1");
    const imported = parseRecoveryKeyImport(json);
    assert.equal(imported.exportId, "doc-1");
    assert.deepEqual(imported.mappings, mappings);
  });

  it("빈 매핑은 내보내기 거부", () => {
    assert.throws(() => buildRecoveryKeyExport([], "doc-1"), /복원키가 없습니다/);
  });

  it("분석 JSON을 복원키로 착각하면 거부, 반대 방향도 안내 에러", () => {
    const analysisJson = buildAnalysisExport(
      {
        currentStep: "analysis",
        completedSteps: ["upload", "masking", "analysis"],
        analysis,
      },
      "doc-1",
    );
    assert.throws(
      () => parseRecoveryKeyImport(analysisJson),
      /복원키 파일이 아닙니다/,
    );
    // 복원키 파일을 메인 업로드(분석 JSON 자리)에 올린 경우 → 사용처 안내
    const recoveryJson = buildRecoveryKeyExport(mappings, "doc-1");
    assert.throws(() => parseAnalysisImport(recoveryJson), /복원키 파일입니다/);
  });

  it("미래 버전·손상 매핑은 거부", () => {
    const json = buildRecoveryKeyExport(mappings, "doc-1").replace(
      '"version": 1',
      '"version": 99',
    );
    assert.throws(() => parseRecoveryKeyImport(json), /버전/);

    const broken = JSON.parse(buildRecoveryKeyExport(mappings, "doc-1"));
    broken.mappings = [{ token: "[회사A]" }];
    assert.throws(
      () => parseRecoveryKeyImport(JSON.stringify(broken)),
      /유효한 매핑이 없습니다/,
    );
  });
});
