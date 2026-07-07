import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectImageMimeType, generateJson } from "./client";

describe("Step 19 보강 — 이미지 매직바이트로 실제 mimeType 판별", () => {
  // 실측: NVIDIA flux.1-dev가 실제로 JPEG를 반환하는데 응답에 포맷 필드가 없다.
  // mimeType을 PNG로 고정하면 data URL 라벨이 실제 바이트와 어긋난다.
  it("PNG 매직바이트(iVBORw0KGgo)를 인식한다", () => {
    assert.equal(detectImageMimeType("iVBORw0KGgoAAAANSUhEUg=="), "image/png");
  });

  it("JPEG 매직바이트(/9j/)를 인식한다 (실측 사례)", () => {
    assert.equal(detectImageMimeType("/9j/4AAQSkZJRgABAQAAAQABAAD"), "image/jpeg");
  });

  it("GIF·WebP 매직바이트를 인식한다", () => {
    assert.equal(detectImageMimeType("R0lGODlhAQABAIAAAAA"), "image/gif");
    assert.equal(detectImageMimeType("UklGRiQAAABXRUJQVlA4"), "image/webp");
  });

  it("알 수 없는 형식은 png로 폴백", () => {
    assert.equal(detectImageMimeType("zzzzunknown"), "image/png");
  });
});

describe("Gemini 호출 안정화", () => {
  it("기본 모델이 503을 계속 반환하면 대체 모델로 한 번 더 시도한다", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.GEMINI_API_KEY;
    const originalModel = process.env.GEMINI_MODEL;
    const originalFallbackModel = process.env.GEMINI_FALLBACK_MODEL;
    const calls: string[] = [];

    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-3.5-flash";
    process.env.GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("gemini-2.5-flash")) {
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "{\"ok\":true}" }] } }],
          }),
          { status: 200 },
        );
      }
      return new Response("busy", { status: 503 });
    }) as typeof fetch;

    try {
      const result = await generateJson<{ ok: boolean }>("test prompt");
      assert.deepEqual(result, { ok: true });
      assert.equal(calls.length, 4);
      assert.ok(calls.slice(0, 3).every((url) => url.includes("gemini-3.5-flash")));
      assert.ok(calls[3].includes("gemini-2.5-flash"));
    } finally {
      globalThis.fetch = originalFetch;
      if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalApiKey;
      if (originalModel === undefined) delete process.env.GEMINI_MODEL;
      else process.env.GEMINI_MODEL = originalModel;
      if (originalFallbackModel === undefined) delete process.env.GEMINI_FALLBACK_MODEL;
      else process.env.GEMINI_FALLBACK_MODEL = originalFallbackModel;
    }
  });
});
