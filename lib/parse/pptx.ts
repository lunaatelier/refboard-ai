import JSZip from "jszip";
import type { LabeledEntityCandidate } from "../masking/types";
import type { DocumentParseResult, PptxImage } from "./types";
import { assertZipSafe, DecompressBudget } from "./zipGuard";

export type { PptxImage } from "./types";

// 서버 라우트·Worker 공용 — PPTX 텍스트+labeledEntities+이미지 추출 (phase1-masking-spec §7.2)
// pptx = zip 안의 slide XML. <a:t> 텍스트 런만 추출한다. 이미지는 opt-in 동의 전까지
// 외부로 나가지 않는다(Step 9). 슬라이드 헤더를 남겨 이후 분석(Step 7 sourceSlides 계보)에 활용한다.

const SLIDE_PATH = /^ppt\/slides\/slide(\d+)\.xml$/;

// 표 헤더 라벨 기반 자동 탐지 (예: 문서 개정 이력표의 "작성자"/"소속" 열) —
// personName/company는 정규식으로 못 잡지만(한국어 이름은 일반 단어와 구분
// 불가), 표의 헤더 셀이 이 라벨과 "정확히" 일치하면 같은 열의 데이터 셀 값은
// 오탐 위험이 낮다(문서 자체가 이 열의 의미를 선언한 것이므로).
// ⚠️ 부분 문자열(includes) 매칭 금지 — "이의제기 접수 → 담당자 확인 → ..." 같은
// 무관한 긴 문장도 "담당자"를 포함한다는 이유로 헤더로 오인될 수 있다.
const LABEL_COLUMN_KIND: Record<string, "personName" | "company"> = {
  작성자: "personName",
  담당자: "personName",
  성명: "personName",
  소속: "company",
  작성팀: "company",
  부서명: "company",
  부서: "company",
  팀명: "company",
};

// 빈 값/자리표시자 셀("-", "—" 등)은 후보에서 제외
const EMPTY_CELL_PATTERN = /^[\s\-–—.]*$/;

function matchLabelColumnKind(headerCellText: string): "personName" | "company" | undefined {
  const normalized = headerCellText.replace(/\s+/g, "");
  return LABEL_COLUMN_KIND[normalized];
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB
// 개별 이미지 상한(20 × 2MB)만으로는 이론상 40MB까지 누적될 수 있어 전체 상한을 별도로 둔다.
const MAX_TOTAL_IMAGE_BYTES = 40 * 1024 * 1024; // 40MB

interface RunInfo {
  index: number; // 슬라이드 XML 내 절대 위치
  text: string; // 디코딩된 텍스트
}

function extractRuns(xml: string): RunInfo[] {
  return [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => ({
    index: m.index!,
    text: decodeXmlEntities(m[1]),
  }));
}

// <a:tbl> 표 구조를 파싱해 "헤더 셀이 작성자/소속 등과 일치하는 열"의 데이터
// 셀 값을 후보로 반환한다. 표 없는 슬라이드에는 아무 영향 없음.
function findLabeledCells(
  slideXml: string,
): { kind: "personName" | "company"; startXml: number; endXml: number }[] {
  const results: { kind: "personName" | "company"; startXml: number; endXml: number }[] = [];

  // 주의: 아래는 항상 "전체 매치 문자열(match[0])" 안에서 다음 단계를 다시
  // matchAll하는 방식으로 절대 offset을 누적한다 — 캡처 그룹(내용부)만 떼어
  // 쓰면 그 그룹이 시작하는 위치(여는 태그 길이만큼)를 놓쳐 offset이 어긋난다
  // (실사용 검증: 속성 있는 <a:tr>/<a:tc>에서 멀티런 셀 값이 잘려나가는 버그).
  for (const tblMatch of slideXml.matchAll(/<a:tbl\b[^>]*>[\s\S]*?<\/a:tbl>/g)) {
    const tblAbs = tblMatch.index!;
    const rows = [...tblMatch[0].matchAll(/<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/g)];
    if (rows.length < 2) continue; // 헤더 + 데이터 최소 2행 필요

    // 헤더 행이 항상 0번째는 아니다 — 병합된 표 제목 행("문서 개정 이력표" 등)이
    // 위에 먼저 나올 수 있어, 라벨과 매칭되는 첫 행을 헤더로 취급한다.
    let headerRowIdx = -1;
    let labelColumns = new Map<number, "personName" | "company">();
    for (let h = 0; h < rows.length - 1; h++) {
      const cells = [...rows[h][0].matchAll(/<a:tc\b[^>]*>[\s\S]*?<\/a:tc>/g)];
      const found = new Map<number, "personName" | "company">();
      cells.forEach((cellMatch, colIdx) => {
        const headerText = [...cellMatch[0].matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)]
          .map((m) => decodeXmlEntities(m[1]))
          .join("");
        const kind = matchLabelColumnKind(headerText);
        if (kind) found.set(colIdx, kind);
      });
      if (found.size > 0) {
        headerRowIdx = h;
        labelColumns = found;
        break;
      }
    }
    if (headerRowIdx === -1) continue;

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const rowMatch = rows[r];
      const rowAbs = tblAbs + rowMatch.index!;
      const cells = [...rowMatch[0].matchAll(/<a:tc\b[^>]*>[\s\S]*?<\/a:tc>/g)];
      cells.forEach((cellMatch, colIdx) => {
        const kind = labelColumns.get(colIdx);
        if (!kind) return;
        const cellRuns = [...cellMatch[0].matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)];
        if (cellRuns.length === 0) return;
        const cellText = cellRuns.map((m) => decodeXmlEntities(m[1])).join("");
        if (EMPTY_CELL_PATTERN.test(cellText)) return;
        const cellAbs = rowAbs + cellMatch.index!;
        const first = cellRuns[0];
        const last = cellRuns[cellRuns.length - 1];
        results.push({
          kind,
          startXml: cellAbs + first.index!,
          endXml: cellAbs + last.index! + last[0].length,
        });
      });
    }
  }
  return results;
}

async function extractTextAndLabels(
  zip: JSZip,
  budget: DecompressBudget,
): Promise<{ text: string; labeledEntities: LabeledEntityCandidate[] }> {
  const slides = Object.keys(zip.files)
    .map((name) => {
      const m = name.match(SLIDE_PATH);
      return m ? { name, no: parseInt(m[1], 10) } : null;
    })
    .filter((s): s is { name: string; no: number } => s !== null)
    .sort((a, b) => a.no - b.no);

  const parts: string[] = [];
  const labeledEntities: LabeledEntityCandidate[] = [];
  let cursor = 0; // 최종 합쳐진 text 안에서 "다음 슬라이드 블록"이 시작할 절대 offset

  for (const slide of slides) {
    const xml = await zip.files[slide.name].async("string");
    budget.consume(xml.length);
    const runs = extractRuns(xml);
    if (runs.length === 0) continue;
    const rawBody = runs.map((r) => r.text).join("\n");
    const body = rawBody.trim();
    if (!body) continue;
    const leadingTrim = rawBody.length - rawBody.trimStart().length;

    // run i가 rawBody 안에서 시작하는 offset (join("\n") 기준)
    const runOffsets: number[] = [];
    let acc = 0;
    for (const r of runs) {
      runOffsets.push(acc);
      acc += r.text.length + 1;
    }

    const header = `--- 슬라이드 ${slide.no} ---\n`;
    const bodyStart = cursor + header.length; // 최종 text에서 body가 시작하는 절대 offset

    for (const cell of findLabeledCells(xml)) {
      const memberRunIdxs = runs.reduce<number[]>((acc, r, i) => {
        if (r.index >= cell.startXml && r.index < cell.endXml) acc.push(i);
        return acc;
      }, []);
      if (memberRunIdxs.length === 0) continue;
      const firstI = memberRunIdxs[0];
      const lastI = memberRunIdxs[memberRunIdxs.length - 1];
      const start = bodyStart + (runOffsets[firstI] - leadingTrim);
      const end =
        bodyStart + (runOffsets[lastI] + runs[lastI].text.length - leadingTrim);
      if (start < bodyStart || end > bodyStart + body.length) continue; // trim된 영역과 겹치면 스킵
      labeledEntities.push({ kind: cell.kind, raw: body.slice(start - bodyStart, end - bodyStart), start, end });
    }

    parts.push(`${header}${body}`);
    cursor = bodyStart + body.length + 2; // +2 = 다음 블록과의 "\n\n" 구분자
  }

  return { text: parts.join("\n\n"), labeledEntities };
}

async function extractImages(zip: JSZip, budget: DecompressBudget): Promise<PptxImage[]> {
  // 슬라이드 rels → 어떤 슬라이드가 어떤 media를 참조하는지 (계보)
  const slideByMedia = new Map<string, number>();
  const relFiles = Object.keys(zip.files).filter((n) =>
    /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(n),
  );
  for (const relName of relFiles) {
    const slideNo = parseInt(relName.match(/slide(\d+)\.xml\.rels$/)![1], 10);
    const xml = await zip.files[relName].async("string");
    budget.consume(xml.length);
    for (const m of xml.matchAll(/Target="\.\.\/(media\/[^"]+)"/g)) {
      const mediaPath = `ppt/${m[1]}`;
      if (!slideByMedia.has(mediaPath)) slideByMedia.set(mediaPath, slideNo);
    }
  }

  const mediaFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/media\//.test(n))
    .filter((n) => IMAGE_MIME[n.slice(n.lastIndexOf(".") + 1).toLowerCase()])
    .sort();

  const images: PptxImage[] = [];
  let totalImageBytes = 0;
  for (const name of mediaFiles) {
    if (images.length >= MAX_IMAGES) break;
    const bytes = await zip.files[name].async("uint8array");
    budget.consume(bytes.length);
    if (bytes.length > MAX_IMAGE_BYTES) continue;
    if (totalImageBytes + bytes.length > MAX_TOTAL_IMAGE_BYTES) break;
    totalImageBytes += bytes.length;
    const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
    images.push({
      assetId: `img-${images.length + 1}`,
      sourceSlide: slideByMedia.get(name),
      mimeType: IMAGE_MIME[ext],
      base64: await zip.files[name].async("base64"),
    });
  }
  return images;
}

// PPTX 통합 파싱 진입점 — zip을 한 번만 열어 텍스트·labeledEntities·이미지를
// 같은 archive에서 함께 추출한다(서버 라우트가 이전엔 extractPptxText/
// extractPptxImages를 병렬 호출해 같은 파일을 두 번 압축 해제했다 — 브라우저
// 파싱 이관 시 메모리 부담이 커서 통합).
export async function parsePptxDocument(data: ArrayBuffer): Promise<DocumentParseResult> {
  const zip = await JSZip.loadAsync(data);
  assertZipSafe(zip);
  const budget = new DecompressBudget(300 * 1024 * 1024);

  const { text, labeledEntities } = await extractTextAndLabels(zip, budget);
  const images = await extractImages(zip, budget);

  return { text, labeledEntities, images };
}

// 하위 호환 wrapper — 기존 테스트/호출부가 텍스트만 또는 이미지만 필요로 할 때.
// 내부적으로 zip을 한 번만 여는 parsePptxDocument를 그대로 쓴다(핫 패스인
// route.ts/worker는 parsePptxDocument를 직접 호출해 두 번 부르지 않는다).
export async function extractPptxText(
  data: ArrayBuffer,
): Promise<{ text: string; labeledEntities: LabeledEntityCandidate[] }> {
  const { text, labeledEntities } = await parsePptxDocument(data);
  return { text, labeledEntities };
}

export async function extractPptxImages(data: ArrayBuffer): Promise<PptxImage[]> {
  const { images } = await parsePptxDocument(data);
  return images;
}
