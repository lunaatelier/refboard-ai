import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyRegeneratedImages,
  buildDirectionOptions,
  moveSelectedImage,
  replaceImageCandidate,
  setImageRole,
  setImageSelected,
} from "./direction";
import type { DirectionOption, MoodOption, PaletteOption } from "./types";

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

describe("이미지 상세 조작 (P3-4) — 선택/역할/순서/교체/재생성", () => {
  const paletteOptions = makePaletteOptions(["trust"]);

  function makeDirection(count: number): DirectionOption {
    const images = Array.from({ length: count }, (_, i) => ({
      url: `u${i}`,
      source: "pexels" as const,
      attribution: `a${i}`,
    }));
    return buildDirectionOptions([makeMood("m1", "trust")], paletteOptions, { m1: images })[0];
  }

  describe("setImageSelected", () => {
    it("선택하면 selected가 true가 된다(4장 캡 아래에서)", () => {
      const d = makeDirection(6); // u0~u3 selected, u4~u5 unselected
      const withRoom = setImageSelected(d, "u0", false); // 자리 하나 비우고
      const next = setImageSelected(withRoom, "u4", true);
      assert.equal(next.imageCandidates.find((c) => c.url === "u4")?.selected, true);
    });

    it("이미 4장이 선택된 상태에서 5번째를 선택하려 하면 변경되지 않는다", () => {
      const d = makeDirection(6);
      const next = setImageSelected(d, "u5", true);
      assert.equal(next, d); // 그대로(참조 동일)
      assert.equal(next.imageCandidates.filter((c) => c.selected).length, 4);
    });

    it("해제는 항상 가능하다(4장 캡과 무관)", () => {
      const d = makeDirection(6);
      const next = setImageSelected(d, "u0", false);
      assert.equal(next.imageCandidates.filter((c) => c.selected).length, 3);
    });
  });

  describe("setImageRole", () => {
    it("특정 이미지의 role만 바뀐다", () => {
      const d = makeDirection(3);
      const next = setImageRole(d, "u1", "texture");
      assert.equal(next.imageCandidates.find((c) => c.url === "u1")?.role, "texture");
      assert.equal(next.imageCandidates.find((c) => c.url === "u0")?.role, "hero");
    });
  });

  describe("moveSelectedImage", () => {
    it("선택된 이미지끼리 순서를 맞바꾼다", () => {
      const d = makeDirection(4); // 전부 선택됨, order 0~3
      const next = moveSelectedImage(d, "u1", 1); // u1을 뒤로
      const order = (url: string) => next.imageCandidates.find((c) => c.url === url)?.order;
      assert.equal(order("u1"), 2);
      assert.equal(order("u2"), 1);
    });

    it("맨 앞에서 -1 이동은 무시된다(범위 밖)", () => {
      const d = makeDirection(4);
      const next = moveSelectedImage(d, "u0", -1);
      assert.equal(next, d);
    });

    it("미선택 이미지는 이동 대상이 아니다", () => {
      const d = makeDirection(6);
      const next = moveSelectedImage(d, "u5", -1); // u5는 선택 안 됨
      assert.equal(next, d);
    });
  });

  describe("replaceImageCandidate", () => {
    it("url/source/attribution만 바뀌고 role/selected/order는 유지된다", () => {
      const d = makeDirection(4);
      const before = d.imageCandidates.find((c) => c.url === "u0")!;
      const next = replaceImageCandidate(d, "u0", {
        url: "new-url",
        source: "unsplash",
        attribution: "new photographer",
      });
      const after = next.imageCandidates.find((c) => c.url === "new-url");
      assert.ok(after);
      assert.equal(after?.role, before.role);
      assert.equal(after?.selected, before.selected);
      assert.equal(after?.order, before.order);
      assert.equal(next.imageCandidates.find((c) => c.url === "u0"), undefined);
    });
  });

  describe("applyRegeneratedImages", () => {
    it("이미지 세트 전체를 교체하고 기본 role/selected를 다시 적용한다", () => {
      const d = makeDirection(4);
      const next = applyRegeneratedImages(d, [
        { url: "v0", source: "unsplash", attribution: "p0" },
        { url: "v1", source: "unsplash", attribution: "p1" },
      ]);
      assert.equal(next.imageCandidates.length, 2);
      assert.equal(next.imageCandidates[0].role, "hero");
      assert.equal(next.imageCandidates[0].selected, true);
      assert.ok(!next.imageCandidates.some((c) => c.url === "u0"));
    });
  });
});
