import type { WorkerLike } from "./parseDocumentLocally";

// 실제 브라우저 Worker 생성 — parseDocumentLocally.ts 밖으로 분리해 둔 이유:
// `new Worker(new URL(..., import.meta.url))` 구문은 tsconfig.test.json
// (module: commonjs, node:test 실행용) 아래에서 파싱 에러(TS1343)를 낸다. 이
// 파일은 실제 호출부(app/page.tsx)에서만 import되고 어떤 테스트도 참조하지
// 않으므로 테스트 컴파일 그래프에 들어오지 않는다.
export function createParseWorker(): WorkerLike {
  return new Worker(new URL("./parse.worker.ts", import.meta.url), {
    type: "module",
  });
}
