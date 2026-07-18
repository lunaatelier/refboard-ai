import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDirectionOptions } from "./direction";
import type { MoodOption, PaletteOption } from "./types";

function makePaletteOptions(ids: string[]): PaletteOption[] {
  return ids.map((optionId) => ({
    optionId,
    label: optionId,
    light: {
      mode: "light",
      primary: "#2563EB",
      secondary: "#7C3AED",
      accent: "#F59E0B",
      background: "#FFFFFF",
      surface: "#F1F5F9",
      text: "#0F172A",
      navigation: "#1E293B",
    },
    dark: {
      mode: "dark",
      primary: "#2563EB",
      secondary: "#7C3AED",
      accent: "#F59E0B",
      background: "#0F172A",
      surface: "#1E293B",
      text: "#F8FAFC",
      navigation: "#1E293B",
    },
  }));
}

function makeMood(id: string, paletteOptionId: string): MoodOption {
  return {
    id,
    label: `무드 ${id}`,
    keywords: ["a", "b", "c", "d", "e", "f"],
    description: "설명",
    imageQuery: "office",
    paletteOptionId,
    typography: {
      title: { sampleText: "제목", note: "굵은 산세리프" },
      body: { sampleText: "본문", note: "가는 산세리프" },
    },
    styleAttributes: { radius: "soft", density: "airy", contrast: "soft", typographyNote: "노트" },
    recommendedDirections: ["여백"],
    avoidDirections: ["장식"],
  };
}

describe("buildDirectionOptions — 무드+팔레트+이미지 조립", () => {
  const paletteOptions = makePaletteOptions(["trust", "innovation", "minimal"]);

  it("무드 3개 → 방향 카드 3개, 팔레트/타이포/키워드가 그대로 복사된다", () => {
    const moods = [
      makeMood("m1", "trust"),
      makeMood("m2", "innovation"),
      makeMood("m3", "minimal"),
    ];
    const directions = buildDirectionOptions(moods, paletteOptions, {});
    assert.equal(directions.length, 3);
    assert.equal(directions[0].paletteOptionId, "trust");
    assert.equal(directions[0].typography.title.sampleText, "제목");
    assert.deepEqual(directions[0].styleAttributes, { radius: "soft", density: "airy", contrast: "soft" });
    assert.deepEqual(directions[0].recommendedDirections, ["여백"]);
  });

  it("키워드는 최대 5개로 잘린다", () => {
    const directions = buildDirectionOptions([makeMood("m1", "trust")], paletteOptions, {});
    assert.equal(directions[0].keywords.length, 5);
  });

  it("이미지 후보는 최대 6장, 앞 4장만 기본 선택된다", () => {
    const images = Array.from({ length: 8 }, (_, i) => ({
      url: `https://img/${i}.jpg`,
      source: "unsplash" as const,
      attribution: `photographer${i}`,
    }));
    const directions = buildDirectionOptions(
      [makeMood("m1", "trust")],
      paletteOptions,
      { m1: images },
    );
    const candidates = directions[0].imageCandidates;
    assert.equal(candidates.length, 6);
    assert.equal(candidates.filter((c) => c.selected).length, 4);
  });

  it("첫 이미지는 hero, 다음 2~3장은 supporting, 나머지는 detail", () => {
    const images = Array.from({ length: 5 }, (_, i) => ({
      url: `u${i}`,
      source: "pexels" as const,
      attribution: `a${i}`,
    }));
    const directions = buildDirectionOptions(
      [makeMood("m1", "trust")],
      paletteOptions,
      { m1: images },
    );
    const roles = directions[0].imageCandidates.map((c) => c.role);
    assert.deepEqual(roles, ["hero", "supporting", "supporting", "supporting", "detail"]);
  });

  it("이미지 순서(order)는 원본 배열 순서를 그대로 보존한다", () => {
    const images = [
      { url: "u0", source: "pexels" as const, attribution: "a0" },
      { url: "u1", source: "pexels" as const, attribution: "a1" },
    ];
    const directions = buildDirectionOptions(
      [makeMood("m1", "trust")],
      paletteOptions,
      { m1: images },
    );
    assert.deepEqual(
      directions[0].imageCandidates.map((c) => c.order),
      [0, 1],
    );
  });

  it("이미지가 없는 무드는 imageCandidates가 빈 배열이다", () => {
    const directions = buildDirectionOptions([makeMood("m1", "trust")], paletteOptions, {});
    assert.deepEqual(directions[0].imageCandidates, []);
  });

  it("paletteOptionId가 후보 목록에 없는 무드는 결과에서 제외된다(방어적)", () => {
    const directions = buildDirectionOptions(
      [makeMood("m1", "ghost-id")],
      paletteOptions,
      {},
    );
    assert.equal(directions.length, 0);
  });

  it("directionId/moodOptionId는 무드 id로 채워진다", () => {
    const directions = buildDirectionOptions([makeMood("m1", "trust")], paletteOptions, {});
    assert.equal(directions[0].directionId, "m1");
    assert.equal(directions[0].moodOptionId, "m1");
  });
});
