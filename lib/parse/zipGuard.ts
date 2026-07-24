import type JSZip from "jszip";

// zip bomb 방어 — pptx는 zip이므로 작은 업로드 파일이 브라우저 메모리를 고갈시킬
// 만큼 부풀 수 있다. 반드시 압축 해제 전에(= .async() 호출 전에) 검사한다.
//
// JSZip은 loadAsync() 시점에 ZIP 중앙 디렉터리(central directory)를 먼저 읽어
// 각 엔트리의 compressedSize/uncompressedSize를 알아낸다(zipEntry.js
// readCentralPart) — 이 값은 실제 inflate 없이도 얻을 수 있는 헤더 메타데이터다.
// JSZipObject 공개 타입엔 없지만 zip.files[name]._data.{compressedSize,
// uncompressedSize}로 안정적으로 접근 가능하다(비공식이나 loadAsync 구현상
// 항상 채워짐 — object.js가 zipEntry.decompressed를 그대로 file()에 넘김).
interface ZipEntryInternalData {
  compressedSize?: number;
  uncompressedSize?: number;
}

export class ZipBombError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipBombError";
  }
}

export interface ZipGuardLimits {
  maxEntries: number;
  maxEntryUncompressedBytes: number;
  maxTotalUncompressedBytes: number;
  maxCompressionRatio: number;
  // 이 크기 미만인 엔트리는 압축률 검사에서 제외한다 — 작은 파일은 압축률이
  // 우연히 커도(예: 200바이트→4KB) 절대 크기가 무해하므로 오탐을 막는다.
  ratioCheckMinBytes: number;
}

export const DEFAULT_ZIP_GUARD_LIMITS: ZipGuardLimits = {
  maxEntries: 5000,
  maxEntryUncompressedBytes: 100 * 1024 * 1024, // 100MB
  maxTotalUncompressedBytes: 300 * 1024 * 1024, // 300MB
  maxCompressionRatio: 100,
  ratioCheckMinBytes: 1 * 1024 * 1024, // 1MB
};

// 압축 해제 전(메타데이터만으로) 검사 — loadAsync() 직후 어떤 엔트리도 .async()
// 하기 전에 호출한다.
export function assertZipSafe(
  zip: JSZip,
  limits: ZipGuardLimits = DEFAULT_ZIP_GUARD_LIMITS,
): void {
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);

  if (names.length > limits.maxEntries) {
    throw new ZipBombError(
      `압축 파일 항목이 너무 많습니다 (${names.length}개, 상한 ${limits.maxEntries}개).`,
    );
  }

  let totalUncompressed = 0;
  for (const name of names) {
    const data = (zip.files[name] as unknown as { _data?: ZipEntryInternalData })._data;
    const uncompressed = data?.uncompressedSize;
    const compressed = data?.compressedSize;

    // fail-closed: 크기 메타데이터를 못 읽으면(JSZip 내부 구현 변경, 예상 밖
    // 객체 등) 0으로 간주해 통과시키지 않는다 — 그러면 핵심 방어가 조용히
    // 꺼진다. 못 믿을 땐 거부한다.
    if (
      typeof uncompressed !== "number" ||
      !Number.isFinite(uncompressed) ||
      uncompressed < 0 ||
      typeof compressed !== "number" ||
      !Number.isFinite(compressed) ||
      compressed < 0
    ) {
      throw new ZipBombError("압축 파일 크기 정보를 확인할 수 없습니다.");
    }

    if (uncompressed > limits.maxEntryUncompressedBytes) {
      throw new ZipBombError("압축 해제 시 항목 하나의 크기가 비정상적으로 큽니다.");
    }

    if (
      uncompressed >= limits.ratioCheckMinBytes &&
      compressed > 0 &&
      uncompressed / compressed > limits.maxCompressionRatio
    ) {
      throw new ZipBombError("압축률이 비정상적인 항목이 있습니다.");
    }

    totalUncompressed += uncompressed;
    if (totalUncompressed > limits.maxTotalUncompressedBytes) {
      throw new ZipBombError("압축 해제 시 전체 크기가 너무 큽니다.");
    }
  }
}

// 실제 압축 해제 중 누적 크기 재검사 — 위 메타데이터 검사를 우회하는 손상되거나
// 조작된 zip(중앙 디렉터리 헤더값이 실제 데이터와 다른 경우)에 대한 2차 방어선.
// 엔트리를 .async()로 읽을 때마다 consume()을 호출한다.
export class DecompressBudget {
  private used = 0;
  constructor(private readonly limitBytes: number) {}

  consume(bytes: number): void {
    this.used += bytes;
    if (this.used > this.limitBytes) {
      throw new ZipBombError("압축 해제 누적 크기가 한도를 초과했습니다.");
    }
  }
}
