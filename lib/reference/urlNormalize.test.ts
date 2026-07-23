import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeUrlKey } from "./urlNormalize";

describe("normalizeUrlKey", () => {
  it("www 유무는 같은 키가 된다", () => {
    assert.equal(
      normalizeUrlKey("https://www.example.com/about"),
      normalizeUrlKey("https://example.com/about"),
    );
  });

  it("트레일링 슬래시 유무는 같은 키가 된다", () => {
    assert.equal(
      normalizeUrlKey("https://example.com/about/"),
      normalizeUrlKey("https://example.com/about"),
    );
  });

  it("대소문자 호스트는 같은 키가 된다", () => {
    assert.equal(
      normalizeUrlKey("https://EXAMPLE.com/about"),
      normalizeUrlKey("https://example.com/about"),
    );
  });

  it("쿼리·해시는 키에 영향 주지 않는다", () => {
    assert.equal(
      normalizeUrlKey("https://example.com/about?utm=x#section"),
      normalizeUrlKey("https://example.com/about"),
    );
  });

  it("경로가 다르면 다른 키가 된다", () => {
    assert.notEqual(
      normalizeUrlKey("https://example.com/about"),
      normalizeUrlKey("https://example.com/contact"),
    );
  });

  it("파싱 불가능한 값은 예외 없이 트림+소문자 폴백한다", () => {
    assert.equal(normalizeUrlKey("Not A URL"), "not a url");
  });
});
