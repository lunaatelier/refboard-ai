"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ProjectAnalysis } from "@/lib/analysis/types";
import { adoptionsForSection } from "@/lib/reference/adoption";
import { defaultImageNeed } from "@/lib/reference/imageHints";
import { evaluateReviewStatus, unverifiedSourceFingerprint } from "@/lib/reference/reviewStatus";
import { resolveSectionPriority, sectionKey } from "@/lib/reference/sectionPriority";
import type { ReferenceResult, ReferenceResultUpdater, ReviewIssue } from "@/lib/reference/types";
import { pageCardStyle } from "../shell/PageLayout";

// [결정 검토] 탭 (P8) — 레퍼런스·무드 단계 마지막에 실제로 확정될 내용을 한 화면에서
// 훑고, 필수 미결정만 확정을 막는다. 선택 기능 미사용은 안내만 하고 진행을 막지 않는다.

interface ReviewTabProps {
  analysis: ProjectAnalysis;
  references: ReferenceResult;
  onChange: (next: ReferenceResultUpdater) => void;
  onNavigateTab: (tabId: "palette-mood" | "section-refs" | "targets" | "image-hints") => void;
}

const ISSUE_STYLE: Record<ReviewIssue["severity"], { bg: string; fg: string; icon: React.ReactNode }> = {
  required: {
    bg: "var(--error-weak-bg)",
    fg: "var(--error)",
    icon: <AlertTriangle size={16} color="var(--error)" />,
  },
  stale: {
    bg: "var(--warning-weak-bg)",
    fg: "var(--warning-weak-text)",
    icon: <AlertTriangle size={16} color="var(--warning-weak-text)" />,
  },
  optional: {
    bg: "var(--info-weak-bg)",
    fg: "var(--info)",
    icon: <Info size={16} color="var(--info)" />,
  },
};

export default function ReviewTab({ analysis, references, onChange, onNavigateTab }: ReviewTabProps) {
  const status = evaluateReviewStatus(analysis, references);
  const selectedDirection = references.directionOptions?.find(
    (d) => d.directionId === references.selectedDirectionId,
  );
  const selectedPages = analysis.pages.filter((p) => p.selected);
  const adoptedTargets = (references.analysisTargetList ?? []).filter((t) => t.adopted);

  const acknowledgeSource = (targetId: string) => {
    const deep = references.targetAnalyses?.[targetId];
    const fingerprint = unverifiedSourceFingerprint(deep?.verifiedSources);
    onChange((prev) => ({
      ...prev,
      unverifiedSourceAcks: { ...(prev.unverifiedSourceAcks ?? {}), [targetId]: fingerprint },
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...pageCardStyle, background: "var(--primary-soft)", border: "none" }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          {status.canConfirm ? (
            <CheckCircle2 size={20} color="var(--success)" />
          ) : (
            <AlertTriangle size={20} color="var(--error)" />
          )}
          결정 검토
        </h3>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          다음 단계로 넘어가기 전에 실제로 컨셉 생성에 반영될 결정을 확인하세요. 선택 기능을
          쓰지 않았다는 이유로 진행이 막히지는 않습니다.
        </p>
      </div>

      {status.issues.length > 0 && (
        <div style={pageCardStyle}>
          <h4 style={{ fontSize: 16, fontWeight: 600 }}>확인이 필요한 항목</h4>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {status.issues.map((issue) => {
              const s = ISSUE_STYLE[issue.severity];
              return (
                <li
                  key={issue.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-md)",
                    background: s.bg,
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-sm) var(--space-md)",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", fontSize: 14, color: s.fg }}>
                    {s.icon}
                    {issue.message}
                  </span>
                  {issue.tabId && (
                    <button
                      onClick={() => onNavigateTab(issue.tabId!)}
                      className="btn-tertiary"
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        padding: "6px var(--space-md)",
                        fontSize: 14,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      이동
                    </button>
                  )}
                  {issue.targetId && (
                    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", fontSize: 14, whiteSpace: "nowrap" }}>
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => acknowledgeSource(issue.targetId!)}
                      />
                      확인했습니다
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div style={pageCardStyle}>
        <h4 style={{ fontSize: 16, fontWeight: 600 }}>글로벌 방향</h4>
        {selectedDirection && references.editedPaletteOption ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", fontSize: 14 }}>
            <p>
              <b>{selectedDirection.label}</b> · {selectedDirection.description}
            </p>
            <p style={{ color: "var(--text-muted)" }}>
              키워드: {selectedDirection.keywords.join(", ") || "—"}
            </p>
            <div style={{ display: "flex", gap: "var(--space-xs)" }}>
              {(["primary", "secondary", "accent", "background"] as const).map((role) => (
                <span
                  key={role}
                  title={role}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "var(--radius-sm)",
                    background: references.editedPaletteOption![references.paletteMode ?? "light"][role],
                    border: "1px solid var(--border)",
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>아직 선택되지 않았습니다.</p>
        )}
      </div>

      <div style={pageCardStyle}>
        <h4 style={{ fontSize: 16, fontWeight: 600 }}>선택 이미지</h4>
        {selectedDirection && selectedDirection.imageCandidates.some((c) => c.selected) ? (
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            {selectedDirection.imageCandidates
              .filter((c) => c.selected)
              .map((c, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={c.url}
                  alt=""
                  width={96}
                  height={72}
                  style={{ objectFit: "cover", borderRadius: "var(--radius-sm)" }}
                />
              ))}
          </div>
        ) : (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>선택된 이미지가 없습니다.</p>
        )}
      </div>

      <div style={pageCardStyle}>
        <h4 style={{ fontSize: 16, fontWeight: 600 }}>페이지별 레이아웃 · 섹션별 적용 레퍼런스</h4>
        {selectedPages.map((page) => (
          <div key={page.pageId} style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <b style={{ fontSize: 14 }}>{page.pageTitle}</b>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 2, paddingLeft: 12 }}>
              {page.sections
                .filter((s) => s.status === "confirmed")
                .map((section) => {
                  const resolved = resolveSectionPriority(page, section, references.sectionDecisionsByKey ?? {});
                  const layoutPattern = references.bySectionId?.[section.sectionId]?.layoutPattern;
                  const appliedCount = adoptionsForSection(references, page.pageId, section.sectionId).filter(
                    (a) => a.status === "applied",
                  ).length;
                  return (
                    <li key={section.sectionId} style={{ fontSize: 14, color: "var(--text-muted)" }}>
                      {section.sectionTitle}
                      {" · "}
                      {resolved.priority === "high-impact" ? "핵심 섹션" : resolved.priority === "optional" ? "선택 작업" : "기본 방향 적용"}
                      {layoutPattern && ` · 레이아웃: ${layoutPattern}`}
                      {appliedCount > 0 && ` · 적용 레퍼런스 ${appliedCount}개`}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>

      <div style={pageCardStyle}>
        <h4 style={{ fontSize: 16, fontWeight: 600 }}>브랜드 가져올 점·피할 점</h4>
        {adoptedTargets.length > 0 ? (
          adoptedTargets.map((t) => {
            const override = references.brandDecisionOverrides?.[t.id];
            const deep = references.targetAnalyses?.[t.id];
            return (
              <div key={t.id} style={{ fontSize: 14 }}>
                <b>{t.name}</b>
                <p style={{ color: "var(--text-muted)" }}>
                  가져올 점: {(override?.adoptedPatterns ?? deep?.wowPoints ?? []).join(", ") || "—"}
                </p>
                <p style={{ color: "var(--text-muted)" }}>
                  피할 점: {(override?.avoidedPatterns ?? deep?.painPoints ?? []).join(", ") || "—"}
                </p>
              </div>
            );
          })
        ) : (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>채택한 분석 대상 브랜드가 없습니다.</p>
        )}
      </div>

      <div style={pageCardStyle}>
        <h4 style={{ fontSize: 16, fontWeight: 600 }}>이미지 필요 영역</h4>
        {selectedPages.some((page) =>
          page.sections
            .filter((s) => s.status === "confirmed")
            .some((s) => references.imageNeedByKey?.[sectionKey(page.pageId, s.sectionId)] ?? defaultImageNeed(s.contentType)),
        ) ? (
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
            {selectedPages.flatMap((page) =>
              page.sections
                .filter((s) => s.status === "confirmed")
                .filter(
                  (s) =>
                    references.imageNeedByKey?.[sectionKey(page.pageId, s.sectionId)] ??
                    defaultImageNeed(s.contentType),
                )
                .map((s) => (
                  <li key={s.sectionId} style={{ fontSize: 14, color: "var(--text-muted)" }}>
                    {page.pageTitle} &gt; {s.sectionTitle}
                  </li>
                )),
            )}
          </ul>
        ) : (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>새 이미지가 필요한 섹션이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
