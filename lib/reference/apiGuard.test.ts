import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkBudget, recordFailure, recordSuccess } from "./apiGuard";
import { budgetStore, FEATURE_LIMITS } from "./providerBudget";

// FEATURE_LIMITS는 모듈 싱글턴(budgetStore)을 공유하므로, 이 파일에서만 쓰는
// 가짜 feature 키를 등록해 다른 테스트/라우트의 예산과 절대 섞이지 않게 한다.
const TEST_FEATURE = "apiguard-test-feature";
(FEATURE_LIMITS as Record<string, { resultLimit: number; windowMs: number; maxAttemptsPerWindow: number }>)[
  TEST_FEATURE
] = { resultLimit: 1, windowMs: 60_000, maxAttemptsPerWindow: 2 };

function fakeRequest(projectId?: string): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: projectId ? { "x-project-id": projectId } : undefined,
  });
}

describe("checkBudget", () => {
  it("예산이 남아있으면 ok=true와 projectId/requestId/startedAt을 반환한다", () => {
    const gate = checkBudget(fakeRequest("proj-a"), TEST_FEATURE, "소진 메시지");
    assert.equal(gate.ok, true);
    assert.equal(gate.projectId, "proj-a");
    assert.ok(typeof gate.requestId === "string" && gate.requestId.length > 0);
    assert.ok(typeof gate.startedAt === "number");
    assert.equal(gate.response, undefined);
  });

  it("x-project-id 헤더가 없으면 익명 폴백 키로 묶인다", () => {
    const gate = checkBudget(fakeRequest(), TEST_FEATURE, "소진");
    assert.equal(gate.projectId, "anonymous");
  });

  it("예산 소진(PROJECT_BUDGET_EXHAUSTED) 시 429 응답에 전달한 메시지를 그대로 싣는다", async () => {
    const feature = "apiguard-test-exhausted";
    (FEATURE_LIMITS as Record<string, { resultLimit: number; windowMs: number; maxAttemptsPerWindow: number }>)[
      feature
    ] = { resultLimit: 1, windowMs: 60_000, maxAttemptsPerWindow: 5 };
    const projectId = "proj-exhausted";
    const first = checkBudget(fakeRequest(projectId), feature, "다 썼습니다");
    recordSuccess(feature, first);
    const second = checkBudget(fakeRequest(projectId), feature, "다 썼습니다");
    assert.equal(second.ok, false);
    assert.ok(second.response);
    assert.equal(second.response!.status, 429);
    const body = await second.response!.json();
    assert.equal(body.error, "다 썼습니다");
    assert.equal(body.reason, "PROJECT_BUDGET_EXHAUSTED");
  });

  it("윈도우 rate limit 시 Retry-After 헤더와 초 단위 메시지를 싣는다", async () => {
    const feature = "apiguard-test-ratelimited";
    (FEATURE_LIMITS as Record<string, { resultLimit: number; windowMs: number; maxAttemptsPerWindow: number }>)[
      feature
    ] = { resultLimit: 99, windowMs: 60_000, maxAttemptsPerWindow: 1 };
    const projectId = "proj-ratelimited";
    checkBudget(fakeRequest(projectId), feature, "소진");
    const second = checkBudget(fakeRequest(projectId), feature, "소진");
    assert.equal(second.ok, false);
    assert.ok(second.response!.headers.get("Retry-After"));
    const body = await second.response!.json();
    assert.equal(body.reason, "RATE_LIMITED");
    assert.ok(body.error.includes("초 후 다시 시도"));
  });
});

describe("recordSuccess / recordFailure", () => {
  it("recordSuccess는 budgetStore의 성공 카운트를 올린다", () => {
    const feature = "apiguard-test-success";
    (FEATURE_LIMITS as Record<string, { resultLimit: number; windowMs: number; maxAttemptsPerWindow: number }>)[
      feature
    ] = { resultLimit: 2, windowMs: 60_000, maxAttemptsPerWindow: 5 };
    const gate = checkBudget(fakeRequest("proj-success"), feature, "소진");
    assert.equal(gate.ok, true);
    recordSuccess(feature, gate);
    const after = budgetStore.reserveAttempt("proj-success", feature, FEATURE_LIMITS[feature]);
    assert.equal(after.remainingResults, 1, "recordSuccess 한 번 뒤 remainingResults가 1 줄어야 한다");
  });

  it("recordFailure를 호출해도 예외를 던지지 않는다", () => {
    const gate = checkBudget(fakeRequest("proj-failure"), TEST_FEATURE, "소진");
    assert.doesNotThrow(() => recordFailure(TEST_FEATURE, gate, new Error("provider 502")));
  });
});
