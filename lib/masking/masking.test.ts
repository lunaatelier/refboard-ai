import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDraft, createMaskingReviewSummary, finalizeMask, summarizeMasking } from "./apply";
import { detect } from "./detect";
import { maskFileName } from "./filename";
import { detectWordOccurrences } from "./manual";
import { detectNumeric, generalizeNumeric } from "./numeric";
import { remaskText } from "./remask";
import { classifyUrl } from "./urlRules";
import { restore } from "./restore";
import type { DictionaryEntry } from "./types";

const dict: DictionaryEntry[] = [
  { id: "1", value: "가상전자", kind: "company", scope: "project" },
  { id: "2", value: "가상물류", kind: "client", scope: "project" },
  { id: "3", value: "가상담당자A", kind: "person", scope: "global" },
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
    const ds = detect("가상전자와 가상물류 담당 가상담당자A", dict);
    assert.deepEqual(
      ds.map((d) => d.kind),
      ["company", "client", "personName"],
    );
    assert.ok(ds.every((d) => d.source === "dictionary"));
  });

  it("표 헤더 라벨 기반 후보(labeledEntities)가 사전 없이도 탐지된다", () => {
    const text = "--- 슬라이드 1 ---\n작성자\n소속\nV0.1\n가상담당자B\n디자인팀";
    const start = text.indexOf("가상담당자B");
    const ds = detect(text, [], [
      { kind: "personName", raw: "가상담당자B", start, end: start + "가상담당자B".length },
    ]);
    assert.equal(ds.length, 1);
    assert.equal(ds[0].kind, "personName");
    assert.equal(ds[0].raw, "가상담당자B");
    assert.equal(ds[0].source, "rule");
    assert.equal(ds[0].enabled, true);
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
    const text = "가상전자 ".repeat(5).trim();
    const { maskedText, mappings } = finalizeMask(text, detect(text, dict));
    assert.equal(maskedText, "[회사A] [회사A] [회사A] [회사A] [회사A]");
    assert.equal(mappings.length, 1);
  });

  it("서로 다른 실명 2곳 → [고객사A]/[고객사B]로 분리", () => {
    const d2: DictionaryEntry[] = [
      { id: "a", value: "가상물류", kind: "client", scope: "project" },
      { id: "b", value: "가상그린", kind: "client", scope: "project" },
    ];
    const text = "가상물류와 가상그린 비교";
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
    const text = "가상전자 벤치마킹";
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
    const text = "가상전자 문의 hong@example.com / 02-123-4567";
    const { maskedText, mappings } = finalizeMask(text, detect(text, dict));
    assert.equal(restore(maskedText, mappings), text);
  });

  it("createDraft는 detections(raw 포함)와 미리보기를 함께 준다", () => {
    const text = "가상전자 담당 가상담당자A";
    const draft = createDraft(text, detect(text, dict));
    assert.equal(draft.previewMaskedText, "[회사A] 담당 [담당자A]");
    assert.equal(draft.detections[0].raw, "가상전자");
  });
});

describe("filename — 파일명 마스킹 (실사용#32)", () => {
  it("파일명 속 인명이 가려진 displayName이 생성된다", () => {
    const meta = maskFileName("화면정의서_수정본_가상담당자A.pptx", dict);
    assert.equal(meta.displayName, "화면정의서_수정본_[담당자A].pptx");
    assert.ok(!meta.displayName.includes("가상담당자A"));
    assert.equal(meta.originalFileName, "화면정의서_수정본_가상담당자A.pptx");
  });
});

describe("manual — 단어 직접 추가", () => {
  it("단어의 모든 출현이 manual Detection으로 생성된다", () => {
    const text = "가상그린 소개. 가상그린은 좋은 회사.";
    const ds = detectWordOccurrences(text, "가상그린", "company");
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
    "가상그린은 누적 투자금 35억을 유치했고 고객 43곳, 성장률 120%를 기록. ARR 12억 달성.";

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
    const rule = classifyUrl("https://www.virtual-outdoor.example/kr/stories", [
      "VirtualOutdoor",
    ]);
    assert.equal(rule.reason, "benchmark-source");
    assert.equal(rule.suggestedAction, "keep");
  });

  it("사내 협업툴 URL → 가림 확정 (internal-tool)", () => {
    const rule = classifyUrl("https://myteam.atlassian.net/wiki/spaces/PROJ", [
      "VirtualOutdoor",
    ]);
    assert.equal(rule.reason, "internal-tool");
    assert.equal(rule.suggestedAction, "mask");
  });

  it("매칭 없는 일반 URL → 기본 가림", () => {
    const rule = classifyUrl("https://www.example.com/page", ["VirtualOutdoor"]);
    assert.equal(rule.suggestedAction, "mask");
  });
});

describe("Step 6 — 법정 의무고지 태깅 (실사용#28)", () => {
  it("개인정보 보호책임자 문맥의 이메일·전화가 태깅된다", () => {
    const ds = detect(
      "개인정보 보호책임자: 가상책임자A (privacy@corp.co.kr, 02-555-7777)",
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
    // 본문 마스킹으로 가상그린=[고객사A]가 이미 존재하는 상황
    const seed = [{ token: "[고객사A]", raw: "가상그린", kind: "client" as const }];
    const response = "이 화면은 가상그린 로고가 있는 로그인 화면입니다.";
    const { maskedText } = remaskText(response, [], seed);
    assert.ok(maskedText.includes("[고객사A]"));
    assert.ok(!maskedText.includes("가상그린"));
  });

  it("새 실명은 이어지는 토큰([고객사B])을 받아 충돌하지 않는다", () => {
    const seed = [{ token: "[고객사A]", raw: "가상그린", kind: "client" as const }];
    const dict: DictionaryEntry[] = [
      { id: "x", value: "가상블루", kind: "client", scope: "project" },
    ];
    const response = "가상그린과 가상블루 두 로고가 보입니다.";
    const { maskedText, mappings } = remaskText(response, dict, seed);
    assert.ok(maskedText.includes("[고객사A]과 [고객사B]"));
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

describe("마스킹 검수 통합 — 이미지 분석이 텍스트 확정보다 먼저 실행돼도 토큰이 갈라지지 않는다", () => {
  it("확정 전(draft) 상태로 계산한 라이브 시드로 이미지 응답을 재마스킹해도, 이후 공식 확정 시 같은 토큰을 받는다", () => {
    const text = "가상전자 소개 자료";
    const localDict: DictionaryEntry[] = [
      { id: "1", value: "가상전자", kind: "company", scope: "project" },
    ];
    const detections = detect(text, localDict);

    // 1) 이미지 분석 시점 — 텍스트는 아직 확정 전. 그 순간의 detections로
    //    즉석 시드를 계산해서 이미지 설명을 재마스킹한다 (handleAnalyzeImages와 동일 로직).
    const liveSeed = finalizeMask(text, detections, [], []).mappings;
    const imageResult = remaskText("로고: 가상전자", [], liveSeed);
    assert.equal(imageResult.maskedText, "로고: [회사A]");

    // 2) 이후 텍스트 공식 확정 — 이미지 분석이 쌓아둔 매핑을 시드로 이어받는다
    //    (handleConfirmMasking과 동일 로직). 토큰이 새로 갈라지면 안 된다.
    const official = finalizeMask(text, detections, [], imageResult.mappings);
    assert.equal(official.maskedText, "[회사A] 소개 자료");
    assert.equal(
      official.mappings.find((m) => m.raw === "가상전자")?.token,
      "[회사A]",
    );
    // 회사A가 중복 생성되지 않고 단일 매핑으로 유지됨
    assert.equal(
      official.mappings.filter((m) => m.raw === "가상전자").length,
      1,
    );
  });
});

describe("summarizeMasking — 토큰별 컨텍스트 (P2)", () => {
  it("raw는 요약 어디에도 남지 않는다", () => {
    const text = "가상전자 담당 hong@example.com";
    const ds = detect(text, dict);
    const { mappings } = finalizeMask(text, ds);
    const summary = summarizeMasking(text, ds, [], mappings);
    const serialized = JSON.stringify(summary);
    assert.ok(!serialized.includes("가상전자"));
    assert.ok(!serialized.includes("hong@example.com"));
  });

  it("uncertain 항목 수와, 그중 실명 유지로 확정된 수를 각각 집계한다", () => {
    // 123-XX-XXXXX 순차 사업자번호는 더미 확신 없이 "uncertain"으로만 태깅된다
    const text = "사업자 123-45-67890";
    const ds = detect(text).map((d) => ({ ...d, keepPlaintext: true }));
    assert.equal(ds[0].dummyConfidence, "uncertain");
    const { mappings } = finalizeMask(text, ds);
    const summary = summarizeMasking(text, ds, [], mappings);
    const g = summary.find((x) => x.kind === "businessRegNo");
    assert.equal(g?.uncertainCount, 1);
    assert.equal(g?.uncertainKeptCount, 1);
  });

  it("uncertain이지만 유지로 확정되지 않은 항목은 uncertainKeptCount에 안 잡힌다", () => {
    const text = "사업자 123-45-67890";
    const ds = detect(text); // 기본값: enabled=true(uncertain은 미적용 대상 아님), keepPlaintext 없음
    const { mappings } = finalizeMask(text, ds);
    const summary = summarizeMasking(text, ds, [], mappings);
    const g = summary.find((x) => x.kind === "businessRegNo");
    assert.equal(g?.uncertainCount, 1);
    assert.equal(g?.uncertainKeptCount, 0);
  });

  it("pptx 슬라이드 마커 기준으로 토큰의 발생 슬라이드를 찾는다", () => {
    const text =
      "--- 슬라이드 1 ---\n표지\n--- 슬라이드 2 ---\n작성자 가상담당자B\n--- 슬라이드 3 ---\n끝";
    const start = text.indexOf("가상담당자B");
    const ds = detect(
      text,
      [],
      [{ kind: "personName", raw: "가상담당자B", start, end: start + "가상담당자B".length }],
    );
    const { mappings } = finalizeMask(text, ds);
    const summary = summarizeMasking(text, ds, [], mappings);
    const g = summary.find((x) => x.kind === "personName");
    assert.equal(g?.tokenContexts.length, 1);
    assert.equal(g?.tokenContexts[0].slide, 2);
    assert.equal(g?.tokenContexts[0].occurrenceCount, 1);
  });

  it("마스킹된 주변 문맥에 raw가 아니라 토큰이 들어간다", () => {
    const text = "회사 소개: 가상전자는 좋은 회사입니다. 문의: hong@example.com";
    const ds = detect(text, dict);
    const { mappings } = finalizeMask(text, ds);
    const summary = summarizeMasking(text, ds, [], mappings);
    const g = summary.find((x) => x.kind === "company");
    const excerpt = g?.tokenContexts[0]?.maskedExcerpt ?? "";
    assert.ok(excerpt.includes("[회사A]"));
    assert.ok(!excerpt.includes("가상전자"));
  });

  it("range-generalize 수치도 치환 문구로 컨텍스트가 만들어진다", () => {
    const sample = "가상그린은 고객 43곳을 보유.";
    const ns = detectNumeric(sample).map((n) => ({
      ...n,
      mode: "range-generalize" as const,
    }));
    const { mappings } = finalizeMask(sample, [], ns);
    const summary = summarizeMasking(sample, [], ns, mappings);
    const g = summary.find((x) => x.kind === "businessMetric");
    assert.equal(g?.tokenContexts[0]?.token, "수십 곳");
    assert.ok(!g?.tokenContexts[0]?.maskedExcerpt.includes("43곳"));
  });

  it("exact-mask 수치는 토큰([투자금A])으로 컨텍스트가 만들어진다", () => {
    const sample = "누적 투자금 35억 달성.";
    const ns = detectNumeric(sample).filter((n) => n.mode === "exact-mask");
    const { mappings } = finalizeMask(sample, [], ns);
    const summary = summarizeMasking(sample, [], ns, mappings);
    const g = summary.find((x) => x.kind === "financialMetric");
    assert.equal(g?.tokenContexts[0]?.token, "[투자금A]");
  });
});

describe("createMaskingReviewSummary — 검수 중(확정 전) 요약 (P2.1)", () => {
  it("previewMaskedText는 createDraft의 previewMaskedText와 같다(같은 buildMask 결과 공유)", () => {
    const text = "가상전자 담당 hong@example.com";
    const ds = detect(text, dict);
    const draft = createDraft(text, ds);
    const review = createMaskingReviewSummary(text, ds);
    assert.equal(review.previewMaskedText, draft.previewMaskedText);
  });

  it("summary(4개 집계)는 확정 후 summarizeMasking과 동일한 값을 낸다", () => {
    const text = "가상전자 담당 hong@example.com";
    const ds = detect(text, dict);
    const { mappings } = finalizeMask(text, ds);
    const confirmedSummary = summarizeMasking(text, ds, [], mappings);
    const review = createMaskingReviewSummary(text, ds);
    const totalOf = (s: typeof confirmedSummary) => s.reduce((sum, g) => sum + g.totalCount, 0);
    assert.equal(totalOf(review.summary), totalOf(confirmedSummary));
  });

  it("항목을 제외(enabled=false)해도 contextByKey의 슬라이드·발생횟수는 남고, maskedExcerpt만 사라진다", () => {
    const text =
      "--- 슬라이드 1 ---\n표지\n--- 슬라이드 2 ---\n문의 hong@example.com";
    const ds = detect(text, dict);
    const applied = createMaskingReviewSummary(text, ds);
    const key = "email::hong@example.com";
    assert.equal(applied.contextByKey[key]?.slide, 2);
    assert.equal(applied.contextByKey[key]?.occurrenceCount, 1);
    assert.ok(applied.contextByKey[key]?.maskedExcerpt);

    const excluded = ds.map((d) => (d.kind === "email" ? { ...d, enabled: false } : d));
    const afterExclude = createMaskingReviewSummary(text, excluded);
    assert.equal(afterExclude.contextByKey[key]?.slide, 2, "제외해도 슬라이드 번호는 남아야 한다");
    assert.equal(
      afterExclude.contextByKey[key]?.occurrenceCount,
      1,
      "제외해도 발생 횟수는 남아야 한다",
    );
    assert.equal(
      afterExclude.contextByKey[key]?.maskedExcerpt,
      undefined,
      "제외된 항목은 더 이상 마스킹되지 않으므로 마스킹된 문맥이 없어야 한다",
    );
  });

  it("공개 유지(keepPlaintext=true)로 바꿔도 슬라이드·발생횟수는 남고, maskedExcerpt만 사라진다", () => {
    const text = "가상전자 담당 hong@example.com";
    const ds = detect(text, dict).map((d) =>
      d.kind === "company" ? { ...d, keepPlaintext: true } : d,
    );
    const review = createMaskingReviewSummary(text, ds);
    const key = "company::가상전자";
    assert.ok(review.contextByKey[key]?.occurrenceCount === 1);
    assert.equal(review.contextByKey[key]?.maskedExcerpt, undefined);
  });
});

describe("isomorphic — 순수 함수 결정성", () => {
  it("같은 입력이면 항상 같은 결과 (서버/클라 동일 동작 전제)", () => {
    const text = "가상전자 hong@example.com 010-1234-5678";
    const r1 = finalizeMask(text, detect(text, dict));
    const r2 = finalizeMask(text, detect(text, dict));
    assert.deepEqual(r1, r2);
  });
});
