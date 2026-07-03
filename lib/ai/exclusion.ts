import type { ProjectAnalysis } from "../analysis/types";

// 제외 = 차단 조건 (Step 7, data-model §4)
// Phase 3 이후 모든 프롬프트는 이 함수로 소스 자료를 구성한다:
// selectedPages·confirmedSections만 포함하고, 제외 페이지는
// "참조 금지" 조건으로 명시해 AI가 이미 읽은 문맥을 은근히 반영하는 것을 막는다.

const REASON_LABELS: Record<string, string> = {
  sensitive: "sensitive content",
  "out-of-scope": "out of project scope",
  "low-priority": "low priority",
  duplicate: "duplicate content",
  "quality-issue": "quality issue",
  "user-choice": "excluded by user",
  other: "excluded by user",
};

export function buildSourceMaterial(analysis: ProjectAnalysis): string {
  const included = analysis.pages.filter((p) => p.selected);
  const excluded = analysis.pages.filter((p) => !p.selected);

  const parts: string[] = [];

  for (const page of included) {
    const lines = [`## 페이지: ${page.pageTitle} (역할: ${page.pageRole})`];
    for (const s of page.sections) {
      lines.push(
        `- [${s.contentType} / ${s.recommendedLayout}] ${s.sectionTitle}: ${s.contentSummary}`,
      );
    }
    parts.push(lines.join("\n"));
  }

  if (excluded.length > 0) {
    parts.push(
      excluded
        .map(
          (p) =>
            `Excluded page "${p.pageTitle}" must not be used as source material. Reason: ${REASON_LABELS[p.excludedReason ?? "user-choice"]}.`,
        )
        .join("\n"),
    );
  }

  return parts.join("\n\n");
}
