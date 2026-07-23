// 프로젝트별 서버 호출 예산 (P10-B, §P10 "서버 호출 제한").
//
// "결과 한도"(resultLimit)와 "윈도우당 시도 한도"(maxAttemptsPerWindow)를 분리한다 —
// §P4 호출 효율 기준 표의 "최대 3개/최대 3장"은 성공한 결과 개수 기준이지, provider가
// 실패해도 딱 3번만 시도 가능하다는 뜻이 아니다. 그대로 시도 횟수로 쓰면 provider가
// 한 번 삐끗한 것만으로 사용자가 남은 정당한 결과를 못 만들게 된다.
//
// 계산 규칙:
// - 캐시 적중, 입력 검증 실패 → 둘 다 차감하지 않음 (reserveAttempt를 아예 부르지 않음)
// - 외부 호출 시도(성공/실패 모두) → windowHits 차감(슬라이딩 윈도우)
// - 외부 호출 성공 → results도 함께 차감 (recordSuccess)
//
// (2026-07-23 수정) 이전 버전은 시도 횟수를 "48시간 미활동 시 정리"되는 누적 카운터로만
// 관리해 사실상 시간 구간 제한이 아니었다 — RATE_LIMITED를 반환하면서도 "잠시 후
// 다시 시도"가 실제로 몇 초 후인지 알려줄 수 없었다(외부 리뷰로 지적됨). 슬라이딩
// 윈도우(windowMs 안의 시도 타임스탬프)로 바꿔 retryAfterSeconds를 정확히 계산한다.
//
// 지금은 서버 메모리 1차 구현이다 — Vercel 서버리스는 인스턴스가 여러 개 뜨거나
// 재시작될 수 있어 완전한 강제가 아니다(§P10 1351번째 줄과 동일한 한계). 실사용자가
// 늘어나면 이 BudgetStore 인터페이스의 구현체만 Redis/KV 등 공유 저장소로 교체한다.

export type BudgetDenyReason = "RATE_LIMITED" | "PROJECT_BUDGET_EXHAUSTED";

export interface BudgetCheck {
  ok: boolean;
  reason?: BudgetDenyReason;
  remainingResults?: number;
  // RATE_LIMITED일 때만 의미 있음 — 이번 윈도우 안에서 남은 시도 수.
  remainingAttempts?: number;
  // RATE_LIMITED일 때만 채워짐 — 몇 초 후 재시도가 통과할 수 있는지(HTTP Retry-After용).
  retryAfterSeconds?: number;
}

export interface FeatureLimits {
  resultLimit: number;
  windowMs: number;
  maxAttemptsPerWindow: number;
}

export interface BudgetStore {
  reserveAttempt(projectId: string, feature: string, limits: FeatureLimits): BudgetCheck;
  recordSuccess(projectId: string, feature: string): void;
}

interface FeatureCounter {
  results: number;
  lastActivity: number;
  // 윈도우 안의 시도 타임스탬프만 보관 — 개수가 작아(수 개) 배열로 충분하다.
  windowHits: number[];
}

// 마지막 활동 후 이 시간이 지나면 메모리 정리 대상 — 예산을 일찍 리셋하려는 목적이
// 아니라(그러면 한도를 우회하게 됨), 오래된 projectId가 계속 쌓여 메모리가 무한정
// 늘어나는 것만 막는 하우스키핑이다. 윈도우 기반 rate limit과는 별개.
const STALE_MS = 48 * 60 * 60 * 1000;

export class InMemoryBudgetStore implements BudgetStore {
  private projects = new Map<string, Map<string, FeatureCounter>>();

  reserveAttempt(projectId: string, feature: string, limits: FeatureLimits): BudgetCheck {
    this.sweep();
    let counters = this.projects.get(projectId);
    if (!counters) {
      counters = new Map();
      this.projects.set(projectId, counters);
    }
    const counter = counters.get(feature) ?? { results: 0, lastActivity: Date.now(), windowHits: [] };
    if (counter.results >= limits.resultLimit) {
      return { ok: false, reason: "PROJECT_BUDGET_EXHAUSTED", remainingResults: 0 };
    }

    const now = Date.now();
    const windowStart = now - limits.windowMs;
    counter.windowHits = counter.windowHits.filter((t) => t > windowStart);

    if (counter.windowHits.length >= limits.maxAttemptsPerWindow) {
      const oldestHit = counter.windowHits[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestHit + limits.windowMs - now) / 1000));
      counters.set(feature, counter);
      return {
        ok: false,
        reason: "RATE_LIMITED",
        remainingResults: limits.resultLimit - counter.results,
        remainingAttempts: 0,
        retryAfterSeconds,
      };
    }

    counter.windowHits.push(now);
    counter.lastActivity = now;
    counters.set(feature, counter);
    return {
      ok: true,
      remainingResults: limits.resultLimit - counter.results,
      remainingAttempts: limits.maxAttemptsPerWindow - counter.windowHits.length,
    };
  }

  recordSuccess(projectId: string, feature: string): void {
    const counter = this.projects.get(projectId)?.get(feature);
    if (!counter) return;
    counter.results += 1;
    counter.lastActivity = Date.now();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [projectId, counters] of this.projects) {
      for (const [feature, counter] of counters) {
        if (now - counter.lastActivity > STALE_MS) counters.delete(feature);
      }
      if (counters.size === 0) this.projects.delete(projectId);
    }
  }
}

// 요청마다 새로 만들면 카운트가 유지되지 않으므로 모듈 싱글턴으로 둔다. 같은 서버
// 인스턴스로 오는 요청끼리만 공유된다(위 파일 상단 설명 참고).
export const budgetStore: BudgetStore = new InMemoryBudgetStore();

// 프로젝트 식별자가 없는 호출(구버전 클라이언트, 직접 호출 등)은 이 공용 키로
// 묶는다 — 완전히 열어두는 것보다 안전한 폴백.
export const ANONYMOUS_PROJECT_ID = "anonymous";

export const FEATURE_LIMITS: Record<string, FeatureLimits> = {
  // §P4: 브랜드 심층 분석 최대 3개 + 1분당 5회 시도까지(재시도 여유, 폭주 방지)
  "target-analyze": { resultLimit: 3, windowMs: 60_000, maxAttemptsPerWindow: 5 },
  // §P4: 이미지 생성 최대 3장 + 1분당 5회 시도까지
  "generate-image": { resultLimit: 3, windowMs: 60_000, maxAttemptsPerWindow: 5 },
};
