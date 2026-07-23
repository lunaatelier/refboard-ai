import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPexelsSearchUrl,
  buildUnsplashSearchUrl,
  hexToUnsplashColor,
  parsePexelsResults,
  parseUnsplashResults,
} from "./imageSearch";

describe("hexToUnsplashColor — hex를 고정 색상 이름으로 매핑", () => {
  it("빨강 계열은 red로 매핑된다", () => {
    assert.equal(hexToUnsplashColor("#E11D48"), "red");
  });
  it("파랑 계열은 blue로 매핑된다", () => {
    assert.equal(hexToUnsplashColor("#2563EB"), "blue");
  });
  it("아주 밝은 색은 white, 아주 어두운 색은 black", () => {
    assert.equal(hexToUnsplashColor("#FFFFFF"), "white");
    assert.equal(hexToUnsplashColor("#000000"), "black");
  });
  it("저채도(회색 계열)는 강제 매핑하지 않는다", () => {
    assert.equal(hexToUnsplashColor("#888888"), undefined);
  });
  it("잘못된 hex는 undefined", () => {
    assert.equal(hexToUnsplashColor("not-a-color"), undefined);
  });
});

describe("buildUnsplashSearchUrl / buildPexelsSearchUrl", () => {
  it("Unsplash: colorHex가 있으면 color 파라미터로 변환돼 들어간다", () => {
    const url = buildUnsplashSearchUrl({ query: "office", colorHex: "#2563EB" });
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("query"), "office");
    assert.equal(parsed.searchParams.get("color"), "blue");
    assert.equal(parsed.searchParams.get("page"), "1");
  });

  it("Unsplash: colorHex가 회색(매핑 불가)이면 color 파라미터가 안 붙는다", () => {
    const url = buildUnsplashSearchUrl({ query: "office", colorHex: "#888888" });
    assert.equal(new URL(url).searchParams.has("color"), false);
  });

  it("Unsplash: page를 지정하면 그대로 반영된다(재생성용)", () => {
    const url = buildUnsplashSearchUrl({ query: "office", page: 3 });
    assert.equal(new URL(url).searchParams.get("page"), "3");
  });

  it("Pexels: colorHex는 매핑 없이 그대로 전달된다", () => {
    const url = buildPexelsSearchUrl({ query: "office", colorHex: "#2563EB" });
    assert.equal(new URL(url).searchParams.get("color"), "#2563EB");
  });
});

describe("parseUnsplashResults / parsePexelsResults — 제외 키워드 필터링", () => {
  it("정상 응답을 SearchedImage[]로 정규화한다", () => {
    const raw = {
      results: [
        {
          id: "abc123",
          urls: { small: "https://img/1.jpg" },
          links: { html: "https://unsplash.com/photos/abc123" },
          user: { name: "Jane" },
          alt_description: "a calm office space",
        },
      ],
    };
    const out = parseUnsplashResults(raw);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, "unsplash-abc123");
    assert.equal(out[0].url, "https://img/1.jpg");
    assert.equal(out[0].source, "unsplash");
    assert.equal(out[0].attribution, "Jane / Unsplash");
    // 어트리뷰션은 이미지 자산(url)이 아니라 사진 상세 페이지(links.html)로 링크해야 한다
    assert.equal(out[0].sourceUrl, "https://unsplash.com/photos/abc123");
    assert.equal(out[0].usage, "inspiration-only");
    assert.ok(typeof out[0].fetchedAt === "string" && out[0].fetchedAt.length > 0);
  });

  it("links.html이 없으면 sourceUrl은 이미지 URL로 폴백한다", () => {
    const raw = {
      results: [
        { id: "no-link", urls: { small: "https://img/2.jpg" }, user: { name: "Jane" } },
      ],
    };
    const out = parseUnsplashResults(raw);
    assert.equal(out[0].sourceUrl, "https://img/2.jpg");
  });

  it("제외 키워드가 alt_description에 매치되면 걸러진다", () => {
    const raw = {
      results: [
        { id: "1", urls: { small: "u1" }, alt_description: "a bright neon party" },
        { id: "2", urls: { small: "u2" }, alt_description: "calm minimal office" },
      ],
    };
    const out = parseUnsplashResults(raw, ["neon"]);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, "unsplash-2");
  });

  it("Pexels도 동일하게 alt 텍스트 기준으로 걸러진다", () => {
    const raw = {
      photos: [
        { id: 10, src: { medium: "p1" }, photographer: "Kim", alt: "loud crowded party" },
        { id: 11, src: { medium: "p2" }, photographer: "Lee", alt: "quiet office desk" },
      ],
    };
    const out = parsePexelsResults(raw, ["crowded"]);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, "pexels-11");
    assert.equal(out[0].attribution, "Lee / Pexels");
  });

  it("제외 키워드가 비어있으면 전부 통과한다", () => {
    const raw = {
      photos: [{ id: 1, src: { medium: "p1" }, alt: "anything" }],
    };
    assert.equal(parsePexelsResults(raw, []).length, 1);
  });

  it("배열이 아니거나 필드가 없으면 빈 배열", () => {
    assert.deepEqual(parseUnsplashResults(null), []);
    assert.deepEqual(parseUnsplashResults({}), []);
    assert.deepEqual(parsePexelsResults(undefined), []);
  });
});
