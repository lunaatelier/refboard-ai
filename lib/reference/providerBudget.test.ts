import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryBudgetStore } from "./providerBudget";

const LIMITS = { resultLimit: 3, attemptLimit: 8 };

describe("InMemoryBudgetStore — 결과 한도", () => {
  it("성공을 resultLimit만큼 기록하면 그다음 reserveAttempt는 PROJECT_BUDGET_EXHAUSTED", () => {
    const store = new InMemoryBudgetStore();
    for (let i = 0; i < 3; i += 1) {
      const check = store.reserveAttempt("p1", "generate-image", LIMITS);
      assert.equal(check.ok, true);
      store.recordSuccess("p1", "generate-image");
    }
    const check = store.reserveAttempt("p1", "generate-image", LIMITS);
    assert.equal(check.ok, false);
    assert.equal(check.reason, "PROJECT_BUDGET_EXHAUSTED");
  });

  it("recordSuccess 없이 실패만 반복해도 resultLimit은 소진되지 않는다", () => {
    const store = new InMemoryBudgetStore();
    for (let i = 0; i < 3; i += 1) {
      const check = store.reserveAttempt("p1", "generate-image", LIMITS);
      assert.equal(check.ok, true);
      // 실패 시나리오 — recordSuccess를 호출하지 않는다
    }
    const check = store.reserveAttempt("p1", "generate-image", LIMITS);
    assert.equal(check.ok, true, "실패한 시도는 결과 한도를 깎지 않는다");
  });
});

describe("InMemoryBudgetStore — 시도 한도(실패 포함)", () => {
  it("attemptLimit만큼 reserveAttempt하면 그다음은 RATE_LIMITED", () => {
    const store = new InMemoryBudgetStore();
    for (let i = 0; i < 8; i += 1) {
      const check = store.reserveAttempt("p1", "generate-image", LIMITS);
      assert.equal(check.ok, true);
    }
    const check = store.reserveAttempt("p1", "generate-image", LIMITS);
    assert.equal(check.ok, false);
    assert.equal(check.reason, "RATE_LIMITED");
  });
});

describe("InMemoryBudgetStore — 격리", () => {
  it("다른 projectId끼리는 카운트가 섞이지 않는다", () => {
    const store = new InMemoryBudgetStore();
    for (let i = 0; i < 3; i += 1) {
      store.reserveAttempt("p1", "generate-image", LIMITS);
      store.recordSuccess("p1", "generate-image");
    }
    const check = store.reserveAttempt("p2", "generate-image", LIMITS);
    assert.equal(check.ok, true);
  });

  it("같은 projectId라도 다른 feature끼리는 카운트가 섞이지 않는다", () => {
    const store = new InMemoryBudgetStore();
    for (let i = 0; i < 3; i += 1) {
      store.reserveAttempt("p1", "generate-image", LIMITS);
      store.recordSuccess("p1", "generate-image");
    }
    const check = store.reserveAttempt("p1", "target-analyze", LIMITS);
    assert.equal(check.ok, true);
  });

  it("recordSuccess를 먼저 부른 적 없는 feature는 조용히 무시된다(초기 예약 없이 호출)", () => {
    const store = new InMemoryBudgetStore();
    assert.doesNotThrow(() => store.recordSuccess("never-reserved", "generate-image"));
  });
});

describe("InMemoryBudgetStore — remainingResults", () => {
  it("성공할 때마다 remainingResults가 줄어든다", () => {
    const store = new InMemoryBudgetStore();
    const first = store.reserveAttempt("p1", "generate-image", LIMITS);
    assert.equal(first.remainingResults, 3);
    store.recordSuccess("p1", "generate-image");
    const second = store.reserveAttempt("p1", "generate-image", LIMITS);
    assert.equal(second.remainingResults, 2);
  });
});
