// OCR 선마스킹 (Step 18) — 이미지 전송 동의 "전"에 브라우저에서 텍스트를 읽어
// 마스킹 엔진으로 민감어를 검사한다. 이미지·OCR 원문은 외부로 나가지 않는다.
//
// ⚠️ 보안 취급:
// - OCR 결과 원문은 원문(parsedText)급 민감 — 종류별 개수(findings)만 남기고 즉시 폐기.
// - tesseract.js는 최초 실행 시 엔진(WASM)·언어 데이터를 CDN에서 내려받는다.
//   내려받기만 있고 이미지가 업로드되는 것이 아니다 (OCR 연산은 전부 로컬).

import { detect } from "../masking/detect";
import type { DictionaryEntry, SensitiveKind } from "../masking/types";

export interface OcrFinding {
  kind: SensitiveKind;
  count: number;
}

export interface OcrScanResult {
  assetId: string;
  findings: OcrFinding[]; // 비민감 요약만 (원문 조각 없음)
  textLength: number; // 0이면 "글자 없는 이미지"로 안내
  failed?: boolean; // true면 해당 이미지만 인식 실패 — findings는 신뢰할 수 없음
}

// 순수 함수 — OCR 텍스트에서 비민감 요약만 뽑는다 (테스트 대상)
export function summarizeSensitiveText(
  assetId: string,
  ocrText: string,
  dictionary: DictionaryEntry[],
): OcrScanResult {
  const detections = detect(ocrText, dictionary);
  const byKind = new Map<SensitiveKind, number>();
  for (const d of detections) {
    byKind.set(d.kind, (byKind.get(d.kind) ?? 0) + 1);
  }
  return {
    assetId,
    findings: [...byKind].map(([kind, count]) => ({ kind, count })),
    textLength: ocrText.trim().length,
  };
}

// 브라우저 전용 — tesseract.js는 동적 import로 필요할 때만 로드
export async function scanImagesForSensitiveText(
  images: { assetId: string; dataUrl: string }[],
  dictionary: DictionaryEntry[],
  onProgress?: (done: number, total: number) => void,
): Promise<OcrScanResult[]> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["kor", "eng"]);
  try {
    const results: OcrScanResult[] = [];
    for (const [i, img] of images.entries()) {
      try {
        const { data } = await worker.recognize(img.dataUrl);
        results.push(
          summarizeSensitiveText(img.assetId, data.text, dictionary),
        );
      } catch {
        // 이 이미지 하나만 인식 실패 — 나머지 이미지 스캔은 계속 진행한다.
        results.push({ assetId: img.assetId, findings: [], textLength: 0, failed: true });
      }
      onProgress?.(i + 1, images.length);
    }
    return results;
  } finally {
    await worker.terminate();
  }
}
