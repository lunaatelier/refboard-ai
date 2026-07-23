import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildVerifiedSources,
  classifySourceStatus,
  hostsRelated,
  safeHost,
} from "./sourceVerification";
import type { FetchLike, MinimalResponse } from "../parse/link";

function okResponse(): MinimalResponse {
  return {
    status: 200,
    ok: true,
    headers: { get: () => null },
    body: null,
    text: async () => "",
  };
}

function notFoundResponse(): MinimalResponse {
  return {
    status: 404,
    ok: false,
    headers: { get: () => null },
    body: null,
    text: async () => "",
  };
}

const fixedNow = () => "2026-07-21T00:00:00.000Z";

describe("safeHost / hostsRelated", () => {
  it("잘못된 URL은 undefined", () => {
    assert.equal(safeHost("not a url"), undefined);
  });

  it("동일 호스트 또는 서브도메인 관계는 related", () => {
    assert.equal(hostsRelated("example.com", "example.com"), true);
    assert.equal(hostsRelated("www.example.com", "example.com"), true);
    assert.equal(hostsRelated("example.com", "blog.example.com"), true);
  });

  it("전혀 다른 호스트는 not related", () => {
    assert.equal(hostsRelated("example.com", "other.com"), false);
  });

  it("undefined가 섞이면 항상 false", () => {
    assert.equal(hostsRelated(undefined, "example.com"), false);
  });
});

describe("classifySourceStatus", () => {
  it("도메인 검증+grounding+fetch 성공 = official", () => {
    assert.equal(
      classifySourceStatus({ domainVerified: true, groundingCited: true, fetchOk: true }),
      "official",
    );
  });

  it("grounding은 있지만 도메인 불일치 = supporting", () => {
    assert.equal(
      classifySourceStatus({ domainVerified: false, groundingCited: true, fetchOk: true }),
      "supporting",
    );
  });

  it("grounding 자체가 없으면 = unverified (도메인·fetch 무관)", () => {
    assert.equal(
      classifySourceStatus({ domainVerified: true, groundingCited: false, fetchOk: true }),
      "unverified",
    );
  });
});

describe("buildVerifiedSources", () => {
  it("도메인 일치+실제 grounding+fetch 성공 소스는 official", async () => {
    const fetchImpl: FetchLike = async () => okResponse();
    const result = await buildVerifiedSources(
      "https://example.com",
      [{ url: "https://example.com/about", title: "About" }],
      undefined,
      fetchImpl,
      fixedNow,
    );
    assert.equal(result.length, 1);
    assert.equal(result[0].status, "official");
    assert.equal(result[0].groundingCited, true);
    assert.equal(result[0].domainVerified, true);
    assert.equal(result[0].fetchedAt, "2026-07-21T00:00:00.000Z");
    assert.equal(result[0].title, "About");
  });

  it("grounding citation에 title이 없으면 undefined로 남는다 (url로 폴백은 화면 쪽 책임)", async () => {
    const fetchImpl: FetchLike = async () => okResponse();
    const result = await buildVerifiedSources(
      "https://example.com",
      [{ url: "https://example.com/about" }],
      undefined,
      fetchImpl,
      fixedNow,
    );
    assert.equal(result[0].title, undefined);
  });

  it("모델이 적은 sourceUrl 후보는 title이 없다 (모델 JSON엔 title 필드가 없음)", async () => {
    const fetchImpl: FetchLike = async () => okResponse();
    const result = await buildVerifiedSources(
      "https://example.com",
      [],
      "https://example.com/model-claimed",
      fetchImpl,
      fixedNow,
    );
    assert.equal(result[0].title, undefined);
  });

  it("grounding citation이 vertexaisearch 리다이렉트 프록시여도, 실제 리다이렉트 도착지 도메인으로 검증한다 (실측 사례)", async () => {
    // Gemini의 google_search grounding은 citation URL로 실제 목적지가 아니라
    // vertexaisearch.cloud.google.com/grounding-api-redirect/... 프록시를 준다.
    // 이 프록시 URL의 호스트만 보고 판단하면 항상 도메인 불일치로 나온다 —
    // 실제로 그 프록시가 리다이렉트하는 최종 목적지 호스트로 비교해야 한다.
    const proxyUrl = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc123";
    const fetchImpl: FetchLike = async (url) => {
      if (url.toString() === proxyUrl) {
        return {
          status: 302,
          ok: false,
          headers: { get: (n) => (n.toLowerCase() === "location" ? "https://example.com/about" : null) },
          body: null,
          text: async () => "",
        };
      }
      if (url.hostname === "example.com") return okResponse();
      throw new Error("unexpected host " + url.hostname);
    };
    const result = await buildVerifiedSources(
      "https://example.com",
      [{ url: proxyUrl, title: "About Example" }],
      undefined,
      fetchImpl,
      fixedNow,
    );
    assert.equal(result[0].domainVerified, true);
    assert.equal(result[0].status, "official");
    // 후보 목록에는 원래 citation URL(프록시)이 그대로 남는다 — 표시용 링크는 안 바꾼다.
    assert.equal(result[0].url, proxyUrl);
  });

  it("모델이 적은 sourceUrl은 실제 grounding에 없으면 groundingCited:false로 후보에 남는다", async () => {
    const fetchImpl: FetchLike = async () => okResponse();
    const result = await buildVerifiedSources(
      "https://example.com",
      [],
      "https://example.com/model-claimed",
      fetchImpl,
      fixedNow,
    );
    assert.equal(result.length, 1);
    assert.equal(result[0].groundingCited, false);
    assert.equal(result[0].status, "unverified");
  });

  it("fetch가 실패하면 domainVerified+grounding이어도 official이 아니다", async () => {
    const fetchImpl: FetchLike = async () => notFoundResponse();
    const result = await buildVerifiedSources(
      "https://example.com",
      [{ url: "https://example.com/gone" }],
      undefined,
      fetchImpl,
      fixedNow,
    );
    assert.equal(result[0].status, "supporting");
  });

  it("사설망 리다이렉트 대상 등 차단된 URL은 fetchOk:false로 처리되고 던지지 않는다", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error("네트워크 도중 실패");
    };
    const result = await buildVerifiedSources(
      "https://example.com",
      [{ url: "https://example.com/flaky" }],
      undefined,
      fetchImpl,
      fixedNow,
    );
    assert.equal(result[0].status, "supporting");
  });

  it("후보가 4개를 넘으면 상한(4개)까지만 검증하고, 대상 도메인과 관련된 것을 우선한다", async () => {
    const calledUrls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calledUrls.push(url.toString());
      return okResponse();
    };
    const result = await buildVerifiedSources(
      "https://example.com",
      [
        { url: "https://unrelated1.com/a" },
        { url: "https://unrelated2.com/a" },
        { url: "https://unrelated3.com/a" },
        { url: "https://example.com/official" },
        { url: "https://unrelated4.com/a" },
      ],
      undefined,
      fetchImpl,
      fixedNow,
    );
    assert.equal(result.length, 4);
    assert.ok(calledUrls.includes("https://example.com/official"));
    assert.ok(result.some((r) => r.status === "official"));
  });

  it("중복 URL은 한 번만 검증한다", async () => {
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls++;
      return okResponse();
    };
    await buildVerifiedSources(
      "https://example.com",
      [{ url: "https://example.com/a" }, { url: "https://example.com/a" }],
      undefined,
      fetchImpl,
      fixedNow,
    );
    assert.equal(calls, 1);
  });
});
