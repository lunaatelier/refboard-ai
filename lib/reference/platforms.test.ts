import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPlatformQueries,
  PLATFORMS,
  platformNameFromUrl,
  platformsForDomain,
} from "./platforms";

describe("platforms — 20종 등록 규칙 (Step 10-b)", () => {
  it("플랫폼은 20종이다", () => {
    assert.equal(PLATFORMS.length, 20);
  });

  it("도메인별로 노출 플랫폼이 달라진다", () => {
    const marketing = platformsForDomain("marketing-web").map((p) => p.id);
    const mobile = platformsForDomain("mobile-app").map((p) => p.id);
    assert.ok(marketing.includes("awwwards"));
    assert.ok(!mobile.includes("awwwards"));
    assert.ok(mobile.includes("mobbin"));
    assert.ok(!marketing.includes("mobbin"));
    // 공통(all) 플랫폼은 양쪽 다
    assert.ok(marketing.includes("dribbble") && mobile.includes("dribbble"));
  });

  it("auto-search는 인코딩된 URL을 갖고, copy-keyword는 URL이 없다", () => {
    const queries = buildPlatformQueries("timeline infographic", "marketing-web");
    const auto = queries.find((q) => q.platform === "Dribbble");
    assert.equal(auto?.mode, "auto-search");
    assert.ok(auto?.url?.includes("timeline%20infographic"));
    const copy = queries.find((q) => q.platform === "Godly");
    assert.equal(copy?.mode, "copy-keyword");
    assert.equal(copy?.url, undefined);
  });

  it("빈 검색어는 빈 배열", () => {
    assert.deepEqual(buildPlatformQueries("  ", "generic"), []);
  });
});

describe("platformNameFromUrl — 수집 URL의 플랫폼 인식 (ReferenceItem)", () => {
  it("등록 플랫폼 URL은 플랫폼명으로 매칭된다 (서브도메인·www 포함)", () => {
    assert.equal(platformNameFromUrl("https://dribbble.com/shots/123-eco-hero"), "Dribbble");
    assert.equal(platformNameFromUrl("https://www.behance.net/gallery/456/brand"), "Behance");
    assert.equal(platformNameFromUrl("https://kr.pinterest.com/pin/789/"), "Pinterest");
  });

  it("미등록 사이트는 호스트명을 반환한다", () => {
    assert.equal(platformNameFromUrl("https://www.example-design.io/work/1"), "example-design.io");
  });

  it("URL이 아니면 null", () => {
    assert.equal(platformNameFromUrl("그냥 텍스트"), null);
  });
});
