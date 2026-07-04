import type { DocumentPurpose } from "../analysis/documentPurpose";
import type { ProjectAnalysis, ProjectDirective } from "../analysis/types";
import type { ExtractedAnalysisTarget } from "../masking/types";
import type { WorkflowState } from "./workflow";

// 분석 결과 JSON 저장/불러오기 (Step 13) — isomorphic 순수 함수.
// 저장되는 건 마스킹된 분석뿐 (실명 없음 = 안전). 복원키(mappings)는 절대 포함하지 않는다.
// JSON엔 전체 페이지가 저장되므로 1차에 3개만 골랐어도 재활용 때 나머지를 선택할 수 있다.

const FORMAT = "drg-analysis";
const VERSION = 1;

export interface AnalysisExport {
  format: typeof FORMAT;
  version: number;
  savedAt: string;
  // 비민감 식별자 — 실명·복원키를 담지 않는다. "같은 세션에서 방금 저장한 이 JSON"인지
  // 확인하는 용도로만 쓰인다(다른 프로젝트 JSON을 올렸을 때 이전 문서의 복원키가
  // 잘못 적용되는 것을 막기 위함). 없으면(구버전 내보내기) 항상 불일치로 취급된다.
  exportId?: string;
  analysis: ProjectAnalysis;
  extractedAnalysisTargets: ExtractedAnalysisTarget[];
  projectDirective: ProjectDirective[];
  documentPurpose?: DocumentPurpose;
}

export function buildAnalysisExport(
  state: WorkflowState,
  exportId: string,
): string {
  if (!state.analysis) throw new Error("저장할 분석 결과가 없습니다.");
  const data: AnalysisExport = {
    format: FORMAT,
    version: VERSION,
    savedAt: new Date().toISOString(),
    exportId,
    analysis: state.analysis,
    extractedAnalysisTargets: state.extractedAnalysisTargets ?? [],
    projectDirective: state.projectDirective ?? [],
    ...(state.documentPurpose ? { documentPurpose: state.documentPurpose } : {}),
  };
  return JSON.stringify(data, null, 2);
}

export function isAnalysisJsonFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".json");
}

export function parseAnalysisImport(text: string): AnalysisExport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("JSON 파싱에 실패했습니다.");
  }
  const data = raw as Partial<AnalysisExport>;
  if (data?.format !== FORMAT) {
    throw new Error(
      "이 앱에서 저장한 분석 JSON이 아닙니다. (기획서 문서는 txt/md/pdf/pptx로 올려주세요)",
    );
  }
  if (typeof data.version !== "number" || data.version > VERSION) {
    throw new Error("지원하지 않는 분석 JSON 버전입니다.");
  }
  const analysis = data.analysis;
  if (
    !analysis ||
    !Array.isArray(analysis.pages) ||
    analysis.pages.length === 0
  ) {
    throw new Error("분석 JSON에 페이지 데이터가 없습니다.");
  }
  return {
    format: FORMAT,
    version: data.version,
    savedAt: typeof data.savedAt === "string" ? data.savedAt : "",
    exportId: typeof data.exportId === "string" ? data.exportId : undefined,
    analysis,
    extractedAnalysisTargets: Array.isArray(data.extractedAnalysisTargets)
      ? data.extractedAnalysisTargets
      : [],
    projectDirective: Array.isArray(data.projectDirective)
      ? data.projectDirective
      : [],
    ...(data.documentPurpose ? { documentPurpose: data.documentPurpose } : {}),
  };
}
