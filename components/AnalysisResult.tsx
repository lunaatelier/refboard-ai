"use client";

import { useState } from "react";
import { MAX_SELECTED_PAGES } from "@/lib/analysis/normalize";
import type {
  DomainHint,
  ExclusionReason,
  ProjectAnalysis,
} from "@/lib/analysis/types";

// 분석 결과 (Step 7) — 자동 도출하되 셀렉트/편집으로 수정 가능 (UI 원칙).
// 페이지 최대 5개 선택, 제외 시 사유 = 이후 프롬프트 차단 조건.

const DOMAIN_LABELS: Record<DomainHint, string> = {
  "marketing-web": "마케팅 웹",
  "dashboard-ops": "대시보드·운영",
  "mobile-app": "모바일 앱",
  document: "문서형",
  generic: "일반",
};

const ROLE_LABELS: Record<string, string> = {
  cover: "표지",
  "section-divider": "간지",
  content: "본문",
  "case-study": "사례",
  metrics: "지표",
  team: "팀",
  appendix: "부록",
  contact: "연락처",
};

const ROLE_ICONS: Record<string, string> = {
  cover: "🖼️",
  "section-divider": "📑",
  content: "📄",
  "case-study": "📊",
  metrics: "📈",
  team: "👥",
  appendix: "📎",
  contact: "✉️",
};

const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  sensitive: "민감 정보",
  "out-of-scope": "범위 밖",
  "low-priority": "낮은 우선순위",
  duplicate: "중복",
  "quality-issue": "품질 문제",
  "user-choice": "직접 제외",
  other: "기타",
};

const TAGS_PREVIEW_COUNT = 4;

interface AnalysisResultProps {
  analysis: ProjectAnalysis;
  onChange: (next: ProjectAnalysis) => void;
  onConfirm: () => void;
}

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const groupLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

function isLikelyPlaceholderBlack(colors: string[]): boolean {
  const normalized = new Set(colors.map((c) => c.trim().toLowerCase()));
  if (normalized.size !== 1) return false;
  const only = [...normalized][0];
  return /^#0{3,6}$/.test(only) || only === "black";
}

export default function AnalysisResult({
  analysis,
  onChange,
  onConfirm,
}: AnalysisResultProps) {
  const [notice, setNotice] = useState<string>();
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const selectedCount = analysis.pages.filter((p) => p.selected).length;

  const patchPage = (pageId: string, patch: Partial<ProjectAnalysis["pages"][number]>) =>
    onChange({
      ...analysis,
      pages: analysis.pages.map((p) =>
        p.pageId === pageId ? { ...p, ...patch } : p,
      ),
    });

  const togglePage = (pageId: string, selected: boolean) => {
    if (selected && selectedCount >= MAX_SELECTED_PAGES) {
      setNotice(`페이지는 최대 ${MAX_SELECTED_PAGES}개까지 선택할 수 있습니다.`);
      return;
    }
    setNotice(undefined);
    patchPage(
      pageId,
      selected
        ? { selected, excludedReason: undefined, excludedNote: undefined }
        : { selected, excludedReason: "user-choice" },
    );
  };

  const deleteSection = (pageId: string, sectionId: string) =>
    onChange({
      ...analysis,
      pages: analysis.pages.map((p) =>
        p.pageId === pageId
          ? { ...p, sections: p.sections.filter((s) => s.sectionId !== sectionId) }
          : p,
      ),
    });

  const renameSection = (pageId: string, sectionId: string, title: string) =>
    onChange({
      ...analysis,
      pages: analysis.pages.map((p) =>
        p.pageId === pageId
          ? {
              ...p,
              sections: p.sections.map((s) =>
                s.sectionId === sectionId ? { ...s, sectionTitle: title } : s,
              ),
            }
          : p,
      ),
    });

  const confidencePct = Math.round(analysis.domainConfidence * 100);
  const confidenceLow = analysis.domainConfidence < 0.7;
  const visibleTags = tagsExpanded
    ? analysis.tags
    : analysis.tags.slice(0, TAGS_PREVIEW_COUNT);
  const hiddenTagCount = analysis.tags.length - visibleTags.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>
      {/* 지금 할 일 안내 */}
      <div
        style={{
          ...card,
          padding: "16px 20px",
          background: "var(--primary-soft)",
          border: "1px solid var(--primary)",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--primary)" }}>
          👉 구성 페이지를 확인하고 선택한 뒤, 하단에서 분석을 확정하세요
        </span>
        <span
          style={{
            fontWeight: 700,
            color: "var(--primary)",
            background: "var(--surface)",
            borderRadius: 999,
            padding: "4px 14px",
          }}
        >
          {selectedCount}/{MAX_SELECTED_PAGES}개 선택됨
        </span>
      </div>

      {/* 프로젝트 정보 */}
      <div style={card}>
        <span style={groupLabel}>프로젝트 정보</span>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <input
            value={analysis.title}
            onChange={(e) => onChange({ ...analysis, title: e.target.value })}
            style={{ ...inputStyle, fontSize: 22, fontWeight: 800, border: "none", padding: "4px 0" }}
          />
        </label>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          {analysis.description}
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          타겟: {analysis.targetUser || "—"}
        </p>
        {analysis.brandColors && analysis.brandColors.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>브랜드 컬러</span>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {analysis.brandColors.map((c) => (
                <div
                  key={c}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                >
                  <span
                    title={c}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: c,
                      border: "1px solid var(--border)",
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{c}</span>
                </div>
              ))}
            </div>
            {isLikelyPlaceholderBlack(analysis.brandColors) && (
              <p style={{ fontSize: 13, color: "#b45309" }}>
                ⚠ 색상이 전부 동일한 검은색입니다 — AI가 실제 브랜드 컬러를
                찾지 못했을 수 있어요. 원문에 컬러 언급이 있는지 확인해
                주세요.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 분석 정보 */}
      <div style={card}>
        <span style={groupLabel}>분석 정보</span>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-muted)" }}>
              도메인
            </span>
            <select
              value={analysis.domain}
              onChange={(e) =>
                onChange({ ...analysis, domain: e.target.value as DomainHint })
              }
              style={selectStyle}
            >
              {(Object.keys(DOMAIN_LABELS) as DomainHint[]).map((d) => (
                <option key={d} value={d}>
                  {DOMAIN_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-muted)" }}>
              종류
            </span>
            <input
              value={analysis.projectType}
              onChange={(e) =>
                onChange({ ...analysis, projectType: e.target.value })
              }
              style={{ ...inputStyle, width: 160 }}
            />
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-muted)" }}>
              신뢰도
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 80,
                  height: 6,
                  borderRadius: 999,
                  background: "var(--border)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${confidencePct}%`,
                    height: "100%",
                    background: confidenceLow ? "#b45309" : "var(--success)",
                  }}
                />
              </div>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: confidenceLow ? "#b45309" : "var(--success)",
                }}
              >
                {confidencePct}%
              </span>
            </div>
            {confidenceLow && (
              <span style={{ fontSize: 12, color: "#b45309" }}>낮음 — 직접 확인 필요</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {visibleTags.map((t) => (
            <span
              key={t}
              style={{
                background: "var(--primary-soft)",
                color: "var(--primary)",
                borderRadius: 999,
                padding: "2px 12px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              #{t}
            </span>
          ))}
          {hiddenTagCount > 0 && (
            <button
              onClick={() => setTagsExpanded(true)}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              +{hiddenTagCount}
            </button>
          )}
          {tagsExpanded && analysis.tags.length > TAGS_PREVIEW_COUNT && (
            <button
              onClick={() => setTagsExpanded(false)}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              접기
            </button>
          )}
        </div>
      </div>

      {analysis.existingContentVariants &&
        analysis.existingContentVariants.length > 0 && (
          <div style={{ ...card, borderColor: "#f59e0b", background: "#fffbeb" }}>
            <h3 style={{ fontSize: 15 }}>
              📑 이 문서에 이미 {analysis.existingContentVariants.length}개
              시안 변형이 있습니다
            </h3>
            <ul style={{ paddingLeft: 20 }}>
              {analysis.existingContentVariants.map((v) => (
                <li key={v.variantId}>
                  <b>{v.label}</b> — {v.contentSummary}
                  {v.sourceSlides && ` (슬라이드 ${v.sourceSlides.join(", ")})`}
                </li>
              ))}
            </ul>
            <p style={{ color: "var(--text-muted)" }}>
              컨셉 3안 생성 시 이 변형들을 기반으로 만들지 물어봅니다 — AI가
              처음부터 새로 만들지 않습니다.
            </p>
          </div>
        )}

      {analysis.parentSiteRelation && (
        <div style={{ ...card, borderColor: "#7c3aed", background: "#faf5ff" }}>
          <h3 style={{ fontSize: 15 }}>
            🔗 이 문서는 다른 사이트의 관리자 화면으로 보입니다
          </h3>
          <p>{analysis.parentSiteRelation.relationNote}</p>
          {analysis.parentSiteRelation.confirmed ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontWeight: 700, color: "#7c3aed" }}>
                ✓ 확정됨 — 레퍼런스가 &ldquo;부모 사이트를 관리하는 CMS
                백오피스&rdquo;로 좁혀집니다
              </span>
              <button
                onClick={() =>
                  onChange({
                    ...analysis,
                    parentSiteRelation: {
                      ...analysis.parentSiteRelation!,
                      confirmed: false,
                    },
                  })
                }
                style={{
                  border: "1px solid var(--border)",
                  background: "transparent",
                  borderRadius: 6,
                  padding: "4px 12px",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                해제
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() =>
                  onChange({
                    ...analysis,
                    parentSiteRelation: {
                      ...analysis.parentSiteRelation!,
                      confirmed: true,
                    },
                  })
                }
                style={{
                  border: "none",
                  background: "#7c3aed",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "6px 16px",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                맞습니다 — 레퍼런스에 반영
              </button>
              <button
                onClick={() => {
                  const { parentSiteRelation: _removed, ...rest } = analysis;
                  onChange(rest);
                }}
                style={{
                  border: "1px solid var(--border)",
                  background: "transparent",
                  borderRadius: 8,
                  padding: "6px 16px",
                  fontWeight: 600,
                  fontSize: 14,
                  color: "var(--text-muted)",
                }}
              >
                아닙니다 — 무시
              </button>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                확정하면 레퍼런스 검색이 일반 관리자 대시보드 대신 CMS
                백오피스 쪽으로 좁혀집니다
              </span>
            </div>
          )}
        </div>
      )}

      {analysis.detectedCaseStudies &&
        analysis.detectedCaseStudies.length > 0 && (
          <div style={{ ...card, borderColor: "#0ea5e9", background: "#f0f9ff" }}>
            <h3 style={{ fontSize: 15 }}>
              🔎 문서 안에 기존 사례분석 {analysis.detectedCaseStudies.length}건
            </h3>
            <ul style={{ paddingLeft: 20 }}>
              {analysis.detectedCaseStudies.map((c, i) => (
                <li key={i}>
                  <b>{c.name}</b> — {c.extractedNote}
                </li>
              ))}
            </ul>
            <p style={{ color: "var(--text-muted)" }}>
              분석 대상 브랜드 목록에 &ldquo;이미 분석됨&rdquo;으로
              선반영됩니다 (처음부터 재조사하지 않음).
            </p>
          </div>
        )}

      {/* 구성 페이지 */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={groupLabel}>구성 페이지</span>
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
            제외한 페이지는 이후 AI 참조가 차단됩니다
          </span>
        </div>
        {notice && <p style={{ color: "#b45309", fontWeight: 600 }}>{notice}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {analysis.pages.map((p) => (
            <div
              key={p.pageId}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                opacity: p.selected ? 1 : 0.6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={p.selected}
                  onChange={(e) => togglePage(p.pageId, e.target.checked)}
                />
                <span aria-hidden style={{ fontSize: 18 }}>
                  {ROLE_ICONS[p.pageRole] ?? "📄"}
                </span>
                <span style={{ fontWeight: 700, flex: 1 }}>{p.pageTitle}</span>
                {!p.selected && (
                  <select
                    value={p.excludedReason ?? "user-choice"}
                    onChange={(e) =>
                      patchPage(p.pageId, {
                        excludedReason: e.target.value as ExclusionReason,
                      })
                    }
                    style={{ ...selectStyle, fontSize: 13 }}
                  >
                    {(Object.keys(EXCLUSION_LABELS) as ExclusionReason[]).map(
                      (r) => (
                        <option key={r} value={r}>
                          제외: {EXCLUSION_LABELS[r]}
                        </option>
                      ),
                    )}
                  </select>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  paddingLeft: 28,
                }}
              >
                <span style={{ ...pill, background: "#f3f4f6", color: "#374151" }}>
                  {ROLE_LABELS[p.pageRole] ?? p.pageRole}
                </span>
                {p.sourceSlides && <span>슬라이드 {p.sourceSlides.join(", ")}</span>}
                {p.sourceDocumentId && <span>ID: {p.sourceDocumentId}</span>}
              </div>
              {p.selected && (
                <>
                  <div style={{ borderTop: "1px solid var(--border)" }} />
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                    {p.sections.map((s) => (
                      <li
                        key={s.sectionId}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          padding: "10px 12px",
                          background: "var(--bg)",
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <input
                            value={s.sectionTitle}
                            onChange={(e) =>
                              renameSection(p.pageId, s.sectionId, e.target.value)
                            }
                            style={{
                              ...inputStyle,
                              fontWeight: 600,
                              width: 180,
                              padding: "4px 8px",
                            }}
                          />
                          <span style={pill}>{s.contentType}</span>
                          <span style={{ ...pill, background: "#f3f4f6", color: "#374151" }}>
                            {s.recommendedLayout}
                          </span>
                          {s.unresolvedNotes && s.unresolvedNotes.length > 0 && (
                            <span style={{ ...pill, background: "#fef3c7", color: "#b45309" }}>
                              미결 {s.unresolvedNotes.length}
                            </span>
                          )}
                          <button
                            onClick={() => deleteSection(p.pageId, s.sectionId)}
                            aria-label="섹션 삭제"
                            title="섹션 삭제"
                            style={{
                              marginLeft: "auto",
                              border: "none",
                              background: "transparent",
                              borderRadius: 6,
                              padding: "2px 6px",
                              color: "var(--text-muted)",
                              fontSize: 13,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                        <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
                          {s.contentSummary}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onConfirm}
        disabled={selectedCount === 0}
        style={{
          alignSelf: "flex-start",
          padding: "14px 28px",
          borderRadius: 10,
          border: "none",
          background: selectedCount === 0 ? "var(--locked)" : "var(--primary)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        다음
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  font: "inherit",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  paddingRight: 32,
};

const pill: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--primary)",
  background: "var(--primary-soft)",
  borderRadius: 6,
  padding: "1px 8px",
};
