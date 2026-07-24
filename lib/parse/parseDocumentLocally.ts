import type {
  DocumentParseResult,
  ParseDocumentExt,
  ParseWorkerRequest,
  ParseWorkerResponse,
} from "./types";
import { MAX_DOCUMENT_BYTES } from "./types";

const PARSE_TIMEOUT_MS = 30_000;

const SIZE_ERROR = "파일이 20MB를 초과합니다.";
const UNSUPPORTED_ERROR = "pdf 또는 pptx만 지원합니다. (txt/md는 브라우저에서 처리)";
const GENERIC_ERROR = "파싱에 실패했습니다. 파일이 손상되지 않았는지 확인하세요.";
const TIMEOUT_ERROR = "파싱이 너무 오래 걸려 중단했습니다. 파일 크기를 확인해 주세요.";

// 실제 DOM Worker의 최소 인터페이스 — 테스트가 real Worker 없이 가짜 구현을
// 주입할 수 있게 추상화한다.
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (ev: MessageEvent) => void): void;
  addEventListener(type: "error", listener: (ev: ErrorEvent) => void): void;
  terminate(): void;
}

export interface ParseDocumentLocallyOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  // 실제 브라우저 Worker 생성은 lib/parse/createParseWorker.ts(호출부에서 import)가
  // 담당한다. 여기서 필수로 요구하는 이유: `new Worker(new URL(..., import.meta.url))`
  // 구문은 tsconfig.test.json(module: commonjs, node:test 실행용) 아래에서 파싱
  // 에러(TS1343)를 낸다 — 이 파일이 그 구문을 직접 갖지 않아야 테스트 컴파일
  // 그래프가 안전하다. 테스트는 가짜 WorkerLike를 주입한다.
  createWorker: () => WorkerLike;
}

function extOf(fileName: string): ParseDocumentExt | undefined {
  const ext = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
  return ext === "pdf" || ext === "pptx" ? ext : undefined;
}

let requestSeq = 0;
function nextRequestId(): string {
  requestSeq += 1;
  return `parse-${Date.now()}-${requestSeq}`;
}

// pdf/pptx를 브라우저 메모리에서만 파싱한다(P0 item 7 이관) — 원문이 자사
// 서버로도 올라가지 않는다. 파일 하나당 Worker를 새로 만들고 성공·실패·취소·
// 타임아웃 즉시 terminate()해 민감한 원문이 Worker 메모리에 오래 남지 않게 한다.
//
// ⚠️ 실패 시 서버(/api/parse)로 자동 폴백하지 않는다 — 그러면 원문이 다시
// 서버로 올라가고 Vercel Functions 4.5MB 요청 상한(§4.2)과 원문 무전송 원칙이
// 동시에 깨진다. 실패는 사용자에게 고정 문구로만 안내한다.
export async function parseDocumentLocally(
  file: File,
  options: ParseDocumentLocallyOptions,
): Promise<DocumentParseResult> {
  const ext = extOf(file.name);
  if (!ext) throw new Error(UNSUPPORTED_ERROR);
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error(SIZE_ERROR);
  if (options.signal?.aborted) throw new DOMException("취소됨", "AbortError");

  return new Promise<DocumentParseResult>((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let worker: WorkerLike | undefined;

    function settle(fn: () => void) {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", onAbort);
      worker?.terminate();
      fn();
    }

    const onAbort = () => settle(() => reject(new DOMException("취소됨", "AbortError")));
    // 버퍼를 읽기 전에(=아래 file.arrayBuffer() 이전에) 먼저 등록해야, 큰 파일을
    // 읽는 동안 취소돼도 놓치지 않는다.
    options.signal?.addEventListener("abort", onAbort);

    file
      .arrayBuffer()
      .then((buffer) => {
        if (settled) return; // 읽는 동안 이미 취소/타임아웃됨

        worker = options.createWorker();
        const id = nextRequestId();
        const timeoutMs = options.timeoutMs ?? PARSE_TIMEOUT_MS;

        worker.addEventListener("message", (event: MessageEvent<ParseWorkerResponse>) => {
          const data = event.data;
          if (!data || data.id !== id) return; // 다른 요청의 응답(원칙상 발생 안 함)은 무시
          if (data.ok) {
            settle(() => resolve(data.result));
          } else {
            settle(() => reject(new Error(data.error)));
          }
        });

        worker.addEventListener("error", () => {
          settle(() => reject(new Error(GENERIC_ERROR)));
        });

        timeoutId = setTimeout(() => {
          settle(() => reject(new Error(TIMEOUT_ERROR)));
        }, timeoutMs);

        const request: ParseWorkerRequest = { id, ext, buffer };
        worker.postMessage(request, [buffer]); // transfer list — 버퍼 복사 없이 소유권 이전
      })
      .catch(() => settle(() => reject(new Error(GENERIC_ERROR))));
  });
}
