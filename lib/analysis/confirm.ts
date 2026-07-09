import type { ProjectAnalysis } from "./types";

export function confirmSelectedSections(analysis: ProjectAnalysis): ProjectAnalysis {
  return {
    ...analysis,
    pages: analysis.pages.map((p) => ({
      ...p,
      sections: p.sections.map((s) => ({
        ...s,
        status: p.selected ? "confirmed" : "candidate",
      })),
    })),
  };
}
