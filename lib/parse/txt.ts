// 브라우저 파싱 — txt/md (phase1-masking-spec §7.1)
// 원문이 PC를 떠나지 않는 가장 강한 보안 경로. 서버 호출 없음.
// pdf/pptx는 lib/parse/parseDocumentLocally.ts(Worker, §7.2)로 처리된다 — 이쪽도
// 원문이 서버로 올라가지 않지만, 파싱 자체가 무거워 메인 스레드를 막지 않도록
// Worker에서 실행한다는 점만 txt/md와 다르다.

export const BROWSER_PARSABLE_EXTENSIONS = ["txt", "md"] as const;
export const WORKER_PARSABLE_EXTENSIONS = ["pdf", "pptx"] as const;

export function getExtension(fileName: string): string {
  return fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
}

export function isBrowserParsable(fileName: string): boolean {
  return (BROWSER_PARSABLE_EXTENSIONS as readonly string[]).includes(
    getExtension(fileName),
  );
}

export function isWorkerParsable(fileName: string): boolean {
  return (WORKER_PARSABLE_EXTENSIONS as readonly string[]).includes(
    getExtension(fileName),
  );
}

export async function parseTextFile(file: File): Promise<string> {
  return file.text();
}
