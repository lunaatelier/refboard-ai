import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractHtmlText, extractOgMeta, isBlockedLinkTarget } from "./html";

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

describe("P5-5 — extractOgMeta (URL 붙여넣기 미리보기)", () => {
  it("og: 태그를 읽고 상대 이미지 경로를 baseUrl 기준으로 절대경로화한다", () => {
    const html = `<html><head>
      <meta property="og:title" content="대시보드 히어로 샷">
      <meta property="og:description" content="깔끔한 카드 레이아웃">
      <meta property="og:image" content="/images/shot.png">
      <meta property="og:site_name" content="Dribbble">
      </head><body></body></html>`;
    const meta = extractOgMeta(html, "https://dribbble.com/shots/1");
    assert.deepEqual(meta, {
      title: "대시보드 히어로 샷",
      description: "깔끔한 카드 레이아웃",
      siteName: "Dribbble",
      image: "https://dribbble.com/images/shot.png",
    });
  });

  it("og: 태그가 없으면 <title>과 twitter: 태그로 폴백한다", () => {
    const html = `<html><head><title>폴백 제목</title>
      <meta name="twitter:image" content="https://cdn.example.com/a.png">
      </head></html>`;
    const meta = extractOgMeta(html);
    assert.equal(meta.title, "폴백 제목");
    assert.equal(meta.image, "https://cdn.example.com/a.png");
  });

  it("content 속성이 없거나 값이 비어있으면 해당 필드는 undefined", () => {
    const meta = extractOgMeta("<html><head></head><body></body></html>");
    assert.equal(meta.title, undefined);
    assert.equal(meta.image, undefined);
    assert.equal(meta.description, undefined);
  });

  it("baseUrl 없이 상대 이미지 경로가 오면 원본 문자열을 그대로 둔다", () => {
    const meta = extractOgMeta(
      `<meta property="og:image" content="/images/shot.png">`,
    );
    assert.equal(meta.image, "/images/shot.png");
  });

  it("중복 meta 태그는 첫 값을 우선한다", () => {
    const html = `<meta property="og:title" content="첫 제목">
      <meta property="og:title" content="두번째 제목">`;
    assert.equal(extractOgMeta(html).title, "첫 제목");
  });
});
