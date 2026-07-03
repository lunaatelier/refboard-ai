import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDraft, finalizeMask } from "./apply";
import { detect } from "./detect";
import { maskFileName } from "./filename";
import { detectWordOccurrences } from "./manual";
import { detectNumeric, generalizeNumeric } from "./numeric";
import { remaskText } from "./remask";
import { classifyUrl } from "./urlRules";
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

describe("manual — 단어 직접 추가", () => {
  it("단어의 모든 출현이 manual Detection으로 생성된다", () => {
    const text = "그린테크 소개. 그린테크는 좋은 회사.";
    const ds = detectWordOccurrences(text, "그린테크", "company");
    assert.equal(ds.length, 2);
    assert.ok(ds.every((d) => d.source === "manual" && d.enabled));
  });

  it("기존 탐지와 겹치는 구간은 건너뛴다", () => {
    const text = "메일 hong@example.com";
    const existing = detect(text);
    const ds = detectWordOccurrences(text, "example.com", "url", existing);
    assert.equal(ds.length, 0);
  });
});

describe("Step 6 — 신규 kind 탐지 (사업자번호는 Step 3부터)", () => {
  it("인증번호·주소가 탐지된다", () => {
    const ds = detect(
      "신용평가 GC1-2023-02618 / 본사: 서울특별시 강남구 테헤란로 123, 5층",
    );
    const kinds = ds.map((d) => d.kind);
    assert.ok(kinds.includes("certificationNo"));
    assert.ok(kinds.includes("address"));
  });
});

describe("Step 6 — 민감 수치 마스킹", () => {
  const sample =
    "그린테크는 누적 투자금 35억을 유치했고 고객 43곳, 성장률 120%를 기록. ARR 12억 달성.";

  it("투자금·고객수·성장률·ARR이 후보 탐지된다", () => {
    const ns = detectNumeric(sample);
    const kinds = ns.map((n) => n.kind);
    assert.ok(kinds.includes("financialMetric"));
    assert.ok(kinds.includes("businessMetric"));
    assert.ok(ns.length >= 4);
  });

  it("기본 모드: 투자금=exact, 고객수=range", () => {
    const ns = detectNumeric(sample);
    const invest = ns.find((n) => n.label?.includes("투자금"));
    const customers = ns.find((n) => n.label?.includes("고객"));
    assert.equal(invest?.mode, "exact-mask");
    assert.equal(customers?.mode, "range-generalize");
  });

  it("exact-mask → [투자금A] 토큰 + 복원매핑", () => {
    const ns = detectNumeric(sample);
    const { maskedText, mappings } = finalizeMask(sample, [], ns);
    assert.ok(maskedText.includes("누적 투자금 [투자금A]"));
    assert.ok(mappings.some((m) => m.raw === "35억"));
  });

  it("range-generalize → '수십억 원대'로 일반화 (모드 변경 가능)", () => {
    const ns = detectNumeric(sample).map((n) =>
      n.label?.includes("투자금")
        ? { ...n, mode: "range-generalize" as const }
        : n,
    );
    const { maskedText } = finalizeMask(sample, [], ns);
    assert.ok(maskedText.includes("누적 투자금 수십억 원대"));
    assert.ok(maskedText.includes("고객 수십 곳"));
  });

  it("keep → 원문 유지", () => {
    const ns = detectNumeric(sample).map((n) => ({
      ...n,
      mode: "keep" as const,
    }));
    const { maskedText } = finalizeMask(sample, [], ns);
    assert.equal(maskedText, sample);
  });

  it("generalizeNumeric 규모 버킷", () => {
    assert.equal(generalizeNumeric("35억"), "수십억 원대");
    assert.equal(generalizeNumeric("1,200억"), "수천억 원대");
    assert.equal(generalizeNumeric("43곳"), "수십 곳");
    assert.equal(generalizeNumeric("7%"), "한 자릿수 % 수준");
  });
});

describe("Step 6 — URL 마스킹 예외 규칙", () => {
  it("유지된 공개 브랜드 도메인 → 유지 후보 (benchmark-source)", () => {
    const rule = classifyUrl("https://www.patagonia.com/kr/stories", [
      "Patagonia",
    ]);
    assert.equal(rule.reason, "benchmark-source");
    assert.equal(rule.suggestedAction, "keep");
  });

  it("사내 협업툴 URL → 가림 확정 (internal-tool)", () => {
    const rule = classifyUrl("https://myteam.atlassian.net/wiki/spaces/PROJ", [
      "Patagonia",
    ]);
    assert.equal(rule.reason, "internal-tool");
    assert.equal(rule.suggestedAction, "mask");
  });

  it("매칭 없는 일반 URL → 기본 가림", () => {
    const rule = classifyUrl("https://www.example.com/page", ["Patagonia"]);
    assert.equal(rule.suggestedAction, "mask");
  });
});

describe("Step 6 — 법정 의무고지 태깅 (실사용#28)", () => {
  it("개인정보 보호책임자 문맥의 이메일·전화가 태깅된다", () => {
    const ds = detect(
      "개인정보 보호책임자: 김민수 (privacy@corp.co.kr, 02-555-7777)",
    );
    const email = ds.find((d) => d.kind === "email");
    const phone = ds.find((d) => d.kind === "phone");
    assert.equal(email?.isLegallyRequiredDisclosure, true);
    assert.equal(phone?.isLegallyRequiredDisclosure, true);
  });

  it("일반 문맥의 이메일에는 태깅되지 않는다", () => {
    const ds = detect("문의는 hello@corp.co.kr로 주세요.");
    assert.equal(ds[0].isLegallyRequiredDisclosure, undefined);
  });
});

describe("Step 9 — 응답 재마스킹 (remaskText)", () => {
  it("기존 실명이 응답에 재등장하면 같은 토큰으로 다시 가려진다", () => {
    // 본문 마스킹으로 그린테크=[고객사A]가 이미 존재하는 상황
    const seed = [{ token: "[고객사A]", raw: "그린테크", kind: "client" as const }];
    const response = "이 화면은 그린테크 로고가 있는 로그인 화면입니다.";
    const { maskedText } = remaskText(response, [], seed);
    assert.ok(maskedText.includes("[고객사A]"));
    assert.ok(!maskedText.includes("그린테크"));
  });

  it("새 실명은 이어지는 토큰([고객사B])을 받아 충돌하지 않는다", () => {
    const seed = [{ token: "[고객사A]", raw: "그린테크", kind: "client" as const }];
    const dict: DictionaryEntry[] = [
      { id: "x", value: "블루오션", kind: "client", scope: "project" },
    ];
    const response = "그린테크와 블루오션 두 로고가 보입니다.";
    const { maskedText, mappings } = remaskText(response, dict, seed);
    assert.ok(maskedText.includes("[고객사A]와 [고객사B]"));
    // 매핑은 기존+신규 superset
    assert.equal(mappings.filter((m) => m.kind === "client").length, 2);
  });

  it("응답 속 이메일·전화도 규칙으로 재차 가려진다", () => {
    const { maskedText } = remaskText(
      "화면 하단에 contact@corp.co.kr, 02-555-1234가 보입니다.",
      [],
      [],
    );
    assert.ok(!maskedText.includes("contact@corp.co.kr"));
    assert.ok(!maskedText.includes("02-555-1234"));
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
