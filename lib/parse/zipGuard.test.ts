import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { assertZipSafe, DecompressBudget, ZipBombError, type ZipGuardLimits } from "./zipGuard";

const BASE_LIMITS: ZipGuardLimits = {
  maxEntries: 100,
  maxEntryUncompressedBytes: 1_000_000,
  maxTotalUncompressedBytes: 2_000_000,
  maxCompressionRatio: 50,
  ratioCheckMinBytes: 10_000,
};

// 반복 문자는 DEFLATE로 극단적으로 잘 압축돼(ratio 수백 배) zip bomb 패턴을 재현한다.
function repeatable(byteLength: number): string {
  return "a".repeat(byteLength);
}

// 유사 무작위 패턴 — 압축은 어느 정도 되지만 반복 문자만큼 극단적이지 않다.
function lowCompressibility(byteLength: number): string {
  let out = "";
  for (let i = 0; i < byteLength; i++) {
    out += String.fromCharCode(33 + ((i * 37 + i * i) % 90));
  }
  return out;
}

async function buildZip(
  entries: Record<string, string>,
  compress = true,
): Promise<JSZip> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) {
    zip.file(name, content);
  }
  const buf = await zip.generateAsync({
    type: "arraybuffer",
    compression: compress ? "DEFLATE" : "STORE",
    compressionOptions: { level: 9 },
  });
  return JSZip.loadAsync(buf);
}

describe("zipGuard — assertZipSafe (압축 해제 전 메타데이터 검사)", () => {
  it("정상 범위의 zip은 통과한다", async () => {
    const zip = await buildZip({ "a.xml": lowCompressibility(100) });
    assert.doesNotThrow(() => assertZipSafe(zip, BASE_LIMITS));
  });

  it("엔트리 개수가 상한을 넘으면 거부한다", async () => {
    const entries: Record<string, string> = {};
    for (let i = 0; i < BASE_LIMITS.maxEntries + 1; i++) entries[`f${i}.xml`] = "x";
    const zip = await buildZip(entries);
    assert.throws(() => assertZipSafe(zip, BASE_LIMITS), ZipBombError);
  });

  it("단일 엔트리 압축 해제 크기가 상한을 넘으면 거부한다", async () => {
    const zip = await buildZip({
      "big.xml": repeatable(BASE_LIMITS.maxEntryUncompressedBytes + 1),
    });
    assert.throws(() => assertZipSafe(zip, BASE_LIMITS), ZipBombError);
  });

  it("압축률이 비정상적인(bomb 패턴) 엔트리는 거부한다", async () => {
    // 압축 후 크기는 작지만 해제하면 ratioCheckMinBytes를 훌쩍 넘고, 압축률도
    // maxCompressionRatio를 크게 초과하는 zip bomb 전형 패턴.
    const zip = await buildZip({ "bomb.xml": repeatable(500_000) });
    assert.throws(() => assertZipSafe(zip, BASE_LIMITS), ZipBombError);
  });

  it("작은 파일은 압축률이 높아도 통과한다 (ratioCheckMinBytes 미만 오탐 방지)", async () => {
    const zip = await buildZip({ "tiny.xml": repeatable(200) });
    assert.doesNotThrow(() => assertZipSafe(zip, BASE_LIMITS));
  });

  it("개별 엔트리는 상한 이하지만 전체 누적이 상한을 넘으면 거부한다", async () => {
    const entries: Record<string, string> = {};
    // 개별 400,000바이트(상한 1,000,000 이하) × 6개 = 2,400,000 > 전체 상한 2,000,000
    for (let i = 0; i < 6; i++) entries[`p${i}.xml`] = lowCompressibility(400_000);
    const zip = await buildZip(entries);
    assert.throws(() => assertZipSafe(zip, BASE_LIMITS), ZipBombError);
  });

  it("fail-closed: _data 메타데이터가 없는 엔트리는 0바이트로 봐주지 않고 거부한다", () => {
    // JSZip 내부 구현이 바뀌거나 예상 밖 객체가 들어와 _data.uncompressedSize를
    // 못 읽는 상황을 재현 — 이때 0으로 간주해 통과시키면 핵심 방어가 조용히
    // 꺼진다(실제 리뷰에서 지적된 갭). undefined ?? 0처럼 fail-open이면 안 된다.
    const fakeZip = { files: { "a.xml": { dir: false } } } as unknown as JSZip;
    assert.throws(() => assertZipSafe(fakeZip, BASE_LIMITS), ZipBombError);
  });

  it("fail-closed: 크기 값이 숫자가 아니거나 음수면 거부한다", () => {
    const fakeZip = {
      files: {
        "a.xml": { dir: false, _data: { uncompressedSize: NaN, compressedSize: 10 } },
      },
    } as unknown as JSZip;
    assert.throws(() => assertZipSafe(fakeZip, BASE_LIMITS), ZipBombError);

    const negativeZip = {
      files: {
        "a.xml": { dir: false, _data: { uncompressedSize: 10, compressedSize: -1 } },
      },
    } as unknown as JSZip;
    assert.throws(() => assertZipSafe(negativeZip, BASE_LIMITS), ZipBombError);
  });
});

describe("zipGuard — DecompressBudget (실제 압축 해제 중 누적 재검사)", () => {
  it("누적이 한도 이하면 통과한다", () => {
    const budget = new DecompressBudget(1000);
    assert.doesNotThrow(() => {
      budget.consume(400);
      budget.consume(400);
    });
  });

  it("누적이 한도를 넘으면 그 시점에 거부한다", () => {
    const budget = new DecompressBudget(1000);
    budget.consume(600);
    assert.throws(() => budget.consume(600), ZipBombError);
  });
});
