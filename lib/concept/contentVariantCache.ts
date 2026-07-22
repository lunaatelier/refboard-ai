// 온디맨드 콘텐츠 변형 매핑(§6.7, P1 item12)의 캐시 키·최신성 판정 — 순수 함수만.
// 실제 저장은 서버 캐시가 아니라 ConceptOption.contentVariantMappings(옵션에 이미
// 스코프됨)를 그대로 재사용한다. 이 파일은 "그 재사용이 안전한지"만 판정한다.

// content-variant 라우트(카피 재작성 프롬프트) 전용 버전 — 기본 컨셉 생성 프롬프트의
// concept.sourceBasis.revision.promptVersion과는 다른 축이다. 이 상수가 바뀌면
// IndexedDB에서 복구된 옛 매핑(예전 프롬프트로 생성된 카피)을 재사용하지 않는다.
export const CONTENT_VARIANT_PROMPT_VERSION = "content-variant-v1";

export interface ContentVariantCacheKeyInput {
  conceptOptionId: string;
  contentVariantId: string;
  generationId?: string;
}

export function buildContentVariantCacheKey(input: ContentVariantCacheKeyInput): string {
  return [
    input.conceptOptionId,
    input.contentVariantId,
    input.generationId ?? "no-generation",
  ].join("::");
}

// 요청을 보낸 시점의 컨셉 generationId와, 응답이 돌아온 시점의 최신 generationId가
// 다르면 그 사이 컨셉이 재생성된 것이다 — 같은 브리프로 다시 생성해도 generationId는
// 매번 새로 발급되므로 "동일 입력 재생성"도 이 비교로 잡아낸다(briefHash만 비교하면
// 놓치는 경우). 이 응답은 더 이상 유효하지 않으니 병합하지 않는다.
export function isStaleContentVariantResult(
  requestedGenerationId: string | undefined,
  currentGenerationId: string | undefined,
): boolean {
  return requestedGenerationId !== currentGenerationId;
}
