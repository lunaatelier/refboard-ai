// 브라우저 파싱 — txt/md (phase1-masking-spec §7.1)
// 원문이 PC를 떠나지 않는 가장 강한 보안 경로. 서버 호출 없음.
// pdf/pptx는 Step 5에서 /api/parse(서버, 메모리·무저장)로 추가된다.

export const BROWSER_PARSABLE_EXTENSIONS = ["txt", "md"] as const;
export const SERVER_PARSABLE_EXTENSIONS = ["pdf", "pptx"] as const; // Step 5

export function getExtension(fileName: string): string {
  return fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
}

export function isBrowserParsable(fileName: string): boolean {
  return (BROWSER_PARSABLE_EXTENSIONS as readonly string[]).includes(
    getExtension(fileName),
  );
}

export function isServerParsable(fileName: string): boolean {
  return (SERVER_PARSABLE_EXTENSIONS as readonly string[]).includes(
    getExtension(fileName),
  );
}

export async function parseTextFile(file: File): Promise<string> {
  return file.text();
}
