import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryBudgetStore } from "./providerBudget";

const LIMITS = { resultLimit: 3, windowMs: 60_000, maxAttemptsPerWindow: 8 };

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

describe("InMemoryBudgetStore — 윈도우 기반 rate limit", () => {
  it("maxAttemptsPerWindow만큼 reserveAttempt하면 그다음은 RATE_LIMITED + retryAfterSeconds", () => {
    const store = new InMemoryBudgetStore();
    for (let i = 0; i < 8; i += 1) {
      const check = store.reserveAttempt("p1", "generate-image", LIMITS);
      assert.equal(check.ok, true);
    }
    const check = store.reserveAttempt("p1", "generate-image", LIMITS);
    assert.equal(check.ok, false);
    assert.equal(check.reason, "RATE_LIMITED");
    assert.equal(check.remainingAttempts, 0);
    assert.ok(
      typeof check.retryAfterSeconds === "number" && check.retryAfterSeconds > 0,
      "차단 시 몇 초 후 재시도 가능한지 반드시 반환해야 한다",
    );
    assert.ok(check.retryAfterSeconds! <= 60, "윈도우(60s)보다 긴 대기시간을 반환하면 안 된다");
  });

  it("윈도우가 지나면 이전 시도가 만료되어 다시 허용된다", async () => {
    const store = new InMemoryBudgetStore();
    const shortWindow = { resultLimit: 3, windowMs: 50, maxAttemptsPerWindow: 2 };
    assert.equal(store.reserveAttempt("p1", "generate-image", shortWindow).ok, true);
    assert.equal(store.reserveAttempt("p1", "generate-image", shortWindow).ok, true);
    const blocked = store.reserveAttempt("p1", "generate-image", shortWindow);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, "RATE_LIMITED");

    await new Promise((resolve) => setTimeout(resolve, 60));

    const afterWindow = store.reserveAttempt("p1", "generate-image", shortWindow);
    assert.equal(afterWindow.ok, true, "윈도우 만료 후에는 다시 허용되어야 한다");
  });

  it("remainingAttempts는 윈도우 안에서 남은 시도 수를 정확히 알려준다", () => {
    const store = new InMemoryBudgetStore();
    const limits = { resultLimit: 3, windowMs: 60_000, maxAttemptsPerWindow: 3 };
    const first = store.reserveAttempt("p1", "generate-image", limits);
    assert.equal(first.remainingAttempts, 2);
    const second = store.reserveAttempt("p1", "generate-image", limits);
    assert.equal(second.remainingAttempts, 1);
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
