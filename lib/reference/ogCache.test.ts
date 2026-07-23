import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCachedOgMeta, setCachedOgMeta } from "./ogCache";

const SAMPLE = { title: "예시 제목", description: "예시 설명", image: undefined };

describe("ogCache", () => {
  it("저장한 값을 정규화된 같은 URL로 조회하면 그대로 돌아온다", () => {
    setCachedOgMeta("https://www.example.com/a/", SAMPLE);
    assert.deepEqual(getCachedOgMeta("https://example.com/a"), SAMPLE);
  });

  it("캐시에 없는 URL은 null을 반환한다", () => {
    assert.equal(getCachedOgMeta("https://example.com/never-cached-" + Date.now()), null);
  });

  it("다른 경로는 다른 캐시 항목이다", () => {
    setCachedOgMeta("https://example.com/path-one", SAMPLE);
    assert.equal(getCachedOgMeta("https://example.com/path-two"), null);
  });
});
