// 공통 관측성 모듈 (P10 "관측성과 개인정보 보호").
//
// 기록 대상은 로드맵이 명시한 것만: provider/feature별 호출 수, 성공/실패, latency,
// cache hit/in-flight dedupe 횟수, rate limit 잔여 상태·예산 사용량, stale 응답 폐기
// 횟수와 오류 코드. 요청 상관관계는 비식별 project/request id로만 추적한다.
//
// 절대 넣지 않는 것: 프롬프트 전문, 문서 문장, 마스킹 전후 콘텐츠, 회사 토큰, 사용자
// 메모. 그래서 이 파일의 타입은 자유 문자열(message 등)을 받는 필드를 두지 않는다 —
// 호출부가 실수로 에러 메시지·응답 본문을 통째로 넘겨도 로그에 안 남게, 허용 필드를
// 화이트리스트로 좁혀둔다.

export type ObservabilityEvent =
  | "attempt"
  | "success"
  | "failure"
  | "cache_hit"
  | "in_flight_dedupe"
  | "rate_limited"
  | "budget_exhausted"
  | "stale_discarded";

export interface ProviderLogEntry {
  feature: string; // "target-analyze" | "generate-image" | ... (FEATURE 상수와 맞춤)
  event: ObservabilityEvent;
  projectId?: string; // 이미 비식별 — providerBudget의 projectId(클라이언트 발급 UUID) 재사용
  requestId?: string; // 이 호출 1건의 상관관계 id
  statusCode?: number;
  latencyMs?: number;
  cacheHit?: boolean;
  remainingResults?: number;
  remainingAttempts?: number;
  errorCode?: string; // Error.name 등 짧은 분류값만 — message 금지(§아래 classifyError)
}

// 에러 메시지는 provider 응답 일부(예: 외부 API가 돌려준 문장)를 포함할 수 있어 로그에
// 남기지 않는다. Error.name(TypeError, AbortError 등) 정도의 짧은 분류만 사용한다.
export function classifyError(e: unknown): string {
  if (e instanceof Error) return e.name || "Error";
  return "UnknownError";
}

// 실제 출력 지점 — 지금은 구조화 JSON을 stdout에 쓴다(Vercel이 그대로 수집).
// 나중에 별도 로그 수집기로 바꾸더라도 호출부는 logProviderEvent만 쓰면 되게 이 함수만
// 교체한다.
function emit(record: Record<string, unknown>): void {
  console.log(JSON.stringify(record));
}

export function logProviderEvent(entry: ProviderLogEntry): void {
  // 허용 필드만 명시적으로 골라 쓴다 — entry에 다른 필드가 실려와도 무시된다.
  emit({
    type: "provider_event",
    ts: new Date().toISOString(),
    feature: entry.feature,
    event: entry.event,
    projectId: entry.projectId,
    requestId: entry.requestId,
    statusCode: entry.statusCode,
    latencyMs: entry.latencyMs,
    cacheHit: entry.cacheHit,
    remainingResults: entry.remainingResults,
    remainingAttempts: entry.remainingAttempts,
    errorCode: entry.errorCode,
  });
}
