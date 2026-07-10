import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveForcedMode, pickBackgroundColorRequirement } from "./requirements";

describe("pickBackgroundColorRequirement", () => {
  it("background-color 요구사항의 hex를 돌려준다", () => {
    const hex = pickBackgroundColorRequirement([
      { kind: "layout", text: "GNB 좌측 고정" },
      { kind: "background-color", text: "배경은 #0f172a", value: "#0f172a" },
    ]);
    assert.equal(hex, "#0f172a");
  });

  it("없으면 undefined", () => {
    assert.equal(pickBackgroundColorRequirement([]), undefined);
    assert.equal(pickBackgroundColorRequirement(), undefined);
  });
});

describe("deriveForcedMode", () => {
  it("kind:mode 값을 그대로 사용한다", () => {
    assert.equal(
      deriveForcedMode([{ kind: "mode", text: "다크모드로", value: "dark" }]),
      "dark",
    );
    assert.equal(
      deriveForcedMode([{ kind: "mode", text: "라이트모드로", value: "light" }]),
      "light",
    );
  });

  it("mode가 없으면 배경색 명도로 추정한다", () => {
    assert.equal(
      deriveForcedMode([
        { kind: "background-color", text: "배경은 #0f172a", value: "#0f172a" },
      ]),
      "dark",
    );
    assert.equal(
      deriveForcedMode([
        { kind: "background-color", text: "배경은 #FAFAFA", value: "#FAFAFA" },
      ]),
      "light",
    );
  });

  it("중간 명도 배경은 강제하지 않는다", () => {
    assert.equal(
      deriveForcedMode([
        { kind: "background-color", text: "배경은 #808080", value: "#808080" },
      ]),
      undefined,
    );
  });

  it("요구사항이 없으면 undefined", () => {
    assert.equal(deriveForcedMode([]), undefined);
  });
});
