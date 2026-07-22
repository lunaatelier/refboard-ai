import type { ProjectAnalysis } from "../analysis/types";
import { hashValue } from "../state/hash";
import { defaultImageNeed, scaleFor } from "./imageHints";
import { resolvePageBoardSummary } from "./pageBoard";
import { resolveSectionPriority, sectionKey } from "./sectionPriority";
import type {
  BrandDecision,
  ConfirmedReferenceBrief,
  DirectionOption,
  ImageNeedDecision,
  PageReferenceDecision,
  PaletteOption,
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

// 방향 스냅샷 조립 — buildConfirmedBrief(throw로 미확정을 막는 강한 버전)와
// tryBuildDirectionSnapshot(진행 중에도 안전하게 판정해야 하는 약한 버전)이 반드시
// 같은 조립 로직을 공유해야 한다. 이전엔 이 로직이 buildConfirmedBrief 안에만
// 있어서 reviewStatus.ts 같은 새 소비자가 똑같이 흉내내려면 복제할 수밖에 없었고,
// 그러면 검토 화면과 실제 확정 결과가 어긋날 위험이 있었다(§P8 보완).
function buildDirectionSnapshot(
  selectedDirection: DirectionOption,
  editedPaletteOption: PaletteOption,
  paletteMode: "light" | "dark",
): ConfirmedReferenceBrief["direction"] {
  const selectedMoodImages = selectedDirection.imageCandidates
    .filter((c) => c.selected)
    .map((c) => ({ url: c.url, source: c.source, attribution: c.attribution }));
  return {
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
}

// 팔레트·방향이 아직 미확정이면 undefined — throw하지 않는다. 편집 중 상태를 계속
// 들여다봐야 하는 reviewStatus.ts 용.
function tryBuildDirectionSnapshot(
  references: ReferenceResult,
): ConfirmedReferenceBrief["direction"] | undefined {
  const selectedDirection = references.directionOptions?.find(
    (d) => d.directionId === references.selectedDirectionId,
  );
  const editedPaletteOption = references.editedPaletteOption;
  if (!selectedDirection || !editedPaletteOption) return undefined;
  return buildDirectionSnapshot(
    selectedDirection,
    editedPaletteOption,
    references.paletteMode ?? "light",
  );
}

export function computeAnalysisHash(analysis: ProjectAnalysis): string {
  return hashValue(buildAnalysisDigest(analysis));
}

export interface CurrentRevision {
  analysisHash: string;
  directionHash?: string;
  briefHash?: string;
}

// buildConfirmedBrief의 pages 조립과 완전히 같은 로직 — direction 확정 여부와
// 무관하게(computeCurrentRevision이 direction 미확정 상태에서도 호출될 수 있으므로)
// 동작해야 해서 유효성 검증(throw)은 포함하지 않는다. 존재하지 않는 페이지/섹션을
// 가리키는 채택은 어차피 어떤 sectionKey와도 매칭되지 않아 조용히 무시된다 —
// buildConfirmedBrief는 이 함수를 쓰기 전에 별도로 그 경우를 throw로 막는다.
function buildBriefPages(
  analysis: ProjectAnalysis,
  references: ReferenceResult,
  analysisHash: string,
  directionHash: string,
): PageReferenceDecision[] {
  const appliedByKey = new Map<string, ReferenceAdoption[]>();
  for (const adoption of Object.values(references.referenceAdoptions ?? {})) {
    if (adoption.status !== "applied") continue;
    const key = sectionKey(adoption.pageId, adoption.sectionId);
    const list = appliedByKey.get(key) ?? [];
    list.push(adoption);
    appliedByKey.set(key, list);
  }

  return analysis.pages
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
          // P5-2 + P8 보완: sectionDecisionsByKey에 명시적 결정(사용자 승격/강등)이
          // 있으면 그걸 쓴다. 없으면 SectionRefsTab이 화면에 보여주는 것과 완전히
          // 같은 규칙 추천(resolveSectionPriority)으로 떨어진다 — 이전엔 여기서만
          // "적용 레퍼런스가 있으면 고영향"이라는 별도 휴리스틱을 썼는데, 사용자가
          // 아직 열어보지 않은 페이지는 SectionRefsTab의 규칙 추천과 이 값이
          // 어긋날 수 있었다.
          const resolvedPriority = resolveSectionPriority(
            page,
            section,
            references.sectionDecisionsByKey ?? {},
          );
          const priority = resolvedPriority.priority;
          const decisionSource = resolvedPriority.source;
          // P7: imageNeedByKey(원본 결정)와 imageHints(sectionKey로 연결된 편집·생성
          // 결과)를 같은 key로 결합해 imageNeed를 만든다 — 둘 중 하나만 있으면
          // 값이 어긋난다는 P0 검토를 반영해, 이 결합 지점 하나로만 만든다.
          const required = references.imageNeedByKey?.[key] ?? defaultImageNeed(section.contentType);
          const matchingHint = (references.imageHints ?? []).find((h) => h.key === key);
          const imageNeed: ImageNeedDecision = {
            required,
            role: matchingHint?.scale ?? scaleFor(section.contentType).scale,
            ...(required && matchingHint?.prompt ? { prompt: matchingHint.prompt } : {}),
            ...(required && matchingHint?.generatedImageAssetId
              ? { generatedImageAssetId: matchingHint.generatedImageAssetId }
              : {}),
          };
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
            imageNeed,
          };
        }),
    }));
}

// buildConfirmedBrief의 brandDecisions 조립과 완전히 같은 로직 — direction과
// 무관하므로 별도 파라미터가 필요 없다.
function buildBrandDecisions(references: ReferenceResult): BrandDecision[] {
  return (references.analysisTargetList ?? [])
    .filter((t) => t.adopted)
    .map((t) => {
      const deep = references.targetAnalyses?.[t.id];
      // P6: 사용자가 편집한 채택 상태(brandDecisionOverrides)가 있으면 그것을
      // 쓴다. 없으면(구버전 데이터·아직 탭을 열어본 적 없는 대상) 심층 분석의
      // wowPoints/painPoints로 폴백 — TargetsTab이 열릴 때 seedBrandDecision이
      // 채워주는 것과 동일한 기본값이라 결과가 어긋나지 않는다.
      const override = references.brandDecisionOverrides?.[t.id];
      return {
        targetId: t.id,
        name: t.name,
        adoptedPatterns: override?.adoptedPatterns ?? deep?.wowPoints ?? [],
        avoidedPatterns: override?.avoidedPatterns ?? deep?.painPoints ?? [],
        verifiedSources: deep?.verifiedSources ?? [],
      };
    });
}

// "지금 시점" 기준 revision — 확정 여부와 무관하게 항상 계산 가능하다.
// reviewStatus.ts가 이 값을 references.confirmedBrief.revision(확정 당시 스냅샷)과
// 비교해 "최신 아님"을 판정한다. briefHash는 direction이 아직 미확정이면 계산할
// 방법이 없으므로(레이아웃/채택/브랜드 결정은 direction과 무관하지만, 브리프
// 자체가 direction 위에서 조립되는 구조라 direction 스냅샷이 필요하다) undefined로
// 둔다 — computeStaleReasons는 한쪽이 undefined면 그 필드 비교를 건너뛴다(§invalidation.ts).
//
// P8 보완: 이전엔 이 함수가 analysisHash/directionHash만 만들고 briefHash를 아예
// 채우지 않아서, 레이아웃·채택·브랜드 결정·이미지 필요처럼 analysisHash/
// directionHash에 반영되지 않는 변경이 확정 후 일어나도 "최신 아님"으로 잡히지
// 않는 문제가 있었다 — reviewStatus.ts의 priorConfirmationStale과 그걸로 결정되는
// ReferenceWorkspace.tsx의 재확정 버튼 disabled 여부가 실제로 틀릴 수 있었다.
export function computeCurrentRevision(
  analysis: ProjectAnalysis,
  references: ReferenceResult,
): CurrentRevision {
  const direction = tryBuildDirectionSnapshot(references);
  const analysisHash = computeAnalysisHash(analysis);
  const directionHash = direction ? hashValue(direction) : undefined;
  let briefHash: string | undefined;
  if (direction && directionHash) {
    const pages = buildBriefPages(analysis, references, analysisHash, directionHash);
    const brandDecisions = buildBrandDecisions(references);
    briefHash = hashValue({ direction, pages, brandDecisions });
  }
  return { analysisHash, directionHash, briefHash };
}

// 개별 채택(ReferenceAdoption)이 근거로 삼은 기준 시점의 해시(P8 보완) — 분석
// 내용과 확정된 방향(팔레트/무드)만 묶는다(briefHash는 절대 섞지 않는다). 채택의
// aspects에 color/typography가 포함될 수 있어 방향이 바뀌어도 "오래된 근거"로
// 판정돼야 하기 때문이다. 방향이 아직 미확정인 시점(섹션별 레퍼런스 탭을 방향
// 확정보다 먼저 여는 경우)에는 directionHash가 undefined인 채로 해시된다 — 이후
// 방향이 정해지면 자동으로 basedOnHash가 달라져 재확인 대상이 된다.
//
// computeCurrentRevision().briefHash를 그대로 쓰면 안 된다 — briefHash는 프로젝트
// 전체 pages(다른 섹션의 레이아웃·채택·이미지 필요)와 brandDecisions까지 포함하므로,
// 이걸 채택 기준 해시로 쓰면 이 채택과 무관한 다른 섹션의 편집만으로도 모든 채택이
// 일제히 stale로 뒤집힌다(너무 넓은 무효화). 그래서 analysisHash/directionHash
// 두 필드만 별도로 뽑아 해시한다.
export function computeAdoptionBasisHash(
  analysis: ProjectAnalysis,
  references: ReferenceResult,
): string {
  const direction = tryBuildDirectionSnapshot(references);
  return hashValue({
    analysisHash: computeAnalysisHash(analysis),
    directionHash: direction ? hashValue(direction) : undefined,
  });
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

  const direction = buildDirectionSnapshot(selectedDirection, editedPaletteOption, paletteMode);
  if (direction.selectedMoodImages.length > 4) {
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

  const analysisHash = computeAnalysisHash(analysis);
  const directionHash = hashValue(direction);

  const pages = buildBriefPages(analysis, references, analysisHash, directionHash);
  const brandDecisions = buildBrandDecisions(references);
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
