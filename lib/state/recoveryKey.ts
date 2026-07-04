import type { MaskMapping } from "../masking/types";

// 복원키 파일 내보내기/가져오기 (Step 14) — 클라이언트 전용.
// ⚠️ 이 파일에는 실명(raw)이 그대로 들어간다. 어떤 경우에도 서버로 보내지 않으며,
// 생성(다운로드)·해석(가져오기) 모두 브라우저 메모리에서만 수행한다.
// exportId로 분석 JSON과 짝을 맞춘다 — 다른 문서의 복원키가 잘못 적용되는 것을 차단.

export const RECOVERY_KEY_FORMAT = "drg-recovery-key";
const VERSION = 1;

export interface RecoveryKeyExport {
  format: typeof RECOVERY_KEY_FORMAT;
  version: number;
  savedAt: string;
  exportId: string;
  mappings: MaskMapping[];
}

export function buildRecoveryKeyExport(
  mappings: MaskMapping[],
  exportId: string,
): string {
  if (mappings.length === 0) throw new Error("내보낼 복원키가 없습니다.");
  const data: RecoveryKeyExport = {
    format: RECOVERY_KEY_FORMAT,
    version: VERSION,
    savedAt: new Date().toISOString(),
    exportId,
    mappings,
  };
  return JSON.stringify(data, null, 2);
}

export function parseRecoveryKeyImport(text: string): RecoveryKeyExport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("JSON 파싱에 실패했습니다.");
  }
  const data = raw as Partial<RecoveryKeyExport>;
  if (data?.format !== RECOVERY_KEY_FORMAT) {
    throw new Error("이 앱에서 저장한 복원키 파일이 아닙니다.");
  }
  if (typeof data.version !== "number" || data.version > VERSION) {
    throw new Error("지원하지 않는 복원키 파일 버전입니다.");
  }
  if (typeof data.exportId !== "string" || !data.exportId) {
    throw new Error("복원키 파일에 문서 식별자(exportId)가 없습니다.");
  }
  if (
    !Array.isArray(data.mappings) ||
    data.mappings.length === 0 ||
    !data.mappings.every(
      (m) =>
        typeof m?.token === "string" &&
        typeof m?.raw === "string" &&
        typeof m?.kind === "string",
    )
  ) {
    throw new Error("복원키 파일에 유효한 매핑이 없습니다.");
  }
  return {
    format: RECOVERY_KEY_FORMAT,
    version: data.version,
    savedAt: typeof data.savedAt === "string" ? data.savedAt : "",
    exportId: data.exportId,
    mappings: data.mappings as MaskMapping[],
  };
}
