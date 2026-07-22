import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adoptionForCollected,
  adoptionKey,
  adoptionsForSection,
  buildReferenceCandidate,
  removeAdoption,
  setAdoption,
} from "./adoption";
import type { CollectedReference, ReferenceResult } from "./types";

const collected: CollectedReference = {
  id: "col-1",
  platform: "Dribbble",
  title: "Dashboard shot",
  sourceUrl: "https://dribbble.com/shots/1",
  usage: "inspiration-only",
};

const fixedNow = () => "2026-07-21T00:00:00.000Z";

describe("adoptionKey", () => {
  it("동일한 (페이지,섹션,수집id) 조합이면 항상 같다", () => {
    assert.equal(adoptionKey("p1", "s1", "col-1"), adoptionKey("p1", "s1", "col-1"));
  });

  it("셋 중 하나라도 다르면 다른 키다", () => {
    assert.notEqual(adoptionKey("p1", "s1", "col-1"), adoptionKey("p1", "s2", "col-1"));
  });
});

describe("buildReferenceCandidate", () => {
  it("CollectedReference를 manual provider 스냅샷으로 변환한다", () => {
    const candidate = buildReferenceCandidate(collected, fixedNow);
    assert.deepEqual(candidate, {
      provider: "manual",
      providerId: "col-1",
      title: "Dashboard shot",
      sourceUrl: "https://dribbble.com/shots/1",
      thumbnailUrl: undefined,
      patterns: [],
      colors: [],
      usage: "inspiration-only",
      fetchedAt: "2026-07-21T00:00:00.000Z",
    });
  });
});

describe("setAdoption / adoptionForCollected / adoptionsForSection", () => {
  it("source=user로 새 채택 결정을 만든다", () => {
    const next = setAdoption(
      {},
      {
        pageId: "p1",
        sectionId: "s1",
        collected,
        status: "applied",
        aspects: ["layout", "color"],
        note: "hero 참고",
        basedOnHash: "basis-1",
      },
      fixedNow,
    );
    const found = adoptionForCollected(next, "p1", "s1", "col-1");
    assert.equal(found?.status, "applied");
    assert.deepEqual(found?.aspects, ["layout", "color"]);
    assert.equal(found?.note, "hero 참고");
    assert.equal(found?.decision.source, "user");
    assert.equal(found?.decision.basedOnHash, "basis-1");
    assert.equal(found?.reference.provider, "manual");
  });

  it("같은 키를 다시 호출하면 항목이 늘지 않고 갱신된다", () => {
    let references: ReferenceResult = setAdoption(
      {},
      { pageId: "p1", sectionId: "s1", collected, status: "applied", basedOnHash: "basis-1" },
      fixedNow,
    );
    references = setAdoption(
      references,
      { pageId: "p1", sectionId: "s1", collected, status: "excluded", basedOnHash: "basis-1" },
      fixedNow,
    );
    assert.equal(Object.keys(references.referenceAdoptions ?? {}).length, 1);
    assert.equal(adoptionForCollected(references, "p1", "s1", "col-1")?.status, "excluded");
  });

  it("이후 호출에서 aspects/note를 생략하면 이전 값을 보존한다", () => {
    let references: ReferenceResult = setAdoption(
      {},
      {
        pageId: "p1",
        sectionId: "s1",
        collected,
        status: "applied",
        aspects: ["layout"],
        note: "메모",
        basedOnHash: "basis-1",
      },
      fixedNow,
    );
    references = setAdoption(
      references,
      { pageId: "p1", sectionId: "s1", collected, status: "reference-only", basedOnHash: "basis-2" },
      fixedNow,
    );
    const found = adoptionForCollected(references, "p1", "s1", "col-1");
    assert.equal(found?.status, "reference-only");
    assert.deepEqual(found?.aspects, ["layout"]);
    assert.equal(found?.note, "메모");
    assert.equal(found?.decision.basedOnHash, "basis-2");
  });

  it("adoptionsForSection은 해당 페이지+섹션만 골라낸다", () => {
    let references: ReferenceResult = setAdoption(
      {},
      { pageId: "p1", sectionId: "s1", collected, status: "applied", basedOnHash: "basis-1" },
      fixedNow,
    );
    references = setAdoption(
      references,
      {
        pageId: "p1",
        sectionId: "s2",
        collected: { ...collected, id: "col-2" },
        status: "applied",
        basedOnHash: "basis-1",
      },
      fixedNow,
    );
    assert.equal(adoptionsForSection(references, "p1", "s1").length, 1);
    assert.equal(adoptionsForSection(references, "p1", "s2").length, 1);
    assert.equal(adoptionsForSection(references, "p1", "s3").length, 0);
  });
});

describe("removeAdoption", () => {
  it("항목을 완전히 지운다", () => {
    let references: ReferenceResult = setAdoption(
      {},
      { pageId: "p1", sectionId: "s1", collected, status: "applied", basedOnHash: "basis-1" },
      fixedNow,
    );
    references = removeAdoption(references, "p1", "s1", "col-1");
    assert.equal(adoptionForCollected(references, "p1", "s1", "col-1"), undefined);
  });

  it("해당 키에 아무것도 없으면 그대로 반환한다(no-op)", () => {
    const references: ReferenceResult = {};
    assert.equal(removeAdoption(references, "p1", "s1", "col-1"), references);
  });
});
