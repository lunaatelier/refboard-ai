import type { ProjectAnalysis } from "../analysis/types";
import { hashValue } from "../state/hash";
import { resolvePageBoardSummary } from "./pageBoard";
import { sectionKey } from "./sectionPriority";
import type {
  BrandDecision,
  ConfirmedReferenceBrief,
  PageReferenceDecision,
  ReferenceAdoption,
  ReferenceResult,
} from "./types";

// 편집 중인 ReferenceResult에서 사용자가 실제로 채택한 결정만 남긴 불변 스냅샷을
// 만드는 순수 함수 (§6.4). 같은 입력이면 항상 같은 결과를 낸다 — 미선택 검색 결과,
// 미채택 분석, 원문·복원 매핑은 이 함수를 거치지 않는다(애초에 읽지 않는다).
//
// P3-5: 무드·이미지 선택은 이제 references.directionOptions[selectedDirectionId]가
// 단일 출처다(예전 selectedMoodId/globalMood/selectedMoodImageUrls는 삭제됨).
// 팔레트 역할 편집본(editedPaletteOption/paletteMode)만 별도 상태로 남아있다 —
// direction은 paletteOptionId 참조만 갖고, 실제 역할 재배치 결과는 저장하지 않는다.

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

  const selectedDirection = references.directionOptions?.find(
    (d) => d.directionId === references.selectedDirectionId,
  );
  if (!selectedDirection) {
    throw new ConfirmBriefError("방향이 확정되지 않았습니다.");
  }

  const editedPaletteOption = references.editedPaletteOption;
  if (!editedPaletteOption) {
    throw new ConfirmBriefError("팔레트가 확정되지 않았습니다.");
  }
  const paletteMode = references.paletteMode ?? "light";

  const selectedMoodImages = selectedDirection.imageCandidates
    .filter((c) => c.selected)
    .map((c) => ({ url: c.url, source: c.source, attribution: c.attribution }));
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
    moodId: selectedDirection.moodOptionId,
    moodKeywords: selectedDirection.keywords,
    typographyDirection: selectedDirection.typography.title.note,
    selectedMoodImages,
    styleAttributes: selectedDirection.styleAttributes,
    avoidDirections: selectedDirection.avoidDirections,
  };

  const analysisHash = hashValue(buildAnalysisDigest(analysis));
  const directionHash = hashValue(direction);

  const pages: PageReferenceDecision[] = analysis.pages
    .filter((p) => p.selected)
    .map((page) => ({
      pageId: page.pageId,
      pageTitle: page.pageTitle,
      // P5-1: Page 원본을 건드리지 않고 로컬 규칙(+사용자 덮어쓰기)으로 파생한다.
      purposeSummary: resolvePageBoardSummary(
        page,
        analysis,
        references.pageMetaById?.[page.pageId],
      ).purposeSummary,
      sections: page.sections
        .filter((s) => s.status === "confirmed")
        .map((section) => {
          const key = sectionKey(page.pageId, section.sectionId);
          const adoptions = appliedByKey.get(key) ?? [];
          const hasAdoptions = adoptions.length > 0;
          // P5-2: sectionDecisionsByKey에 명시적 결정(rule 추천 또는 사용자 승격/
          // 강등)이 있으면 그걸 쓴다. 없으면(레거시 데이터) 기존 휴리스틱으로
          // 폴백한다 — "적용 레퍼런스가 있으면 고영향".
          const explicitDecision = references.sectionDecisionsByKey?.[key];
          const priority =
            explicitDecision?.priority ?? (hasAdoptions ? "high-impact" : "inherited");
          const decisionSource =
            explicitDecision?.source ?? (hasAdoptions ? "user" : "inherited");
          return {
            sectionId: section.sectionId,
            sectionTitle: section.sectionTitle,
            priority,
            layoutPattern:
              references.bySectionId?.[section.sectionId]?.layoutPattern ??
              section.recommendedLayout,
            decision: {
              source: decisionSource,
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
