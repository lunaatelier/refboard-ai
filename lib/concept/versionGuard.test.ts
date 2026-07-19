import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertConceptJsonInvariant } from "./versionGuard";

describe("versionGuard — ConceptJson 버전 강제", () => {
  it("구버전(version 없음)은 sourceBasis 없이도 통과한다", () => {
    assert.doesNotThrow(() => assertConceptJsonInvariant({}));
  });

  it("version 2.0인데 sourceBasis가 없으면 던진다", () => {
    assert.throws(() => assertConceptJsonInvariant({ version: "2.0" }));
  });

  it("version 2.0이고 sourceBasis가 있으면 통과한다", () => {
    assert.doesNotThrow(() =>
      assertConceptJsonInvariant({
        version: "2.0",
        sourceBasis: {
          version: "2.0",
          confirmedAt: "2026-07-18T00:00:00.000Z",
          revision: { analysisHash: "a", promptVersion: "concept-v1" },
          direction: {
            paletteOptionId: "trust",
            editedPaletteOption: {
              optionId: "trust",
              label: "신뢰형",
              light: {
                mode: "light",
                primary: "#2563EB",
                secondary: "#64748B",
                accent: "#F97316",
                background: "#FFFFFF",
                surface: "#F8FAFC",
                text: "#0F172A",
                navigation: "#1E293B",
              },
              dark: {
                mode: "dark",
                primary: "#2563EB",
                secondary: "#64748B",
                accent: "#F97316",
                background: "#0F172A",
                surface: "#1E293B",
                text: "#F8FAFC",
                navigation: "#1E293B",
              },
            },
            paletteMode: "light",
            moodId: "mood-1",
            moodKeywords: [],
            typographyDirection: "",
            selectedMoodImages: [],
            styleAttributes: {
              radius: "soft",
              density: "airy",
              contrast: "soft",
            },
            avoidDirections: [],
          },
          pages: [],
          brandDecisions: [],
        },
      }),
    );
  });
});
