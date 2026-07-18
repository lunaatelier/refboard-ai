import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMoodPrompt,
  normalizeMoodPaletteAssignment,
  parseMoodResponse,
} from "./mood";
import type { MoodOption, PaletteOption } from "./types";

function makePalette(mode: "light" | "dark") {
  return {
    mode,
    primary: "#2563EB",
    secondary: "#7C3AED",
    accent: "#F59E0B",
    background: mode === "light" ? "#FFFFFF" : "#0F172A",
    surface: mode === "light" ? "#F1F5F9" : "#1E293B",
    text: mode === "light" ? "#0F172A" : "#F8FAFC",
    navigation: "#1E293B",
  };
}

function makePaletteOptions(ids: string[]): PaletteOption[] {
  return ids.map((optionId) => ({
    optionId,
    label: optionId,
    light: makePalette("light"),
    dark: makePalette("dark"),
  }));
}

describe("buildMoodPrompt — 팔레트 후보를 프롬프트에 포함한다", () => {
  it("각 팔레트 id와 역할 색상이 프롬프트 문자열에 포함된다", () => {
    const prompt = buildMoodPrompt({
      title: "프로젝트A",
      description: "설명",
      domain: "marketing-web",
      tags: ["신뢰"],
      paletteOptions: makePaletteOptions(["trust", "innovation", "minimal"]),
    });
    assert.ok(prompt.includes('id:"trust"'));
    assert.ok(prompt.includes('id:"innovation"'));
    assert.ok(prompt.includes('id:"minimal"'));
    assert.ok(prompt.includes("#2563EB"));
  });

  it("마스킹 토큰 안내 문구가 포함된다", () => {
    const prompt = buildMoodPrompt({
      title: "[회사A]",
      description: "",
      domain: "generic",
      tags: [],
      paletteOptions: makePaletteOptions(["trust"]),
    });
    assert.ok(prompt.includes("마스킹된 실명"));
  });
});

describe("parseMoodResponse — 응답 정규화", () => {
  const paletteOptions = makePaletteOptions(["trust", "innovation", "minimal"]);

  it("정상 응답 3개를 그대로 파싱한다", () => {
    const raw = [
      {
        id: "m1",
        label: "신뢰의 블루",
        keywords: ["신뢰감 있는"],
        description: "설명1",
        imageQuery: "calm office",
        paletteOptionId: "trust",
        typography: {
          title: { sampleText: "제목1", note: "굵은 산세리프" },
          body: { sampleText: "본문1", note: "가는 산세리프" },
        },
        styleAttributes: {
          radius: "soft",
          density: "airy",
          contrast: "soft",
          typographyNote: "굵은 산세리프",
        },
        recommendedDirections: ["넓은 여백"],
        avoidDirections: ["화려한 그라디언트"],
      },
      {
        id: "m2",
        label: "혁신의 퍼플",
        keywords: ["혁신적인"],
        description: "설명2",
        imageQuery: "bold gradient",
        paletteOptionId: "innovation",
        typography: {
          title: { sampleText: "제목2", note: "이탤릭" },
          body: { sampleText: "본문2", note: "이탤릭 본문" },
        },
        styleAttributes: {
          radius: "sharp",
          density: "compact",
          contrast: "high",
          typographyNote: "이탤릭",
        },
      },
      {
        id: "m3",
        label: "미니멀 화이트",
        keywords: ["절제된"],
        description: "설명3",
        imageQuery: "minimal white space",
        paletteOptionId: "minimal",
        typography: {
          title: { sampleText: "제목3", note: "타이트" },
          body: { sampleText: "본문3", note: "타이트 본문" },
        },
        styleAttributes: {
          radius: "soft",
          density: "airy",
          contrast: "soft",
          typographyNote: "타이트",
        },
      },
    ];
    const moods = parseMoodResponse(raw, paletteOptions);
    assert.equal(moods.length, 3);
    assert.deepEqual(
      moods.map((m) => m.paletteOptionId),
      ["trust", "innovation", "minimal"],
    );
    assert.equal(moods[0].typography.title.sampleText, "제목1");
    assert.deepEqual(moods[0].recommendedDirections, ["넓은 여백"]);
    assert.deepEqual(moods[0].avoidDirections, ["화려한 그라디언트"]);
  });

  it("recommendedDirections/avoidDirections이 누락되면 빈 배열, 3개 넘으면 잘린다", () => {
    const raw = [
      {
        id: "m1",
        label: "A",
        keywords: [],
        description: "",
        imageQuery: "x",
        paletteOptionId: "trust",
        recommendedDirections: ["a", "b", "c", "d"],
      },
    ];
    const moods = parseMoodResponse(raw, paletteOptions);
    assert.deepEqual(moods[0].recommendedDirections, ["a", "b", "c"]);
    assert.deepEqual(moods[0].avoidDirections, []);
  });

  it("paletteOptionId가 없거나 유효하지 않으면 첫 후보로 대체된다", () => {
    const raw = [
      { id: "m1", label: "A", keywords: [], description: "", imageQuery: "x" },
      { id: "m2", label: "B", keywords: [], description: "", imageQuery: "y", paletteOptionId: "nope" },
    ];
    const moods = parseMoodResponse(raw, paletteOptions);
    // normalizeMoodPaletteAssignment가 중복을 서로 다른 후보로 풀어준다
    assert.deepEqual(
      moods.map((m) => m.paletteOptionId).sort(),
      ["innovation", "trust"],
    );
  });

  it("typography가 누락되면 styleAttributes.typographyNote로 대체된다", () => {
    const raw = [
      {
        id: "m1",
        label: "A",
        keywords: [],
        description: "",
        imageQuery: "x",
        paletteOptionId: "trust",
        styleAttributes: { radius: "soft", density: "airy", contrast: "soft", typographyNote: "노트" },
      },
    ];
    const moods = parseMoodResponse(raw, paletteOptions);
    assert.equal(moods[0].typography.title.note, "노트");
    assert.equal(moods[0].typography.body.note, "노트");
    assert.equal(moods[0].typography.title.sampleText, "");
  });

  it("배열이 아니거나 빈 응답이면 빈 배열을 반환한다", () => {
    assert.deepEqual(parseMoodResponse(null, paletteOptions), []);
    assert.deepEqual(parseMoodResponse({}, paletteOptions), []);
    assert.deepEqual(parseMoodResponse([], paletteOptions), []);
  });

  it("4개 이상 응답이 와도 3개까지만 사용한다", () => {
    const raw = Array.from({ length: 5 }, (_, i) => ({
      id: `m${i}`,
      label: `L${i}`,
      keywords: [],
      description: "",
      imageQuery: "x",
      paletteOptionId: "trust",
    }));
    assert.equal(parseMoodResponse(raw, paletteOptions).length, 3);
  });
});

describe("normalizeMoodPaletteAssignment — 서로 다른 팔레트 후보로 정규화", () => {
  const paletteOptions = makePaletteOptions(["a", "b", "c"]);

  function mood(id: string, paletteOptionId: string): MoodOption {
    return {
      id,
      label: id,
      keywords: [],
      description: "",
      imageQuery: "",
      paletteOptionId,
      typography: {
        title: { sampleText: "", note: "" },
        body: { sampleText: "", note: "" },
      },
      styleAttributes: { radius: "soft", density: "airy", contrast: "soft", typographyNote: "" },
      recommendedDirections: [],
      avoidDirections: [],
    };
  }

  it("이미 서로 다르면 그대로 둔다", () => {
    const moods = [mood("m1", "a"), mood("m2", "b"), mood("m3", "c")];
    const result = normalizeMoodPaletteAssignment(moods, paletteOptions);
    assert.deepEqual(result.map((m) => m.paletteOptionId), ["a", "b", "c"]);
  });

  it("중복되면 뒤에 온 무드가 아직 안 쓰인 후보로 재배정된다", () => {
    const moods = [mood("m1", "a"), mood("m2", "a"), mood("m3", "a")];
    const result = normalizeMoodPaletteAssignment(moods, paletteOptions);
    assert.deepEqual(result.map((m) => m.paletteOptionId), ["a", "b", "c"]);
  });

  it("후보보다 무드가 많으면 남는 무드는 중복을 허용한다", () => {
    const twoPalettes = makePaletteOptions(["a", "b"]);
    const moods = [mood("m1", "a"), mood("m2", "a"), mood("m3", "a")];
    const result = normalizeMoodPaletteAssignment(moods, twoPalettes);
    assert.deepEqual(result.map((m) => m.paletteOptionId), ["a", "b", "a"]);
  });

  it("무드 자체 외 다른 필드는 변경하지 않는다", () => {
    const moods = [mood("m1", "a"), mood("m2", "a")];
    const result = normalizeMoodPaletteAssignment(moods, paletteOptions);
    assert.equal(result[0].id, "m1");
    assert.equal(result[1].id, "m2");
  });
});
