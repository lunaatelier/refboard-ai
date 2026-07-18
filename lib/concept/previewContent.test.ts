import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractStat, splitChips, splitContentItems } from "./previewContent";

describe("previewContent — splitContentItems", () => {
  it("문장 부호로 여러 항목을 나눈다", () => {
    const items = splitContentItems(
      "실시간 대시보드를 제공합니다. 알림 기능도 있습니다. 온보딩이 쉽습니다.",
      3,
    );
    assert.deepEqual(items, [
      "실시간 대시보드를 제공합니다",
      "알림 기능도 있습니다",
      "온보딩이 쉽습니다",
    ]);
  });

  it("쉼표로도 나눈다", () => {
    const items = splitContentItems("빠름, 정확함, 안전함", 5);
    assert.deepEqual(items, ["빠름", "정확함", "안전함"]);
  });

  it("구두점 없는 한 문장은 억지로 쪼개지 않고 그대로 항목 1개로 취급한다", () => {
    const items = splitContentItems("가상전자는 신뢰할 수 있는 스타트업입니다", 3);
    assert.deepEqual(items, ["가상전자는 신뢰할 수 있는 스타트업입니다"]);
  });

  it("max를 넘으면 자른다", () => {
    const items = splitContentItems("가.나.다.라.마.", 2);
    assert.equal(items.length, 2);
  });

  it("빈 문자열은 빈 배열", () => {
    assert.deepEqual(splitContentItems("   ", 3), []);
  });
});

describe("previewContent — extractStat", () => {
  it("선행 숫자+단위를 값으로, 나머지를 라벨로 뽑는다", () => {
    const stat = extractStat("누적 투자금 35억원 유치");
    assert.equal(stat.value, "35억원");
    assert.equal(stat.label, "누적 투자금 유치");
  });

  it("퍼센트 단위도 인식한다", () => {
    const stat = extractStat("만족도 98% 달성");
    assert.equal(stat.value, "98%");
  });

  it("숫자가 없으면 value가 빈 문자열이다 (렌더러가 데이터 없음으로 표시)", () => {
    const stat = extractStat("신뢰할 수 있는 서비스");
    assert.equal(stat.value, "");
    assert.equal(stat.label, "신뢰할 수 있는 서비스");
  });
});

describe("previewContent — splitChips", () => {
  it("슬래시로 나눈 기술 스택을 항목화한다", () => {
    assert.deepEqual(splitChips("React/Next.js/TypeScript", 5), [
      "React",
      "Next.js",
      "TypeScript",
    ]);
  });

  it("가운뎃점·쉼표 혼합도 처리한다", () => {
    assert.deepEqual(splitChips("실시간 대시보드·알림, 리포트", 5), [
      "실시간 대시보드",
      "알림",
      "리포트",
    ]);
  });

  it("max를 넘으면 자른다", () => {
    assert.equal(splitChips("a/b/c/d/e", 3).length, 3);
  });

  it("빈 문자열은 빈 배열", () => {
    assert.deepEqual(splitChips("", 3), []);
  });
});
