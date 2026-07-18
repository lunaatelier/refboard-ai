import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeStaleReasons,
  isStale,
  shouldApplyResponse,
} from "./invalidation";

describe("invalidation — computeStaleReasons", () => {
  it("동일 hash면 이유가 없다", () => {
    const snap = { analysisHash: "a", directionHash: "d", briefHash: "b" };
    assert.deepEqual(computeStaleReasons(snap, { ...snap }), []);
  });

  it("analysisHash가 다르면 analysis-changed", () => {
    const reasons = computeStaleReasons(
      { analysisHash: "a1" },
      { analysisHash: "a2" },
    );
    assert.deepEqual(reasons, ["analysis-changed"]);
  });

  it("directionHash가 다르면 direction-changed", () => {
    const reasons = computeStaleReasons(
      { analysisHash: "a", directionHash: "d1" },
      { analysisHash: "a", directionHash: "d2" },
    );
    assert.deepEqual(reasons, ["direction-changed"]);
  });

  it("briefHash가 다르면 brief-changed", () => {
    const reasons = computeStaleReasons(
      { analysisHash: "a", briefHash: "b1" },
      { analysisHash: "a", briefHash: "b2" },
    );
    assert.deepEqual(reasons, ["brief-changed"]);
  });

  it("한쪽에만 있는 필드는 비교하지 않는다 (오탐 방지)", () => {
    const reasons = computeStaleReasons(
      { analysisHash: "a" },
      { analysisHash: "a", directionHash: "d" },
    );
    assert.deepEqual(reasons, []);
  });

  it("여러 이유가 동시에 발생할 수 있다", () => {
    const reasons = computeStaleReasons(
      { analysisHash: "a1", directionHash: "d1", briefHash: "b1" },
      { analysisHash: "a2", directionHash: "d2", briefHash: "b1" },
    );
    assert.deepEqual(reasons, ["analysis-changed", "direction-changed"]);
  });
});

describe("invalidation — isStale", () => {
  it("이유가 하나라도 있으면 true", () => {
    assert.equal(
      isStale({ analysisHash: "a1" }, { analysisHash: "a2" }),
      true,
    );
  });

  it("이유가 없으면 false", () => {
    assert.equal(
      isStale({ analysisHash: "a" }, { analysisHash: "a" }),
      false,
    );
  });
});

describe("invalidation — shouldApplyResponse", () => {
  it("요청 시점 hash와 현재 hash가 같으면 병합 허용", () => {
    assert.equal(shouldApplyResponse("h1", "h1"), true);
  });

  it("그 사이 hash가 바뀌었으면 병합 거부", () => {
    assert.equal(shouldApplyResponse("h1", "h2"), false);
  });
});
