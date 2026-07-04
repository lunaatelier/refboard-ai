import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aspectRatioToSize } from "./imageHints";

describe("Step 19 — aspectRatio → NVIDIA 허용 크기 매핑", () => {
  const ALLOWED = [768, 832, 896, 960, 1024, 1088, 1152, 1216, 1280, 1344];

  it("대표 비율이 전부 허용 집합(768~1344, 64배수)에 든다", () => {
    for (const ratio of ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "4:1"]) {
      const { width, height } = aspectRatioToSize(ratio);
      assert.ok(ALLOWED.includes(width), `${ratio} width=${width}`);
      assert.ok(ALLOWED.includes(height), `${ratio} height=${height}`);
    }
  });

  it("방향이 보존된다 (가로형은 width≥height, 세로형은 반대)", () => {
    const wide = aspectRatioToSize("16:9");
    assert.ok(wide.width > wide.height);
    assert.deepEqual(wide, { width: 1344, height: 768 });
    const tall = aspectRatioToSize("9:16");
    assert.ok(tall.height > tall.width);
    const square = aspectRatioToSize("1:1");
    assert.deepEqual(square, { width: 1024, height: 1024 });
  });

  it("비정상 입력은 1024x1024 폴백", () => {
    assert.deepEqual(aspectRatioToSize(undefined), { width: 1024, height: 1024 });
    assert.deepEqual(aspectRatioToSize("wide"), { width: 1024, height: 1024 });
    assert.deepEqual(aspectRatioToSize("0:3"), { width: 1024, height: 1024 });
  });
});
