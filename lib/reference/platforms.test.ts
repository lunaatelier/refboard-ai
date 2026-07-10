import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPlatformQueries,
  buildProfiledPlatformQueries,
  PLATFORMS,
  platformNameFromUrl,
  platformsForDomain,
  resolvePlatformQuery,
  validateKeywordForPlatform,
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

describe("keywordProfile — 플랫폼별 검색어 생성/검증 (docs/samples/키워드생성스펙_개선판.md v2)", () => {
  const dribbble = PLATFORMS.find((p) => p.id === "dribbble")!;
  const behance = PLATFORMS.find((p) => p.id === "behance")!;
  const gdweb = PLATFORMS.find((p) => p.id === "gdweb")!;

  it("Behance/Dribbble(en)은 한글이 섞이면 검증 실패 → fallback으로 교체된다", () => {
    assert.equal(validateKeywordForPlatform("대시보드 UI", dribbble.keywordProfile), false);
    assert.equal(
      resolvePlatformQuery("대시보드 UI", dribbble.keywordProfile),
      dribbble.keywordProfile.fallbackQueries[0],
    );
    assert.equal(validateKeywordForPlatform("브랜드 아이덴티티", behance.keywordProfile), false);
  });

  it("GDWEB(ko)은 한글이 없으면 검증 실패 → fallback으로 교체된다", () => {
    assert.equal(validateKeywordForPlatform("corporate website", gdweb.keywordProfile), false);
    assert.equal(
      resolvePlatformQuery("corporate website", gdweb.keywordProfile),
      gdweb.keywordProfile.fallbackQueries[0],
    );
  });

  it("플랫폼별로 생성된 쿼리가 서로 다르게 반영된다", () => {
    const queries = buildProfiledPlatformQueries(
      {
        dribbble: "dashboard ui",
        behance: "tech brochure design",
        gdweb: "기업 홈페이지",
      },
      "marketing-web",
      "generic fallback",
    );
    const byPlatform = new Map(queries.map((q) => [q.platform, q.query]));
    assert.equal(byPlatform.get("Dribbble"), "dashboard ui");
    assert.equal(byPlatform.get("Behance"), "tech brochure design");
    assert.equal(byPlatform.get("GDWEB (지디웹)"), "기업 홈페이지");
    assert.notEqual(byPlatform.get("Dribbble"), byPlatform.get("GDWEB (지디웹)"));
  });

  it("금칙어(공용 금칙어 목록) 포함 쿼리는 fallback으로 교체된다 (strictVocabulary)", () => {
    assert.equal(validateKeywordForPlatform("api dashboard tool", dribbble.keywordProfile), false);
    assert.equal(
      resolvePlatformQuery("api dashboard tool", dribbble.keywordProfile),
      dribbble.keywordProfile.fallbackQueries[0],
    );
  });

  it("maxWords 초과 쿼리는 fallback으로 교체된다", () => {
    const over = "one two three four five"; // dribbble maxWords=4
    assert.equal(validateKeywordForPlatform(over, dribbble.keywordProfile), false);
    assert.equal(
      resolvePlatformQuery(over, dribbble.keywordProfile),
      dribbble.keywordProfile.fallbackQueries[0],
    );
  });

  it("queriesByPlatform에 항목이 없으면 대표 검색어(fallbackQuery)가 검증을 거쳐 채워진다", () => {
    const queries = buildProfiledPlatformQueries({}, "mobile-app", "onboarding");
    const mobbin = queries.find((q) => q.platform === "Mobbin");
    assert.equal(mobbin?.query, "onboarding");
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
