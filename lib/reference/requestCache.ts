// 세션 요청 캐시 + 진행 중 요청 합치기 (P4) — 같은 provider/query/filter 조합을
// 반복 요청하지 않는다(개선 지시서 P4 완료 기준: "같은 검색을 연속 실행해도
// provider 호출은 한 번만 발생"). 메모리 전용 — 새로고침 시 소멸한다. 결과가
// 민감정보는 아니지만, 이 프로젝트는 워크플로 파생 캐시를 어디에도 영속화하지
// 않는 관례를 일관되게 따른다(§4.4).
//
// fetch 자체는 이 클래스가 하지 않는다 — 호출자가 fetcher를 주입한다(외부 호출은
// 항상 Route Handler에서만 한다는 원칙과, 이 클래스를 순수하게 테스트 가능하게
// 두기 위함).

export class SessionRequestCache<T> {
  private cache = new Map<string, T>();
  private inFlight = new Map<string, Promise<T>>();

  async get(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const promise = fetcher()
      .then((result) => {
        this.cache.set(key, result);
        this.inFlight.delete(key);
        return result;
      })
      .catch((err) => {
        this.inFlight.delete(key);
        throw err;
      });
    this.inFlight.set(key, promise);
    return promise;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }
}

// provider(unsplash/pexels 등)+query+filter 조합 → 안정적인 캐시 키. 대소문자·
// 좌우 공백·excludeKeywords 순서 차이로 같은 요청이 다른 키가 되지 않게 정규화한다.
export function buildImageQueryCacheKey(params: {
  query: string;
  colorHex?: string;
  excludeKeywords?: string[];
  page?: number;
}): string {
  const excludeKeywords = [...(params.excludeKeywords ?? [])]
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");
  return [
    params.query.trim().toLowerCase(),
    params.colorHex?.toLowerCase() ?? "",
    excludeKeywords,
    params.page ?? 1,
  ].join("::");
}

// 섹션 검색어 "AI로 다듬기"(기존 /api/section-queries) 배치 호출 캐시 키 — 같은
// 방향(directionHash)·같은 섹션 목록·같은 프롬프트 버전이면 재호출하지 않는다.
export function buildSectionQueriesCacheKey(params: {
  directionHash?: string;
  sectionIds: string[];
  promptVersion: string;
}): string {
  return [
    params.directionHash ?? "",
    [...params.sectionIds].sort().join(","),
    params.promptVersion,
  ].join("::");
}
