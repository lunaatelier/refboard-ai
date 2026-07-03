import { finalizeMask } from "./apply";
import { detect } from "./detect";
import type { DictionaryEntry, UploadedFileMeta } from "./types";

// 파일명 마스킹 (실사용#32) — 파일명 자체에 인명·회사명이 노출될 수 있다.
// 예: "화면정의서_수정본_신연주.pptx" → "화면정의서_수정본_[담당자A].pptx"
// 업로드 목록·다운로드명 등 화면에는 displayName만 사용한다.
export function maskFileName(
  originalFileName: string,
  dictionary: DictionaryEntry[] = [],
): UploadedFileMeta {
  const detections = detect(originalFileName, dictionary);
  const { maskedText } = finalizeMask(originalFileName, detections);
  return { originalFileName, displayName: maskedText };
}
