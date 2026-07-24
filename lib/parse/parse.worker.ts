// pdf/pptx 브라우저 파싱 Worker (P0 item 7 이관). 원문 ArrayBuffer는 메인
// 스레드에서 transfer list로 넘어오며, 여기서만 파싱하고 결과만 돌려보낸다.
// 파일 내용·파일명을 postMessage 에러로 흘리지 않는다(route.ts와 동일 원칙).
//
// 타입 참고: 프로젝트 tsconfig는 전체를 "dom" lib 하나로 컴파일한다.
// "webworker" lib을 triple-slash로 끌어오면 전역 스코프가 오염돼(Window·
// EventTarget 등이 webworker 버전으로 바뀜) 나머지 앱 파일들의 DOM 타입이
// 전부 깨진다(실측 확인됨). 이 파일은 모듈(import/export 있음)이라 아래
// `declare const self`가 이 파일 안에서만 전역 self를 가리는 로컬 선언이 되므로
// 전역 오염 없이 Worker 컨텍스트 타입만 좁혀 쓸 수 있다.
declare const self: {
  onmessage: ((event: MessageEvent<ParseWorkerRequest>) => void) | null;
  postMessage: (message: ParseWorkerResponse) => void;
};

import type { ParseWorkerRequest, ParseWorkerResponse } from "./types";
import { parseInWorker } from "./parseWorkerCore";
import { ZipBombError } from "./zipGuard";

const GENERIC_ERROR = "파싱에 실패했습니다. 파일이 손상되지 않았는지 확인하세요.";
const ZIP_BOMB_ERROR = "파일 구조가 처리할 수 없는 크기입니다.";

self.onmessage = async (event) => {
  const { id, ext, buffer } = event.data;
  try {
    const result = await parseInWorker(ext, buffer);
    const response: ParseWorkerResponse = { id, ok: true, result };
    self.postMessage(response);
  } catch (e) {
    const response: ParseWorkerResponse = {
      id,
      ok: false,
      error: e instanceof ZipBombError ? ZIP_BOMB_ERROR : GENERIC_ERROR,
    };
    self.postMessage(response);
  }
};
