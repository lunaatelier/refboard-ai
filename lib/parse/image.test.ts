import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clipboardFileName,
  fileToBase64,
  IMAGE_ONLY_PLACEHOLDER,
  imageMimeType,
  isImageFile,
} from "./image";

describe("Step 16 — 단일 이미지 입력", () => {
  it("이미지 확장자만 인식 (대소문자 무관)", () => {
    assert.ok(isImageFile("capture.png"));
    assert.ok(isImageFile("PHOTO.JPG"));
    assert.ok(isImageFile("anim.gif"));
    assert.ok(!isImageFile("doc.pdf"));
    assert.ok(!isImageFile("note.txt"));
    assert.ok(!isImageFile("archive.png.zip"));
  });

  it("확장자 → mime 매핑, 미지원은 png 폴백", () => {
    assert.equal(imageMimeType("a.png"), "image/png");
    assert.equal(imageMimeType("a.jpeg"), "image/jpeg");
    assert.equal(imageMimeType("a.jpg"), "image/jpeg");
    assert.equal(imageMimeType("a.gif"), "image/gif");
  });

  it("클립보드 합성 파일명이 mime에 맞는 확장자를 가진다", () => {
    assert.ok(clipboardFileName("image/png").endsWith(".png"));
    assert.ok(clipboardFileName("image/jpeg").endsWith(".jpg"));
    assert.ok(isImageFile(clipboardFileName("image/gif")));
  });

  it("fileToBase64 왕복", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 0, 255, 1, 2]);
    const file = new File([bytes], "t.png", { type: "image/png" });
    const b64 = await fileToBase64(file);
    assert.deepEqual(new Uint8Array(Buffer.from(b64, "base64")), bytes);
  });

  it("플레이스홀더에는 민감정보성 내용이 없다 (고정 문구)", () => {
    assert.ok(IMAGE_ONLY_PLACEHOLDER.includes("이미지 전용 입력"));
  });
});
