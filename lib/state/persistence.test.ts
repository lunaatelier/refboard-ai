import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toSafeSnapshot } from "./persistence";
import type { WorkflowState } from "./workflow";

function baseState(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    currentStep: "reference",
    completedSteps: ["upload", "masking", "analysis"],
    maskedText: "이 필드는 스냅샷에 없어야 한다",
    ...overrides,
  };
}

describe("persistence — toSafeSnapshot", () => {
  it("maskedText/maskingSummary는 스냅샷에 포함되지 않는다", () => {
    const snap = toSafeSnapshot(
      baseState({ maskingSummary: [{ kind: "email", label: "이메일", applied: 1, keptPublic: 0, excluded: 0 } as never] }),
    );
    assert.equal("maskedText" in snap, false);
    assert.equal("maskingSummary" in snap, false);
  });

  it("currentStep/completedSteps/analysis/references/conceptJson은 그대로 보존한다", () => {
    const state = baseState({
      analysis: {
        title: "t",
        description: "d",
        domain: "generic",
        domainConfidence: 0.5,
        targetUser: "u",
        tags: [],
        projectType: "브로셔",
        pages: [],
      },
      references: { paletteMode: "light" },
      conceptJson: { projectTitle: "t", options: [], outputSelection: { includedSubPageIds: [], outputPreset: "proposal" } },
    });
    const snap = toSafeSnapshot(state);
    assert.equal(snap.currentStep, "reference");
    assert.deepEqual(snap.completedSteps, ["upload", "masking", "analysis"]);
    assert.equal(snap.analysis?.title, "t");
    assert.equal(snap.references?.paletteMode, "light");
    assert.equal(snap.conceptJson?.projectTitle, "t");
  });

  it("ImageHint.generatedImageAssetId(Blob store 참조)는 그대로 보존한다 — data URL이 아니라 id 문자열이라 안전하다", () => {
    const state = baseState({
      references: {
        imageHints: [
          {
            area: "표지",
            scale: "hero",
            prompt: "prompt text",
            direction: "사진형",
            sourceReferenceMode: "use-source-image",
            generatedImageAssetId: "asset-123",
          },
        ],
      },
    });
    const snap = toSafeSnapshot(state);
    const hint = snap.references?.imageHints?.[0];
    assert.ok(hint);
    assert.equal(hint!.generatedImageAssetId, "asset-123");
    assert.equal(hint!.prompt, "prompt text");
  });

  it("savedAt 타임스탬프를 채운다", () => {
    const snap = toSafeSnapshot(baseState());
    assert.equal(typeof snap.savedAt, "string");
    assert.ok(!Number.isNaN(Date.parse(snap.savedAt)));
  });
});
