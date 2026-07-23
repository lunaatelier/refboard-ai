import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyError, logProviderEvent } from "./observability";

function captureLog(fn: () => void): string[] {
  const original = console.log;
  const lines: string[] = [];
  console.log = (msg?: unknown) => {
    lines.push(String(msg));
  };
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines;
}

describe("logProviderEvent", () => {
  it("허용된 필드만 구조화 JSON으로 출력한다", () => {
    const [line] = captureLog(() =>
      logProviderEvent({
        feature: "generate-image",
        event: "success",
        projectId: "proj-1",
        requestId: "req-1",
        statusCode: 200,
        latencyMs: 123,
        cacheHit: false,
        remainingResults: 2,
        remainingAttempts: 4,
      }),
    );
    const parsed = JSON.parse(line);
    assert.equal(parsed.type, "provider_event");
    assert.equal(parsed.feature, "generate-image");
    assert.equal(parsed.event, "success");
    assert.equal(parsed.projectId, "proj-1");
    assert.equal(parsed.requestId, "req-1");
    assert.equal(parsed.statusCode, 200);
    assert.equal(parsed.latencyMs, 123);
    assert.equal(parsed.cacheHit, false);
    assert.equal(parsed.remainingResults, 2);
    assert.equal(parsed.remainingAttempts, 4);
    assert.ok(typeof parsed.ts === "string");
  });

  it("entry에 화이트리스트 밖 필드를 실어도 출력에 안 남는다", () => {
    const [line] = captureLog(() =>
      logProviderEvent({
        feature: "target-analyze",
        event: "failure",
        // @ts-expect-error — 의도적으로 허용되지 않은 필드를 넣어 무시되는지 검증
        prompt: "민감할 수 있는 문서 원문 조각",
      }),
    );
    assert.ok(!line.includes("민감할 수 있는 문서 원문 조각"));
  });
});

describe("classifyError", () => {
  it("Error 인스턴스는 name만 반환하고 message는 버린다", () => {
    const err = new TypeError("내부 API 키 sk-live-12345가 유출된 메시지");
    const code = classifyError(err);
    assert.equal(code, "TypeError");
    assert.ok(!code.includes("sk-live"));
  });

  it("Error가 아닌 값은 UnknownError로 분류한다", () => {
    assert.equal(classifyError("문자열 에러"), "UnknownError");
    assert.equal(classifyError(null), "UnknownError");
  });
});
