// 채택 결정 순수 로직 (P5-4, 개선 지시서 P5 items 8-13) — 수집한 레퍼런스
// (CollectedReference)에 적용/참고만/제외를 누르면 ReferenceAdoption을 만든다.
// confirmBrief.ts는 이미 references.referenceAdoptions를 읽어 status==="applied"만
// 브리프에 반영하도록 되어 있었다(P1) — 여기서 처음으로 실제 생성자를 붙인다.

import type {
  AdoptionAspect,
  AdoptionStatus,
  CollectedReference,
  ReferenceAdoption,
  ReferenceCandidate,
  ReferenceResult,
} from "./types";

// 같은 (페이지, 섹션, 수집 항목) 조합은 항상 같은 adoptionId를 가진다 — 버튼을
// 다시 눌러도 새 항목이 쌓이지 않고 기존 결정을 갱신한다.
export function adoptionKey(pageId: string, sectionId: string, collectedId: string): string {
  return `${pageId}::${sectionId}::${collectedId}`;
}

export function buildReferenceCandidate(
  collected: CollectedReference,
  now: () => string = defaultNow,
): ReferenceCandidate {
  return {
    provider: "manual",
    providerId: collected.id,
    title: collected.title,
    sourceUrl: collected.sourceUrl,
    thumbnailUrl: collected.thumbnail,
    patterns: [],
    colors: [],
    usage: "inspiration-only",
    fetchedAt: now(),
  };
}

export function adoptionsForSection(
  references: ReferenceResult,
  pageId: string,
  sectionId: string,
): ReferenceAdoption[] {
  return Object.values(references.referenceAdoptions ?? {}).filter(
    (a) => a.pageId === pageId && a.sectionId === sectionId,
  );
}

export function adoptionForCollected(
  references: ReferenceResult,
  pageId: string,
  sectionId: string,
  collectedId: string,
): ReferenceAdoption | undefined {
  return references.referenceAdoptions?.[adoptionKey(pageId, sectionId, collectedId)];
}

interface SetAdoptionInput {
  pageId: string;
  sectionId: string;
  collected: CollectedReference;
  status: AdoptionStatus;
  aspects?: AdoptionAspect[];
  note?: string;
}

// 사용자가 버튼을 눌러 만드는 결정이므로 source는 항상 "user"(직접 채택 —
// P5-2의 "rule" 로컬 추천과 성격이 다르다). 기존 결정이 있으면 aspects/note를
// 생략한 호출도 이전 값을 보존한다(예: 상태만 "제외"로 바꾸는 경우).
export function setAdoption(
  references: ReferenceResult,
  input: SetAdoptionInput,
  now: () => string = defaultNow,
): ReferenceResult {
  const key = adoptionKey(input.pageId, input.sectionId, input.collected.id);
  const existing = references.referenceAdoptions?.[key];
  const adoption: ReferenceAdoption = {
    adoptionId: key,
    pageId: input.pageId,
    sectionId: input.sectionId,
    reference: buildReferenceCandidate(input.collected, now),
    status: input.status,
    aspects: input.aspects ?? existing?.aspects ?? [],
    note: input.note ?? existing?.note ?? "",
    decision: { source: "user", freshness: "current", basedOnHash: "" },
  };
  return {
    ...references,
    referenceAdoptions: { ...(references.referenceAdoptions ?? {}), [key]: adoption },
  };
}

export function removeAdoption(
  references: ReferenceResult,
  pageId: string,
  sectionId: string,
  collectedId: string,
): ReferenceResult {
  const key = adoptionKey(pageId, sectionId, collectedId);
  if (!references.referenceAdoptions?.[key]) return references;
  const next = { ...references.referenceAdoptions };
  delete next[key];
  return { ...references, referenceAdoptions: next };
}

function defaultNow(): string {
  return new Date().toISOString();
}
