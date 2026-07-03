import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDraft, finalizeMask } from "./apply";
import { detect } from "./detect";
import { maskFileName } from "./filename";
import { restore } from "./restore";
import type { DictionaryEntry } from "./types";

const dict: DictionaryEntry[] = [
  { id: "1", value: "삼성전자", kind: "company", scope: "project" },
  { id: "2", value: "대한물류", kind: "client", scope: "project" },
  { id: "3", value: "신연주", kind: "person", scope: "global" },
];

describe("detect — 규칙 탐지", () => {
  it("이메일·전화·URL이 섞인 텍스트에서 전량 탐지된다", () => {
    const text =
      "문의: hong@example.com / 010-1234-5678 / https://internal.example.com/wiki";
    const kinds = detect(text).map((d) => d.kind);
    assert.ok(kinds.includes("email"));
    assert.ok(kinds.includes("phone"));
    assert.ok(kinds.includes("url"));
  });

  it("URL 안의 IP는 URL로만 탐지된다 (넓은 범위 우선)", () => {
    const ds = detect("서버: http://192.168.0.10:8080/admin 접속");
    assert.equal(ds.length, 1);
    assert.equal(ds[0].kind, "url");
  });

  it("주민번호·사업자번호가 전화번호와 구분된다", () => {
    const ds = detect("주민 900101-1234567 사업자 123-45-67890");
    assert.deepEqual(
      ds.map((d) => d.kind),
      ["rrn", "businessRegNo"],
    );
  });

  it("사전 단어(회사/고객사/인명)가 매칭된다", () => {
    const ds = detect("삼성전자와 대한물류 담당 신연주", dict);
    assert.deepEqual(
      ds.map((d) => d.kind),
      ["company", "client", "personName"],
    );
    assert.ok(ds.every((d) => d.source === "dictionary"));
  });
});

describe("detect — 더미 패턴 (실사용#13/#29)", () => {
  it("010-0000-1234는 likely-dummy로 태깅되고 기본 미적용이다", () => {
    const ds = detect("연락처 010-0000-1234");
    assert.equal(ds[0].dummyConfidence, "likely-dummy");
    assert.equal(ds[0].enabled, false);
  });

  it("noreply@ 이메일은 likely-dummy", () => {
    const ds = detect("발신전용 noreply@example.com");
    assert.equal(ds[0].dummyConfidence, "likely-dummy");
  });

  it("실제 번호·이메일에는 더미 태그가 없다", () => {
    const ds = detect("hong@corp.co.kr / 010-1234-5678");
    assert.ok(ds.every((d) => d.dummyConfidence === undefined));
    assert.ok(ds.every((d) => d.enabled));
  });
});

describe("apply — 치환·토큰·복원", () => {
  it("같은 회사명 5회 등장 → 모두 같은 토큰으로 통일", () => {
    const text = "삼성전자 ".repeat(5).trim();
    const { maskedText, mappings } = finalizeMask(text, detect(text, dict));
    assert.equal(maskedText, "[회사A] [회사A] [회사A] [회사A] [회사A]");
    assert.equal(mappings.length, 1);
  });

  it("서로 다른 실명 2곳 → [고객사A]/[고객사B]로 분리", () => {
    const d2: DictionaryEntry[] = [
      { id: "a", value: "대한물류", kind: "client", scope: "project" },
      { id: "b", value: "그린테크", kind: "client", scope: "project" },
    ];
    const text = "대한물류와 그린테크 비교";
    const { maskedText } = finalizeMask(text, detect(text, d2));
    assert.equal(maskedText, "[고객사A]와 [고객사B] 비교");
  });

  it("사용자가 해제(enabled=false)한 탐지는 치환에서 빠진다", () => {
    const text = "키: abcdefghijklmnopqrstuvwxyz123456";
    const ds = detect(text).map((d) =>
      d.kind === "apikey" ? { ...d, enabled: false } : d,
    );
    assert.equal(finalizeMask(text, ds).maskedText, text);
  });

  it("keepPlaintext=true(공개 엔티티 유지)는 실명 그대로 남는다", () => {
    const text = "삼성전자 벤치마킹";
    const ds = detect(text, dict).map((d) => ({ ...d, keepPlaintext: true }));
    assert.equal(finalizeMask(text, ds).maskedText, text);
  });

  it("FinalMaskResult에는 raw·detections가 없다 (타입 경계)", () => {
    const text = "문의 hong@example.com";
    const result = finalizeMask(text, detect(text));
    assert.deepEqual(Object.keys(result).sort(), ["mappings", "maskedText"]);
    assert.ok(!result.maskedText.includes("hong@example.com"));
  });

  it("restore(maskedText, mappings)로 원문이 복원된다", () => {
    const text = "삼성전자 문의 hong@example.com / 02-123-4567";
    const { maskedText, mappings } = finalizeMask(text, detect(text, dict));
    assert.equal(restore(maskedText, mappings), text);
  });

  it("createDraft는 detections(raw 포함)와 미리보기를 함께 준다", () => {
    const text = "삼성전자 담당 신연주";
    const draft = createDraft(text, detect(text, dict));
    assert.equal(draft.previewMaskedText, "[회사A] 담당 [담당자A]");
    assert.equal(draft.detections[0].raw, "삼성전자");
  });
});

describe("filename — 파일명 마스킹 (실사용#32)", () => {
  it("파일명 속 인명이 가려진 displayName이 생성된다", () => {
    const meta = maskFileName("화면정의서_수정본_신연주.pptx", dict);
    assert.equal(meta.displayName, "화면정의서_수정본_[담당자A].pptx");
    assert.ok(!meta.displayName.includes("신연주"));
    assert.equal(meta.originalFileName, "화면정의서_수정본_신연주.pptx");
  });
});

describe("isomorphic — 순수 함수 결정성", () => {
  it("같은 입력이면 항상 같은 결과 (서버/클라 동일 동작 전제)", () => {
    const text = "삼성전자 hong@example.com 010-1234-5678";
    const r1 = finalizeMask(text, detect(text, dict));
    const r2 = finalizeMask(text, detect(text, dict));
    assert.deepEqual(r1, r2);
  });
});
