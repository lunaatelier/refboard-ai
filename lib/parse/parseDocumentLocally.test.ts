import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { parseDocumentLocally, type WorkerLike } from "./parseDocumentLocally";
import { parseInWorker } from "./parseWorkerCore";
import type { ParseWorkerRequest, ParseWorkerResponse } from "./types";
import { MAX_DOCUMENT_BYTES } from "./types";

// 실제 DOM Worker는 Node 테스트 환경에 없으므로, WorkerLike 인터페이스를 구현하는
// 가짜 Worker를 주입해 parseDocumentLocally의 수명주기(성공/실패/타임아웃/취소)를
// 검증한다. onPost 훅은 postMessage가 "실제로 호출되는 시점"에 동기로 응답을
// 트리거한다 — 외부에서 queueMicrotask로 타이밍을 추측하면 file.arrayBuffer()가
// 몇 틱 만에 resolve되는지에 따라 레이스가 생긴다(실측: 응답이 postMessage보다
// 먼저 발사돼 유실됨). onPost는 postMessage 내부에서 호출되므로 항상 순서가 맞다.
class ManualFakeWorker implements WorkerLike {
  terminated = false;
  posted: ParseWorkerRequest[] = [];
  onPost?: (req: ParseWorkerRequest) => void;
  private messageListeners: ((ev: MessageEvent<ParseWorkerResponse>) => void)[] = [];
  private errorListeners: ((ev: ErrorEvent) => void)[] = [];

  postMessage(message: unknown): void {
    const req = message as ParseWorkerRequest;
    this.posted.push(req);
    this.onPost?.(req);
  }
  addEventListener(type: "message" | "error", listener: (ev: never) => void): void {
    if (type === "message") this.messageListeners.push(listener as never);
    else this.errorListeners.push(listener as never);
  }
  terminate(): void {
    this.terminated = true;
  }
  emitMessage(data: ParseWorkerResponse): void {
    for (const l of this.messageListeners) l({ data } as MessageEvent<ParseWorkerResponse>);
  }
  emitError(): void {
    for (const l of this.errorListeners) l({} as ErrorEvent);
  }
}

// 실제 parseWorkerCore(=진짜 워커가 쓰는 것과 동일한 코어 로직)를 호출해 응답하는
// Worker — 메시지 왕복 자체의 무결성(ArrayBuffer transfer 이후 데이터 손상 여부)
// 까지 함께 검증된다.
class AutoRespondingFakeWorker extends ManualFakeWorker {
  constructor() {
    super();
    this.onPost = (req) => {
      parseInWorker(req.ext, req.buffer)
        .then((result) => this.emitMessage({ id: req.id, ok: true, result }))
        .catch(() => this.emitMessage({ id: req.id, ok: false, error: "mock-parse-error" }));
    };
  }
}

async function validPptxFile(name = "doc.pptx"): Promise<File> {
  const zip = new JSZip();
  zip.file(
    "ppt/slides/slide1.xml",
    `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:txBody><a:r><a:t>표지</a:t></a:r></p:txBody></p:sld>`,
  );
  zip.file("[Content_Types].xml", "<Types/>");
  const buf = await zip.generateAsync({ type: "arraybuffer" });
  return new File([buf], name, { type: "application/vnd.openxmlformats" });
}

function fileOfSize(name: string, size: number): File {
  return new File([new Uint8Array(size)], name);
}

describe("parseDocumentLocally — Worker 수명주기", () => {
  it("성공 시 결과를 resolve하고 Worker를 terminate한다", async () => {
    const worker = new AutoRespondingFakeWorker();
    const result = await parseDocumentLocally(await validPptxFile(), { createWorker: () => worker });
    assert.ok(result.text.includes("표지"));
    assert.equal(worker.terminated, true);
  });

  it("Worker가 ok:false로 응답하면 그 에러 메시지로 reject하고 terminate한다", async () => {
    const worker = new ManualFakeWorker();
    worker.onPost = (req) => worker.emitMessage({ id: req.id, ok: false, error: "고정 에러 문구" });
    await assert.rejects(
      parseDocumentLocally(fileOfSize("doc.pptx", 10), { createWorker: () => worker }),
      /고정 에러 문구/,
    );
    assert.equal(worker.terminated, true);
  });

  it("타임아웃 시 reject하고 terminate한다", async () => {
    const worker = new ManualFakeWorker(); // 응답을 절대 보내지 않음
    await assert.rejects(
      () =>
        parseDocumentLocally(fileOfSize("doc.pptx", 10), {
          createWorker: () => worker,
          timeoutMs: 20,
        }),
      /파싱이 너무 오래 걸려/,
    );
    assert.equal(worker.terminated, true);
  });

  it("Worker 생성·파싱 요청 이후 취소하면 AbortError로 reject하고 진행 중이던 Worker를 terminate한다", async () => {
    const worker = new ManualFakeWorker();
    const controller = new AbortController();
    // postMessage가 실제로 불린 시점(= Worker가 만들어지고 파싱을 시작한 뒤)에
    // 취소한다 — 민감한 원문이 Worker 메모리에 떠 있는 실제 시나리오를 재현.
    worker.onPost = () => controller.abort();
    const promise = parseDocumentLocally(fileOfSize("doc.pptx", 10), {
      createWorker: () => worker,
      signal: controller.signal,
    });
    await assert.rejects(promise, (e: unknown) => e instanceof DOMException && e.name === "AbortError");
    assert.equal(worker.terminated, true);
  });

  it("Worker 생성 전(버퍼 읽는 중) 취소하면 Worker를 만들지 않고 AbortError로 reject한다", async () => {
    let created = false;
    const controller = new AbortController();
    const promise = parseDocumentLocally(fileOfSize("doc.pptx", 10), {
      createWorker: () => {
        created = true;
        return new ManualFakeWorker();
      },
      signal: controller.signal,
    });
    controller.abort(); // addEventListener("abort", ...)가 file.arrayBuffer() 호출 전에 이미 등록됨
    await assert.rejects(promise, (e: unknown) => e instanceof DOMException && e.name === "AbortError");
    assert.equal(created, false);
  });

  it("Worker error 이벤트 시 고정 문구로 reject하고 terminate한다", async () => {
    const worker = new ManualFakeWorker();
    worker.onPost = () => worker.emitError();
    await assert.rejects(
      parseDocumentLocally(fileOfSize("doc.pptx", 10), { createWorker: () => worker }),
      /파싱에 실패했습니다/,
    );
    assert.equal(worker.terminated, true);
  });

  it("요청 id가 다른 메시지는 무시하고 실제 응답만 반영한다", async () => {
    const worker = new AutoRespondingFakeWorker();
    const realOnPost = worker.onPost!;
    worker.onPost = (req) => {
      // 엉뚱한 id로 위조된 메시지를 먼저 흘려보내도 무시되고, 실제 응답만 처리돼야 한다.
      worker.emitMessage({ id: "other-id", ok: false, error: "무시돼야 함" });
      realOnPost(req);
    };
    const result = await parseDocumentLocally(await validPptxFile(), { createWorker: () => worker });
    assert.ok(result.text.includes("표지"));
  });

  it("20MB 초과 파일은 Worker를 만들지 않고 즉시 거부한다", async () => {
    let created = false;
    await assert.rejects(
      () =>
        parseDocumentLocally(fileOfSize("big.pptx", MAX_DOCUMENT_BYTES + 1), {
          createWorker: () => {
            created = true;
            return new ManualFakeWorker();
          },
        }),
      /20MB를 초과/,
    );
    assert.equal(created, false);
  });

  it("지원하지 않는 확장자는 Worker를 만들지 않고 즉시 거부한다", async () => {
    let created = false;
    await assert.rejects(
      () =>
        parseDocumentLocally(fileOfSize("doc.docx", 10), {
          createWorker: () => {
            created = true;
            return new ManualFakeWorker();
          },
        }),
      /pdf 또는 pptx만 지원/,
    );
    assert.equal(created, false);
  });
});
