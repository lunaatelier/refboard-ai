import JSZip from "jszip";

// 검수 화면 회귀 테스트용 합성 pptx 빌더(P2.1) — 실제 회사 PPT는 개인정보/기밀 리스크와
// git 바이너리 diff 문제 때문에 커밋하지 않는다(CLAUDE.md §7.9 gitignore 정책과 동일 원칙).
// 대신 lib/parse/pptx.test.ts와 동일한 JSZip 방식으로, 실제 기획서에서 흔한 구조(표지 →
// 회사소개(이메일·전화 포함) → 작성자/소속 표가 있는 개정 이력)를 가상 데이터로 재현한다.
// 전부 가상 인물·회사명·연락처다.

function slideXml(texts: string[]): string {
  const runs = texts.map((t) => `<a:r><a:t>${t}</a:t></a:r>`).join("");
  return `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:txBody>${runs}</p:txBody></p:sld>`;
}

function tableSlideXml(rows: string[][]): string {
  const cell = (t: string) => `<a:tc><a:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></a:txBody></a:tc>`;
  const row = (cells: string[]) => `<a:tr>${cells.map(cell).join("")}</a:tr>`;
  const tbl = `<a:tbl>${rows.map(row).join("")}</a:tbl>`;
  return `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:txBody>${tbl}</p:txBody></p:sld>`;
}

export const SAMPLE_COMPANY_EMAIL = "contact@virtualcorp.example";
export const SAMPLE_COMPANY_PHONE = "02-1234-5678";
export const SAMPLE_AUTHOR_NAME = "김가상";
export const SAMPLE_AUTHOR_TEAM = "가상디자인팀";

// 슬라이드 1: 표지 / 슬라이드 2: 회사소개(이메일·전화, 정규식 규칙으로 탐지) /
// 슬라이드 3: 개정 이력표(작성자/소속 헤더, 표 라벨 기반 탐지).
export async function buildSampleReviewPptx(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "ppt/slides/slide1.xml",
    slideXml(["가상 프로젝트 기획서", "버추얼전자 홈페이지 리뉴얼"]),
  );
  zip.file(
    "ppt/slides/slide2.xml",
    slideXml([
      "회사 소개",
      `문의: ${SAMPLE_COMPANY_EMAIL}`,
      `전화: ${SAMPLE_COMPANY_PHONE}`,
    ]),
  );
  zip.file(
    "ppt/slides/slide3.xml",
    tableSlideXml([
      ["버전", "날짜", "작성자", "소속"],
      ["V0.1", "2026.07.01", SAMPLE_AUTHOR_NAME, SAMPLE_AUTHOR_TEAM],
    ]),
  );
  zip.file("[Content_Types].xml", "<Types/>");
  return zip.generateAsync({ type: "arraybuffer" });
}
