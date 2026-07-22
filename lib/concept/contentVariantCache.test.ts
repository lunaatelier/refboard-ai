import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildContentVariantCacheKey,
  isStaleContentVariantResult,
} from "./contentVariantCache";

describe("buildContentVariantCacheKey", () => {
  it("같은 입력이면 같은 키를 만든다", () => {
    const input = {
      conceptOptionId: "option-1",
      contentVariantId: "variant-a",
      generationId: "gen-1",
    };
    assert.equal(buildContentVariantCacheKey(input), buildContentVariantCacheKey({ ...input }));
  });

  it("conceptOptionId나 contentVariantId가 다르면 다른 키가 된다", () => {
    const base = {
      conceptOptionId: "option-1",
      contentVariantId: "variant-a",
      generationId: "gen-1",
    };
    assert.notEqual(
      buildContentVariantCacheKey(base),
      buildContentVariantCacheKey({ ...base, conceptOptionId: "option-2" }),
    );
    assert.notEqual(
      buildContentVariantCacheKey(base),
      buildContentVariantCacheKey({ ...base, contentVariantId: "variant-b" }),
    );
  });

  it("generationId가 다르면 다른 키가 된다(같은 브리프로 재생성해도 구분)", () => {
    const base = {
      conceptOptionId: "option-1",
      contentVariantId: "variant-a",
      generationId: "gen-1",
    };
    assert.notEqual(
      buildContentVariantCacheKey(base),
      buildContentVariantCacheKey({ ...base, generationId: "gen-2" }),
    );
  });
});

describe("isStaleContentVariantResult", () => {
  it("generationId가 그대로면 stale이 아니다", () => {
    assert.equal(isStaleContentVariantResult("gen-1", "gen-1"), false);
  });

  it("같은 브리프로 재생성돼 briefHash는 안 바뀌어도 generationId가 바뀌면 stale이다", () => {
    // 실제 시나리오: 사용자가 입력을 바꾸지 않고 "컨셉 3안 재생성"을 다시 눌러도
    // 매 생성마다 새 generationId가 발급되므로, briefHash만 비교했다면 놓쳤을
    // "동일 브리프 재생성" 케이스를 여기서 잡아낸다.
    assert.equal(isStaleContentVariantResult("gen-1", "gen-2"), true);
  });

  it("아직 generationId가 없는 상태(undefined)끼리는 stale이 아니다", () => {
    assert.equal(isStaleContentVariantResult(undefined, undefined), false);
  });
});
