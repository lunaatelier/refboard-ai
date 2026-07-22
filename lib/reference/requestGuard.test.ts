import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RequestGuard } from "./requestGuard";

describe("RequestGuard — epoch", () => {
  it("begin() 직후 캡처한 epoch는 isCurrent다", () => {
    const guard = new RequestGuard();
    const { epoch } = guard.begin("directions");
    assert.equal(guard.isCurrent("directions", epoch), true);
  });

  it("같은 key로 다시 begin()하면 이전 epoch는 더 이상 current가 아니다", () => {
    const guard = new RequestGuard();
    const first = guard.begin("directions");
    const second = guard.begin("directions");
    assert.equal(guard.isCurrent("directions", first.epoch), false);
    assert.equal(guard.isCurrent("directions", second.epoch), true);
  });

  it("다른 key끼리는 서로 epoch에 영향을 주지 않는다", () => {
    const guard = new RequestGuard();
    const a = guard.begin("section-a");
    guard.begin("section-b");
    assert.equal(guard.isCurrent("section-a", a.epoch), true);
  });

  it("아직 begin()된 적 없는 key는 epoch 0을 기준으로 한다", () => {
    const guard = new RequestGuard();
    assert.equal(guard.isCurrent("never-started", 0), true);
    assert.equal(guard.isCurrent("never-started", 1), false);
  });
});

describe("RequestGuard — 이전 in-flight 요청 취소", () => {
  it("같은 key로 다시 begin()하면 이전 signal이 abort된다", () => {
    const guard = new RequestGuard();
    const first = guard.begin("directions");
    assert.equal(first.signal.aborted, false);
    guard.begin("directions");
    assert.equal(first.signal.aborted, true);
  });

  it("다른 key로 begin()해도 무관한 signal은 abort되지 않는다", () => {
    const guard = new RequestGuard();
    const a = guard.begin("section-a");
    guard.begin("section-b");
    assert.equal(a.signal.aborted, false);
  });

  it("같은 key를 한 번만 begin()하면 abort되지 않는다", () => {
    const guard = new RequestGuard();
    const { signal } = guard.begin("directions");
    assert.equal(signal.aborted, false);
  });
});

describe("RequestGuard — cancelAll (언마운트/탭 이동)", () => {
  it("모든 key의 signal이 abort된다", () => {
    const guard = new RequestGuard();
    const a = guard.begin("directions");
    const b = guard.begin("section-a");
    guard.cancelAll();
    assert.equal(a.signal.aborted, true);
    assert.equal(b.signal.aborted, true);
  });

  it("cancelAll 이전에 캡처된 epoch는 더 이상 current가 아니다", () => {
    const guard = new RequestGuard();
    const { epoch } = guard.begin("directions");
    guard.cancelAll();
    assert.equal(guard.isCurrent("directions", epoch), false);
  });

  it("cancelAll 이후 같은 key로 다시 begin()하면 정상적으로 current가 된다", () => {
    const guard = new RequestGuard();
    guard.begin("directions");
    guard.cancelAll();
    const next = guard.begin("directions");
    assert.equal(guard.isCurrent("directions", next.epoch), true);
  });
});
