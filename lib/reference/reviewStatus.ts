// 결정 검토 (P8) — 레퍼런스·무드 단계 마지막에 "실제로 확정에 반영될 것"을
// 한 화면에서 검토하는 순수 함수. 확정(buildConfirmedBrief)과 반드시 같은 판정
// 기준(computeCurrentRevision/computeAdoptionBasisHash/resolveSectionPriority)을
// 공유해야 화면과 실제 확정 결과가 어긋나지 않는다.

import type { ProjectAnalysis } from "../analysis/types";
import { adoptionsForSection } from "./adoption";
import { computeAdoptionBasisHash, computeCurrentRevision } from "./confirmBrief";
import { computeStaleReasons } from "./invalidation";
import { resolveSectionPriority } from "./sectionPriority";
import type { ReferenceResult, ReviewIssue, ReviewStatus, VerifiedSource } from "./types";

// 미확인 출처 지문 — targetId만으로 인지 여부를 저장하면, 재분석으로 출처가
// 완전히 바뀌어도 예전 인지가 그대로 유효해 보이는 문제가 생긴다. 미확인(unverified)
// 상태인 출처 URL 집합 자체를 지문으로 삼아, 지금 지문과 저장된 인지 지문이 같을
// 때만 "인지 완료"로 본다.
export function unverifiedSourceFingerprint(
  verifiedSources: Pick<VerifiedSource, "url" | "status">[] | undefined,
): string {
  // verifiedSources 자체가 없거나 비어있는 것도 "미확인"으로 취급한다 —
  // sourceVerification.ts가 아예 돌지 않은 심층 분석은 출처를 확인할 방법이 없다.
  if (!verifiedSources || verifiedSources.length === 0) return "no-verified-sources";
  const unverifiedUrls = verifiedSources
    .filter((s) => s.status === "unverified")
    .map((s) => s.url)
    .sort();
  if (unverifiedUrls.length === 0) return ""; // 미확인 출처 없음 — 인지 불필요
  return unverifiedUrls.join("|");
}

export function evaluateReviewStatus(
  analysis: ProjectAnalysis,
  references: ReferenceResult,
): ReviewStatus {
  const issues: ReviewIssue[] = [];

  if (!references.editedPaletteOption || !references.selectedDirectionId) {
    issues.push({
      id: "direction-missing",
      severity: "required",
      message: "컬러·무드 탭에서 방향 1안을 아직 선택하지 않았습니다.",
      tabId: "palette-mood",
    });
  }

  const currentBasisHash = computeAdoptionBasisHash(analysis, references);

  for (const page of analysis.pages.filter((p) => p.selected)) {
    for (const section of page.sections.filter((s) => s.status === "confirmed")) {
      const resolved = resolveSectionPriority(page, section, references.sectionDecisionsByKey ?? {});
      const hasExplicitLayout = Boolean(references.bySectionId?.[section.sectionId]?.layoutPattern);
      const appliedAdoptions = adoptionsForSection(references, page.pageId, section.sectionId).filter(
        (a) => a.status === "applied",
      );

      // 고영향 섹션(현재 구현 기준: 페이지별 3~5개, sectionPriority.ts)은
      // layoutPattern 또는 적용한 레퍼런스가 실제로 있어야 한다 — confirmBrief.ts는
      // layoutPattern이 없으면 section.recommendedLayout으로 채우기 때문에, 그
      // 최종값만 보면 항상 존재하는 것처럼 보인다. 그래서 여기서는 사용자가 실제로
      // 남긴 명시적 값(bySectionId)만 "완료"로 센다.
      if (resolved.priority === "high-impact" && !hasExplicitLayout && appliedAdoptions.length === 0) {
        issues.push({
          id: `section-decision-missing:${page.pageId}:${section.sectionId}`,
          severity: "required",
          message: `"${page.pageTitle} > ${section.sectionTitle}"는 핵심 섹션인데 레이아웃도, 적용한 레퍼런스도 아직 없습니다. 이동 후 레이아웃을 고르거나 레퍼런스를 적용하세요.`,
          tabId: "section-refs",
        });
      }

      for (const adoption of appliedAdoptions) {
        if (adoption.decision.basedOnHash !== currentBasisHash) {
          issues.push({
            id: `adoption-stale:${adoption.adoptionId}`,
            severity: "required",
            message: `"${page.pageTitle} > ${section.sectionTitle}"에 적용한 레퍼런스 "${
              adoption.reference.title ?? adoption.reference.sourceUrl
            }"가 이전 분석/방향 기준으로 채택되었습니다. 이동 후 같은 항목의 "적용" 버튼을 다시 눌러 확인하세요.`,
            tabId: "section-refs",
          });
        }
      }
    }
  }

  // 선택 기능 미사용 안내(optional) — 확정을 막지 않지만, 검토 화면에서 "이 기능을
  // 아예 안 썼다"는 사실 자체는 알려준다(P8 §완료 기준: 선택 기능 미사용은 진행을
  // 막지 않되 인지는 시킨다).
  const anyAppliedAdoption = analysis.pages
    .filter((p) => p.selected)
    .some((page) =>
      page.sections
        .filter((s) => s.status === "confirmed")
        .some(
          (s) => adoptionsForSection(references, page.pageId, s.sectionId).some((a) => a.status === "applied"),
        ),
    );
  if (!anyAppliedAdoption) {
    issues.push({
      id: "no-adoptions-used",
      severity: "optional",
      message: "섹션별 레퍼런스 탭에서 적용한 레퍼런스가 아직 없습니다. 없어도 진행할 수 있습니다.",
      tabId: "section-refs",
    });
  }
  if (!(references.analysisTargetList ?? []).some((t) => t.adopted)) {
    issues.push({
      id: "no-brand-targets-adopted",
      severity: "optional",
      message: "채택한 분석 대상 브랜드가 없습니다. 없어도 진행할 수 있습니다.",
      tabId: "targets",
    });
  }

  for (const target of (references.analysisTargetList ?? []).filter((t) => t.adopted)) {
    const deep = references.targetAnalyses?.[target.id];
    const fingerprint = unverifiedSourceFingerprint(deep?.verifiedSources);
    if (fingerprint && references.unverifiedSourceAcks?.[target.id] !== fingerprint) {
      issues.push({
        id: `unverified-source:${target.id}`,
        severity: "required",
        message: `"${target.name}"의 출처가 검증되지 않았습니다. 확인 후 인지 체크가 필요합니다.`,
        targetId: target.id,
      });
    }
  }

  let priorConfirmationStale = false;
  if (references.confirmedBrief) {
    const currentRevision = computeCurrentRevision(analysis, references);
    const reasons = computeStaleReasons(references.confirmedBrief.revision, currentRevision);
    if (reasons.length > 0) {
      priorConfirmationStale = true;
      issues.push({
        id: "prior-brief-stale",
        severity: "stale",
        message: "이전에 확정한 내용과 지금 상태가 달라졌습니다. 다시 확정하면 최신 내용으로 반영됩니다.",
      });
    }
  }

  return {
    issues,
    canConfirm: issues.every((i) => i.severity !== "required"),
    priorConfirmationStale,
  };
}
