import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectImageMimeType } from "./client";

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
