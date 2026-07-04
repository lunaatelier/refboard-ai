import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractHtmlText, isBlockedLinkTarget } from "./html";

describe("Step 17 — 링크 텍스트 추출", () => {
  it("script/style 제거, 블록 경계는 줄바꿈, 엔티티 디코딩", () => {
    const html = `<html><head><style>.a{color:red}</style>
      <script>alert("x")</script></head>
      <body><h1>제목</h1><p>첫 &amp; 문단</p><div>둘째&nbsp;줄</div>
      <!-- 주석 --><ul><li>항목1</li><li>항목2</li></ul></body></html>`;
    const text = extractHtmlText(html);
    assert.ok(!text.includes("alert"));
    assert.ok(!text.includes("color:red"));
    assert.ok(!text.includes("주석"));
    assert.deepEqual(text.split("\n"), [
      "제목",
      "첫 & 문단",
      "둘째 줄",
      "항목1",
      "항목2",
    ]);
  });

  it("태그 없는 일반 텍스트는 그대로 통과", () => {
    assert.equal(extractHtmlText("그냥 텍스트"), "그냥 텍스트");
  });
});

describe("Step 17 — SSRF 가드", () => {
  const blocked = [
    "http://localhost:3000/",
    "http://127.0.0.1/",
    "http://10.0.0.5/",
    "http://172.16.1.1/",
    "http://172.31.255.255/",
    "http://192.168.0.10/",
    "http://169.254.169.254/latest/meta-data",
    "http://0.0.0.0/",
    "http://internal.local/",
    "ftp://example.com/file",
    "file:///etc/passwd",
  ];
  const allowed = [
    "https://v0.dev/chat/shared-abc",
    "https://example.com/page",
    "http://172.32.0.1/",
    "http://11.22.33.44/",
  ];

  it("사설망·로컬·비http 스킴 차단", () => {
    for (const u of blocked) {
      assert.equal(isBlockedLinkTarget(new URL(u)), true, u);
    }
  });

  it("공개 http(s) 링크 허용", () => {
    for (const u of allowed) {
      assert.equal(isBlockedLinkTarget(new URL(u)), false, u);
    }
  });
});
