// provider 호출 라우트 공통 진입 가드 (P10 "서버 호출 제한" + "관측성").
//
// target-analyze/generate-image 두 곳에서 먼저 만들었던 "예산 체크 → 429 응답 →
// 관측성 로그"를 그대로 복붙하면 나머지 provider 라우트(analyze/mood/concept 등)
// 9곳에서 같은 코드가 반복된다. 그 반복이 실제로 나타난 시점이라 여기서 한 번만
// 정의한다 — 각 라우트는 checkBudget/logSuccess/logFailure만 호출한다.

import { NextResponse } from "next/server";
import {
  ANONYMOUS_PROJECT_ID,
  budgetStore,
  FEATURE_LIMITS,
} from "./providerBudget";
import { classifyError, logProviderEvent } from "./observability";

export interface BudgetGate {
  ok: boolean;
  projectId: string;
  requestId: string;
  startedAt: number;
  // ok=false일 때만 채워짐 — 라우트는 이 응답을 그대로 return한다.
  response?: NextResponse;
}

// 입력 검증을 통과한 뒤에만 호출한다 — 캐시 적중·입력 거절은 예산을 차감하지 않는다.
export function checkBudget(
  req: Request,
  feature: keyof typeof FEATURE_LIMITS,
  exhaustedMessage: string,
): BudgetGate {
  const projectId = req.headers.get("x-project-id") || ANONYMOUS_PROJECT_ID;
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const budget = budgetStore.reserveAttempt(projectId, feature, FEATURE_LIMITS[feature]);
  if (budget.ok) {
    return { ok: true, projectId, requestId, startedAt };
  }

  logProviderEvent({
    feature,
    event: budget.reason === "PROJECT_BUDGET_EXHAUSTED" ? "budget_exhausted" : "rate_limited",
    projectId,
    requestId,
    statusCode: 429,
    latencyMs: Date.now() - startedAt,
    remainingResults: budget.remainingResults,
    remainingAttempts: budget.remainingAttempts,
  });
  const response = NextResponse.json(
    {
      error:
        budget.reason === "PROJECT_BUDGET_EXHAUSTED"
          ? exhaustedMessage
          : `요청이 너무 잦습니다. ${budget.retryAfterSeconds}초 후 다시 시도해주세요.`,
      reason: budget.reason,
      retryAfterSeconds: budget.retryAfterSeconds,
      remainingAttempts: budget.remainingAttempts,
      remainingResults: budget.remainingResults,
    },
    {
      status: 429,
      headers: budget.retryAfterSeconds ? { "Retry-After": String(budget.retryAfterSeconds) } : undefined,
    },
  );
  return { ok: false, projectId, requestId, startedAt, response };
}

export function recordSuccess(feature: keyof typeof FEATURE_LIMITS, gate: BudgetGate): void {
  budgetStore.recordSuccess(gate.projectId, feature);
  logProviderEvent({
    feature,
    event: "success",
    projectId: gate.projectId,
    requestId: gate.requestId,
    statusCode: 200,
    latencyMs: Date.now() - gate.startedAt,
  });
}

export function recordFailure(feature: keyof typeof FEATURE_LIMITS, gate: BudgetGate, e: unknown): void {
  logProviderEvent({
    feature,
    event: "failure",
    projectId: gate.projectId,
    requestId: gate.requestId,
    statusCode: 502,
    latencyMs: Date.now() - gate.startedAt,
    errorCode: classifyError(e),
  });
}
