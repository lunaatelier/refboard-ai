import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeSensitiveText } from "./scan";
import type { DictionaryEntry } from "../masking/types";

describe("Step 18 — OCR 선마스킹 요약", () => {
  const dictionary: DictionaryEntry[] = [
    { id: "1", value: "가상전자", kind: "company", scope: "global" },
  ];

  it("OCR 텍스트의 민감어를 종류별 개수로 요약 (원문 조각 미포함)", () => {
    const r = summarizeSensitiveText(
      "img-1",
      "담당: hong@corp.com / 연락 010-1234-5678\n고객: 가상전자",
      dictionary,
    );
    assert.equal(r.assetId, "img-1");
    assert.ok(r.textLength > 0);
    const kinds = new Map(r.findings.map((f) => [f.kind, f.count]));
    assert.equal(kinds.get("email"), 1);
    assert.equal(kinds.get("phone"), 1);
    assert.equal(kinds.get("company"), 1);
    // 요약 객체 어디에도 원문 조각이 없어야 한다
    assert.ok(!JSON.stringify(r).includes("hong@corp.com"));
    assert.ok(!JSON.stringify(r).includes("가상전자"));
  });

  it("민감어 없는 텍스트 → findings 비어있음", () => {
    const r = summarizeSensitiveText("img-2", "포근한 겨울 캠페인 배너", []);
    assert.equal(r.findings.length, 0);
    assert.ok(r.textLength > 0);
  });

  it("빈 OCR 결과(글자 없는 이미지) → textLength 0", () => {
    const r = summarizeSensitiveText("img-3", "   \n ", []);
    assert.equal(r.textLength, 0);
    assert.equal(r.findings.length, 0);
  });
});
