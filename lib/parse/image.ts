// 단일 이미지 입력 (Step 16, Phase 1.5 확장) — 전부 브라우저에서 처리.
// 이미지 바이트는 서버 파싱이 필요 없으므로 자사 서버에도 올라가지 않는다.
// 외부(Gemini) 전송은 기존 Step 9 경로 그대로 opt-in 동의를 거친 경우에만.

import { bytesToBase64 } from "./base64";
import { getExtension } from "./txt";

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif"] as const;

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
};

// 이미지 전용 입력은 본문 텍스트가 없어 마스킹 게이트(maskedText 필수)를 통과할 수
// 없다. 이 플레이스홀더가 maskedText 역할을 한다 — 민감정보가 없는 고정 문구라 안전.
export const IMAGE_ONLY_PLACEHOLDER =
  "(이미지 전용 입력 — 본문 텍스트 없음. 이미지 분석 요약을 근거로 분석할 것)";

export function isImageFile(fileName: string): boolean {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(
    getExtension(fileName),
  );
}

export function imageMimeType(fileName: string): string {
  return IMAGE_MIME[getExtension(fileName)] ?? "image/png";
}

// 클립보드 붙여넣기용 — mime에서 확장자 유추해 합성 파일명 생성
export function clipboardFileName(mimeType: string): string {
  const ext =
    Object.entries(IMAGE_MIME).find(([, m]) => m === mimeType)?.[0] ?? "png";
  return `clipboard-${Date.now()}.${ext}`;
}

export async function fileToBase64(file: File): Promise<string> {
  return bytesToBase64(new Uint8Array(await file.arrayBuffer()));
}
