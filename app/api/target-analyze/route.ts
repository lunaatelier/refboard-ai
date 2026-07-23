import { NextResponse } from "next/server";
import { generateGroundedJson } from "@/lib/ai/client";
import { buildDirectiveBlock } from "@/lib/ai/prompts";
import { buildVerifiedSources } from "@/lib/reference/sourceVerification";
import {
  ANONYMOUS_PROJECT_ID,
  budgetStore,
  FEATURE_LIMITS,
} from "@/lib/reference/providerBudget";
import { classifyError, logProviderEvent } from "@/lib/reference/observability";

// 분석 대상 브랜드 2단계 깊은 분석 (Step 10-c) — 7개 축을 구조화 질문으로 강제.
// grounding으로 출처 URL 확보 (환각 방지). 결과는 "추천/추정 포함" 배지로 표기.

export const runtime = "nodejs";

const FEATURE = "target-analyze";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { name, url, projectSummary } = body ?? {};
  if (typeof name !== "string" || typeof url !== "string") {
    return NextResponse.json(
      { error: "name/url이 필요합니다." },
      { status: 400 },
    );
  }
  const directives = Array.isArray(body?.directives) ? body.directives : [];

  // 입력 검증을 통과한 뒤에만 예산을 소진한다 — 캐시 적중·입력 거절은 차감하지
  // 않는다(P10-B). 프로젝트 ID가 없는 호출은 공용 폴백 키로 묶는다.
  const projectId = req.headers.get("x-project-id") || ANONYMOUS_PROJECT_ID;
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const budget = budgetStore.reserveAttempt(projectId, FEATURE, FEATURE_LIMITS[FEATURE]);
  if (!budget.ok) {
    logProviderEvent({
      feature: FEATURE,
      event: budget.reason === "PROJECT_BUDGET_EXHAUSTED" ? "budget_exhausted" : "rate_limited",
      projectId,
      requestId,
      statusCode: 429,
      latencyMs: Date.now() - startedAt,
      remainingResults: budget.remainingResults,
      remainingAttempts: budget.remainingAttempts,
    });
    return NextResponse.json(
      {
        error:
          budget.reason === "PROJECT_BUDGET_EXHAUSTED"
            ? "이 프로젝트에서 브랜드 심층 분석을 이미 최대 개수만큼 사용했습니다."
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
  }

  const prompt = `당신은 시니어 프로덕트 디자이너다. 웹 검색을 활용해 "${name}" (${url})의 디자인을 깊게 분석하라.
${buildDirectiveBlock(directives, "reference")}
우리 프로젝트 맥락: ${typeof projectSummary === "string" ? projectSummary : "-"}

아래 7개 축을 각각 구체적으로 답하라 (얕은 요약 금지):
1. layoutStrategy: 레이아웃 전략 — 정보구조, 네비게이션 배치와 그 이유
2. colorVisualStrategy: 컬러·비주얼 전략 — 메인 컬러 의도, 다크/라이트 선택 이유
3. componentPattern: 컴포넌트 패턴 — 데이터 표현 방식 (테이블/카드/차트 비중)
4. painPoints: 이 디자인의 약점 2~3개 (배열)
5. wowPoints: 배울 점 2~3개 (배열)
6. estimatedIntent: 왜 이렇게 디자인했나 — 타겟·비즈니스 맥락 추정
7. implications: 우리 프로젝트 시사점 — 차용할 것 / 피할 것

반드시 JSON만 출력:
{ "layoutStrategy": string, "colorVisualStrategy": string, "componentPattern": string,
  "painPoints": string[], "wowPoints": string[], "estimatedIntent": string,
  "implications": string, "sourceUrl": string(분석 근거 대표 URL) }`;

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const { data: raw, sources } = await generateGroundedJson<any>(prompt);
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const arr = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    const modelStatedUrl = str(raw?.sourceUrl) || undefined;
    const verifiedSources = await buildVerifiedSources(url, sources, modelStatedUrl);
    budgetStore.recordSuccess(projectId, FEATURE);
    logProviderEvent({
      feature: FEATURE,
      event: "success",
      projectId,
      requestId,
      statusCode: 200,
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({
      analysis: {
        layoutStrategy: str(raw?.layoutStrategy),
        colorVisualStrategy: str(raw?.colorVisualStrategy),
        componentPattern: str(raw?.componentPattern),
        painPoints: arr(raw?.painPoints),
        wowPoints: arr(raw?.wowPoints),
        estimatedIntent: str(raw?.estimatedIntent),
        implications: str(raw?.implications),
        sourceUrl: modelStatedUrl || url,
        verifiedSources,
      },
    });
  } catch (e) {
    logProviderEvent({
      feature: FEATURE,
      event: "failure",
      projectId,
      requestId,
      statusCode: 502,
      latencyMs: Date.now() - startedAt,
      errorCode: classifyError(e),
    });
    const message = e instanceof Error ? e.message : "분석에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
