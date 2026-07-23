import "global-jsdom/register";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import MaskingReview from "./MaskingReview";
import type { Detection, NumericDetection } from "@/lib/masking/types";

// P2.1 — 마스킹 검수 화면이 확정 전(검수 중)에도 확정 후와 같은 요약(4개 배지·슬라이드·
// 문맥)을 보여주는지 검증한다. 순수 함수 테스트(apply.test.ts 등)로는 "화면에 무엇이
// 언제 보이는지"를 못 잡는다는 지적(외부 리뷰)에 따라 실제 렌더링 결과를 검증한다.

afterEach(cleanup);

const EMAIL = "test@example.com";
const COMPANY = "가상전자";
const TEXT = `--- 슬라이드 1 ---\n연락처: ${EMAIL}\n회사: ${COMPANY}`;

function makeDetections(): Detection[] {
  const emailStart = TEXT.indexOf(EMAIL);
  const companyStart = TEXT.indexOf(COMPANY);
  return [
    {
      id: "d1",
      kind: "email",
      raw: EMAIL,
      start: emailStart,
      end: emailStart + EMAIL.length,
      source: "rule",
      enabled: true,
    },
    {
      id: "d2",
      kind: "company",
      raw: COMPANY,
      start: companyStart,
      end: companyStart + COMPANY.length,
      source: "rule",
      enabled: true,
      // "검토 필요만 보기" 필터 검증용 — 이 항목만 불확실로 태깅한다.
      dummyConfidence: "uncertain",
    },
  ];
}

// app/page.tsx가 실제로 하는 것과 동일하게, detections를 controlled state로 들고
// onUpdateDetections가 호출되면 그 결과로 다시 렌더링한다 — 체크박스 조작 같은 실제
// 상태 변경까지 검증하려면 이 방식이 필요하다(정적 props만 넘기면 상호작용을 못 본다).
function Harness({ confirmed = false }: { confirmed?: boolean }) {
  const [detections, setDetections] = useState<Detection[]>(makeDetections());
  const [numericDetections] = useState<NumericDetection[]>([]);
  return (
    <MaskingReview
      parsedText={TEXT}
      detections={detections}
      numericDetections={numericDetections}
      onUpdateDetections={setDetections}
      onUpdateNumeric={() => {}}
      onAddToDictionary={() => {}}
      onConfirm={() => {}}
      confirmed={confirmed}
      onNext={() => {}}
    />
  );
}

describe("MaskingReview — 검수 중(확정 전) 화면", () => {
  it("확정 전에도 4개 요약 배지(탐지됨/마스킹 적용/공개 유지/제외)가 보인다", () => {
    render(<Harness />);
    assert.ok(screen.getByText("탐지됨 2"));
    assert.ok(screen.getByText("마스킹 적용 2"));
    assert.ok(screen.getByText("공개 유지 0"));
    assert.ok(screen.getByText("제외 0"));
  });

  it("전체 텍스트 미리보기는 기본 접힘이고, summary 클릭으로 펼쳐진다", () => {
    // 항목별 "마스킹된 문맥 보기" 아코디언도 <details>라서, container.querySelector("details")로
    // 아무거나 집으면 첫 번째 항목의 아코디언을 잡을 수 있다(외부 리뷰로 지적됨) —
    // "전체 텍스트 펼쳐보기" summary를 정확히 찾아 그 부모 details를 검사해야 한다.
    render(<Harness />);
    const summary = screen.getByText("전체 텍스트 펼쳐보기");
    const details = summary.closest("details");
    assert.ok(details, "details 엘리먼트가 있어야 한다");
    assert.equal(details!.open, false, "기본 상태는 닫혀 있어야 한다");

    fireEvent.click(summary);
    assert.equal(details!.open, true, "summary 클릭 후 열려야 한다");
  });

  it("항목 아래 슬라이드 번호가 확정 전에도 보인다", () => {
    const { container } = render(<Harness />);
    assert.ok(
      container.textContent?.includes("슬라이드 1"),
      "이메일 항목의 슬라이드 번호가 검수 중에도 보여야 한다",
    );
  });

  it("'검토 필요만 보기'를 켜면 uncertain 아닌 항목(이메일)은 사라지고 uncertain 항목(회사명)은 남는다", () => {
    const { container } = render(<Harness />);
    assert.ok(container.textContent?.includes(EMAIL), "초기 상태엔 이메일이 보여야 한다");
    assert.ok(container.textContent?.includes(COMPANY), "초기 상태엔 회사명이 보여야 한다");

    const filterCheckbox = screen.getByLabelText(/검토 필요 항목만 보기/);
    fireEvent.click(filterCheckbox);

    assert.ok(
      !container.textContent?.includes(EMAIL),
      "필터를 켜면 uncertain이 아닌 이메일 항목은 사라져야 한다",
    );
    assert.ok(
      container.textContent?.includes(COMPANY),
      "필터를 켜도 uncertain인 회사명 항목은 남아야 한다",
    );
  });

  it("항목 체크박스를 해제하면 배지 카운트가 실제로 바뀐다(마스킹 적용 → 제외)", () => {
    render(<Harness />);
    assert.ok(screen.getByText("마스킹 적용 2"));
    assert.ok(screen.getByText("제외 0"));

    const emailCheckbox = screen.getByLabelText(new RegExp(EMAIL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    fireEvent.click(emailCheckbox);

    assert.ok(screen.getByText("마스킹 적용 1"), "체크 해제 후 적용 카운트가 줄어야 한다");
    assert.ok(screen.getByText("제외 1"), "체크 해제 후 제외 카운트가 늘어야 한다");
  });

  it("항목을 제외해도 슬라이드 번호는 사라지지 않고, 마스킹된 문맥만 사라진다", () => {
    const { container } = render(<Harness />);
    // 처음엔 이메일·회사명 둘 다 마스킹 적용 상태라 아코디언이 2개 있어야 한다.
    assert.equal(screen.getAllByText("마스킹된 문맥 보기").length, 2);
    const slideCountBefore = (container.textContent?.match(/슬라이드 1/g) ?? []).length;
    assert.ok(slideCountBefore >= 1, "제외 전에도 슬라이드 번호가 보여야 한다");

    const emailCheckbox = screen.getByLabelText(new RegExp(EMAIL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    fireEvent.click(emailCheckbox); // 제외

    const slideCountAfter = (container.textContent?.match(/슬라이드 1/g) ?? []).length;
    assert.equal(
      slideCountAfter,
      slideCountBefore,
      "제외한 뒤에도 슬라이드 번호 표시 개수는 그대로여야 한다(사라지면 안 됨)",
    );
    // 제외된 항목은 더 이상 마스킹되지 않으므로, 그 항목의 "마스킹된 문맥 보기"는
    // 사라져야 한다(상태 오해 방지 — 마스킹 안 된 원문을 마스킹된 문맥처럼 보여주지 않음).
    // 회사명(uncertain, 여전히 마스킹 적용 상태)의 문맥 아코디언 1개는 남아야 한다.
    const remainingAccordions = screen.getAllByText("마스킹된 문맥 보기");
    assert.equal(remainingAccordions.length, 1, "제외된 이메일 항목의 문맥 아코디언만 사라져야 한다");
  });
});
