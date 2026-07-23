import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SessionRequestCache,
  buildImageQueryCacheKey,
  buildSectionQueriesCacheKey,
} from "./requestCache";

describe("SessionRequestCache", () => {
  it("같은 키로 두 번 요청하면 fetcher는 한 번만 실행된다(캐시 적중)", async () => {
    const cache = new SessionRequestCache<number>();
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return 42;
    };
    const first = await cache.get("k1", fetcher);
    const second = await cache.get("k1", fetcher);
    assert.equal(first, 42);
    assert.equal(second, 42);
    assert.equal(calls, 1);
  });

  it("응답이 오기 전에 같은 키로 동시에 요청하면 in-flight 요청을 합친다", async () => {
    const cache = new SessionRequestCache<number>();
    let calls = 0;
    let resolve!: (v: number) => void;
    const fetcher = () => {
      calls++;
      return new Promise<number>((r) => {
        resolve = r;
      });
    };
    const p1 = cache.get("k1", fetcher);
    const p2 = cache.get("k1", fetcher);
    resolve(7);
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(r1, 7);
    assert.equal(r2, 7);
    assert.equal(calls, 1);
  });

  it("다른 키는 독립적으로 캐시된다", async () => {
    const cache = new SessionRequestCache<number>();
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return calls;
    };
    const a = await cache.get("k1", fetcher);
    const b = await cache.get("k2", fetcher);
    assert.equal(a, 1);
    assert.equal(b, 2);
  });

  it("실패한 요청은 캐시하지 않는다 — 다음 호출에서 재시도된다", async () => {
    const cache = new SessionRequestCache<number>();
    let calls = 0;
    const fetcher = async () => {
      calls++;
      if (calls === 1) throw new Error("fail");
      return 99;
    };
    await assert.rejects(cache.get("k1", fetcher));
    const result = await cache.get("k1", fetcher);
    assert.equal(result, 99);
    assert.equal(calls, 2);
  });

  it("clear()는 캐시와 in-flight 요청을 모두 비운다", async () => {
    const cache = new SessionRequestCache<number>();
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return calls;
    };
    await cache.get("k1", fetcher);
    cache.clear();
    await cache.get("k1", fetcher);
    assert.equal(calls, 2);
  });
});

describe("buildImageQueryCacheKey", () => {
  it("대소문자·공백·excludeKeywords 순서가 달라도 같은 키를 만든다", () => {
    const a = buildImageQueryCacheKey({
      query: "  Modern Office ",
      excludeKeywords: ["chart", "Icon"],
    });
    const b = buildImageQueryCacheKey({
      query: "modern office",
      excludeKeywords: ["icon", "Chart"],
    });
    assert.equal(a, b);
  });

  it("colorHex나 page가 다르면 다른 키가 된다", () => {
    const base = buildImageQueryCacheKey({ query: "modern office" });
    const withColor = buildImageQueryCacheKey({ query: "modern office", colorHex: "#ff0000" });
    const page2 = buildImageQueryCacheKey({ query: "modern office", page: 2 });
    assert.notEqual(base, withColor);
    assert.notEqual(base, page2);
  });

  it("orientation을 생략하면 'landscape'와 같은 키가 된다(현재 서버 기본값과 일치)", () => {
    const omitted = buildImageQueryCacheKey({ query: "modern office" });
    const explicit = buildImageQueryCacheKey({ query: "modern office", orientation: "landscape" });
    assert.equal(omitted, explicit);
  });

  it("orientation이 다르면 다른 키가 된다", () => {
    const landscape = buildImageQueryCacheKey({ query: "modern office", orientation: "landscape" });
    const portrait = buildImageQueryCacheKey({ query: "modern office", orientation: "portrait" });
    assert.notEqual(landscape, portrait);
  });
});

describe("buildSectionQueriesCacheKey", () => {
  it("섹션 id 순서가 달라도 같은 키를 만든다", () => {
    const a = buildSectionQueriesCacheKey({
      directionHash: "h1",
      sectionIds: ["s1", "s2"],
      promptVersion: "v1",
    });
    const b = buildSectionQueriesCacheKey({
      directionHash: "h1",
      sectionIds: ["s2", "s1"],
      promptVersion: "v1",
    });
    assert.equal(a, b);
  });

  it("directionHash나 promptVersion이 다르면 다른 키가 된다", () => {
    const base = buildSectionQueriesCacheKey({
      directionHash: "h1",
      sectionIds: ["s1"],
      promptVersion: "v1",
    });
    const diffHash = buildSectionQueriesCacheKey({
      directionHash: "h2",
      sectionIds: ["s1"],
      promptVersion: "v1",
    });
    const diffVersion = buildSectionQueriesCacheKey({
      directionHash: "h1",
      sectionIds: ["s1"],
      promptVersion: "v2",
    });
    assert.notEqual(base, diffHash);
    assert.notEqual(base, diffVersion);
  });
});
