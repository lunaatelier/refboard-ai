import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dataUrlToBlob } from "./imageAssetStore";

describe("imageAssetStore — dataUrlToBlob", () => {
  it("data URL의 mimeType과 바이트를 그대로 복원한다", async () => {
    const original = "hello world";
    const base64 = Buffer.from(original, "utf-8").toString("base64");
    const dataUrl = `data:text/plain;base64,${base64}`;
    const blob = dataUrlToBlob(dataUrl);
    assert.equal(blob.type, "text/plain");
    const buf = Buffer.from(await blob.arrayBuffer());
    assert.equal(buf.toString("utf-8"), original);
  });

  it("mimeType이 없으면 image/png로 기본 처리한다", () => {
    const blob = dataUrlToBlob(`data:;base64,${Buffer.from("x").toString("base64")}`);
    assert.equal(blob.type, "image/png");
  });
});
