import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BlockedTargetError,
  fetchChecked,
  MAX_LINK_BYTES,
  readLimitedText,
  TooLargeError,
  TooManyRedirectsError,
  type FetchLike,
  type MinimalResponse,
} from "./link";

function textResponse(
  status: number,
  headers: Record<string, string>,
  text: string,
): MinimalResponse {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (n) => headers[n.toLowerCase()] ?? null },
    body: null,
    text: async () => text,
  };
}

// 바이트 청크 스트림을 흉내내는 MinimalResponse — readLimitedText의 스트리밍 경로 테스트용
function streamResponse(
  chunks: string[],
  headers: Record<string, string> = {},
): MinimalResponse {
  let i = 0;
  const body: ReadableStream<Uint8Array> = {
    getReader() {
      return {
        async read() {
          if (i >= chunks.length) return { done: true, value: undefined };
          return { done: false, value: new TextEncoder().encode(chunks[i++]) };
        },
        cancel: async () => {},
      } as ReadableStreamDefaultReader<Uint8Array>;
    },
  } as ReadableStream<Uint8Array>;
  return {
    status: 200,
    ok: true,
    headers: { get: (n) => headers[n.toLowerCase()] ?? null },
    body,
    text: async () => chunks.join(""),
  };
}

describe("Step 17 보강 — 리다이렉트 매 홉 SSRF 재검증", () => {
  it("공개 URL이 내부망으로 리다이렉트하면 차단된다 (redirect:follow 우회 방지)", async () => {
    const fetchImpl: FetchLike = async (url) => {
      if (url.hostname === "public.example.com") {
        return textResponse(302, { location: "http://127.0.0.1:9999/admin" }, "");
      }
      throw new Error("차단됐어야 하는데 여기까지 왔음");
    };
    await assert.rejects(
      () =>
        fetchChecked(
          new URL("https://public.example.com/"),
          new AbortController().signal,
          fetchImpl,
        ),
      BlockedTargetError,
    );
  });

  it("공개 도메인끼리의 정상 리다이렉트는 최종 응답까지 따라간다", async () => {
    const fetchImpl: FetchLike = async (url) => {
      if (url.hostname === "a.example.com") {
        return textResponse(301, { location: "https://b.example.com/final" }, "");
      }
      if (url.hostname === "b.example.com") {
        return textResponse(200, {}, "final body");
      }
      throw new Error("unexpected host " + url.hostname);
    };
    const res = await fetchChecked(
      new URL("https://a.example.com/"),
      new AbortController().signal,
      fetchImpl,
    );
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "final body");
  });

  it("리다이렉트가 너무 많으면 중단된다", async () => {
    let hop = 0;
    const fetchImpl: FetchLike = async () => {
      hop++;
      return textResponse(302, { location: `https://loop.example.com/${hop}` }, "");
    };
    await assert.rejects(
      () =>
        fetchChecked(
          new URL("https://loop.example.com/0"),
          new AbortController().signal,
          fetchImpl,
        ),
      TooManyRedirectsError,
    );
  });
});

describe("Step 17 보강 — 바이트 제한 스트리밍", () => {
  it("content-length가 제한을 초과하면 본문을 읽지 않고 즉시 거부", async () => {
    const res = textResponse(
      200,
      { "content-length": String(MAX_LINK_BYTES + 1) },
      "본문 안 읽힘 확인용",
    );
    await assert.rejects(() => readLimitedText(res), TooLargeError);
  });

  it("content-length가 없어도 스트리밍 중 누적치가 제한을 넘으면 중단", async () => {
    const bigChunk = "x".repeat(MAX_LINK_BYTES / 2 + 100);
    const res = streamResponse([bigChunk, bigChunk, bigChunk]);
    await assert.rejects(() => readLimitedText(res), TooLargeError);
  });

  it("제한 이내 스트림은 정상적으로 전체 텍스트를 반환", async () => {
    const res = streamResponse(["hello ", "world"]);
    assert.equal(await readLimitedText(res), "hello world");
  });
});
