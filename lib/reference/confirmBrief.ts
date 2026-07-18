import type { ProjectAnalysis } from "../analysis/types";
import { hashValue } from "../state/hash";
import type {
  BrandDecision,
  ConfirmedReferenceBrief,
  MoodImage,
  PageReferenceDecision,
  ReferenceAdoption,
  ReferenceResult,
} from "./types";

// 편집 중인 ReferenceResult에서 사용자가 실제로 채택한 결정만 남긴 불변 스냅샷을
// 만드는 순수 함수 (§6.4). 같은 입력이면 항상 같은 결과를 낸다 — 미선택 검색 결과,
// 미채택 분석, 원문·복원 매핑은 이 함수를 거치지 않는다(애초에 읽지 않는다).

export const CONCEPT_PROMPT_VERSION = "concept-v1";

export class ConfirmBriefError extends Error {}

interface BuildConfirmedBriefOptions {
  promptVersion?: string;
  now?: () => string;
}

export function buildConfirmedBrief(
  analysis: ProjectAnalysis,
  references: ReferenceResult,
  options: BuildConfirmedBriefOptions = {},
): ConfirmedReferenceBrief {
  const promptVersion = options.promptVersion ?? CONCEPT_PROMPT_VERSION;
  const confirmedAt = (options.now ?? defaultNow)();

  const editedPaletteOption = references.editedPaletteOption;
  if (!editedPaletteOption) {
    throw new ConfirmBriefError("팔레트가 확정되지 않았습니다.");
  }
  const paletteMode = references.paletteMode ?? "light";

  const selectedMood = references.moodOptions?.find(
    (m) => m.id === references.selectedMoodId,
  );
  if (!selectedMood) {
    throw new ConfirmBriefError("무드가 확정되지 않았습니다.");
  }

  const selectedMoodImages = resolveSelectedMoodImages(references);
  if (selectedMoodImages.length > 4) {
    throw new ConfirmBriefError("선택 이미지는 최대 4장까지 확정할 수 있습니다.");
  }

  const validPageIds = new Set<string>();
  const validSectionIds = new Set<string>();
  for (const page of analysis.pages) {
    if (!page.selected) continue;
    validPageIds.add(page.pageId);
    for (const section of page.sections) {
      if (section.status !== "confirmed") continue;
      validSectionIds.add(section.sectionId);
    }
  }

  const allAdoptions = Object.values(references.referenceAdoptions ?? {});
  for (const adoption of allAdoptions) {
    if (!validPageIds.has(adoption.pageId) || !validSectionIds.has(adoption.sectionId)) {
      throw new ConfirmBriefError(
        `존재하지 않는 페이지/섹션에 대한 채택입니다: ${adoption.pageId}/${adoption.sectionId}`,
      );
    }
  }

  // status !== "applied"(참고만/제외)는 여기서 걸러진다 — 브리프에 들어가는 건
  // 실제로 적용하기로 확정한 것뿐이다.
  const appliedByKey = new Map<string, ReferenceAdoption[]>();
  for (const adoption of allAdoptions) {
    if (adoption.status !== "applied") continue;
    const key = sectionKey(adoption.pageId, adoption.sectionId);
    const list = appliedByKey.get(key) ?? [];
    list.push(adoption);
    appliedByKey.set(key, list);
  }

  const direction: ConfirmedReferenceBrief["direction"] = {
    paletteOptionId: editedPaletteOption.optionId,
    editedPaletteOption,
    paletteMode,
    moodId: selectedMood.id,
    moodKeywords: references.globalMood?.keywords ?? selectedMood.keywords,
    typographyDirection: selectedMood.styleAttributes.typographyNote,
    selectedMoodImages,
    styleAttributes: selectedMood.styleAttributes,
    avoidDirections: references.avoidDirections ?? [],
  };

  const analysisHash = hashValue(buildAnalysisDigest(analysis));
  const directionHash = hashValue(direction);

  const pages: PageReferenceDecision[] = analysis.pages
    .filter((p) => p.selected)
    .map((page) => ({
      pageId: page.pageId,
      pageTitle: page.pageTitle,
      // 페이지 목적을 담는 전용 필드가 아직 없다(P5 페이지 보드에서 도입 예정) —
      // 그때까지는 대표 확정 섹션 요약을 임시로 쓴다.
      purposeSummary:
        page.sections.find((s) => s.status === "confirmed")?.contentSummary ?? "",
      sections: page.sections
        .filter((s) => s.status === "confirmed")
        .map((section) => {
          const key = sectionKey(page.pageId, section.sectionId);
          const adoptions = appliedByKey.get(key) ?? [];
          // 섹션 우선순위(고영향/상속/선택)를 사용자가 직접 지정하는 UI는 아직 없다(P5).
          // 그때까지는 "적용 레퍼런스가 있으면 고영향"으로 유도한다.
          const hasAdoptions = adoptions.length > 0;
          return {
            sectionId: section.sectionId,
            sectionTitle: section.sectionTitle,
            priority: hasAdoptions ? ("high-impact" as const) : ("inherited" as const),
            layoutPattern:
              references.bySectionId?.[section.sectionId]?.layoutPattern ??
              section.recommendedLayout,
            decision: {
              source: hasAdoptions ? ("user" as const) : ("inherited" as const),
              freshness: "current" as const,
              basedOnHash: hasAdoptions ? directionHash : analysisHash,
            },
            adoptions,
          };
        }),
    }));

  const brandDecisions: BrandDecision[] = (references.analysisTargetList ?? [])
    .filter((t) => t.adopted)
    .map((t) => {
      const deep = references.targetAnalyses?.[t.id];
      return {
        targetId: t.id,
        name: t.name,
        // "가져올 점/피할 점"을 사용자가 직접 선택·편집하는 UI는 아직 없다(P6) —
        // 그때까지는 심층 분석의 wowPoints/painPoints를 그대로 옮긴다.
        adoptedPatterns: deep?.wowPoints ?? [],
        avoidedPatterns: deep?.painPoints ?? [],
        verifiedSources: [], // P6에서 grounding 검증이 연결되기 전까지 빈 배열
      };
    });

  const briefHash = hashValue({ direction, pages, brandDecisions });

  return {
    version: "2.0",
    confirmedAt,
    revision: { analysisHash, directionHash, briefHash, promptVersion },
    direction,
    pages,
    brandDecisions,
  };
}

function defaultNow(): string {
  return new Date().toISOString();
}

function sectionKey(pageId: string, sectionId: string): string {
  return `${pageId}::${sectionId}`;
}

// P3 무드보드의 이미지별 선택·제외 UI(선택 이미지 최대 4장)가 아직 없다 — 그때까지는
// selectedMoodImageUrls가 있으면 그 부분집합만, 없으면 무드 검색 결과의 앞 4장만 쓴다.
function resolveSelectedMoodImages(references: ReferenceResult): MoodImage[] {
  const available = references.globalMood?.images ?? [];
  const selectedUrls = references.selectedMoodImageUrls;
  if (!selectedUrls) return available.slice(0, 4);
  const urlSet = new Set(selectedUrls);
  return available.filter((img) => urlSet.has(img.url));
}

// 컨셉 API가 받은 ConfirmedReferenceBrief가 "지금" 분석 결과와 실제로 맞물리는지
// 교차 검증한다(§P9-A). 브리프는 확정 당시 스냅샷이라, 그 사이 페이지/섹션 선택이
// 바뀌었으면 더 이상 유효하지 않은 pageId/sectionId를 담고 있을 수 있다.
export function assertBriefMatchesAnalysis(
  brief: ConfirmedReferenceBrief,
  analysis: ProjectAnalysis,
): void {
  const validPageIds = new Set(
    analysis.pages.filter((p) => p.selected).map((p) => p.pageId),
  );
  const validSectionIds = new Set(
    analysis.pages
      .filter((p) => p.selected)
      .flatMap((p) =>
        p.sections.filter((s) => s.status === "confirmed").map((s) => s.sectionId),
      ),
  );
  for (const page of brief.pages) {
    if (!validPageIds.has(page.pageId)) {
      throw new ConfirmBriefError(
        `확정 브리프의 페이지가 현재 분석 결과에 없습니다: ${page.pageId}`,
      );
    }
    for (const section of page.sections) {
      if (!validSectionIds.has(section.sectionId)) {
        throw new ConfirmBriefError(
          `확정 브리프의 섹션이 현재 분석 결과에 없습니다: ${section.sectionId}`,
        );
      }
    }
  }
}

function buildAnalysisDigest(analysis: ProjectAnalysis): unknown {
  return analysis.pages
    .filter((p) => p.selected)
    .map((page) => ({
      pageId: page.pageId,
      sections: page.sections
        .filter((s) => s.status === "confirmed")
        .map((section) => ({
          sectionId: section.sectionId,
          contentType: section.contentType,
          contentSummary: section.contentSummary,
        })),
    }));
}
