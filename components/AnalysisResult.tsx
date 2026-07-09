"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  FileText,
  Image as ImageIcon,
  Info,
  Link as LinkIcon,
  Mail,
  Paperclip,
  Search,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { MAX_SELECTED_PAGES } from "@/lib/analysis/normalize";
import type {
  DomainHint,
  ExclusionReason,
  ProjectAnalysis,
} from "@/lib/analysis/types";
import PageLayout, { PageCta } from "./shell/PageLayout";

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

const ROLE_ICONS: Record<string, LucideIcon> = {
  cover: ImageIcon,
  "section-divider": FileText,
  content: FileText,
  "case-study": BarChart3,
  metrics: TrendingUp,
  team: Users,
  appendix: Paperclip,
  contact: Mail,
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

const TAGS_PREVIEW_COUNT = 2;

interface AnalysisResultProps {
  analysis: ProjectAnalysis;
  onChange: (next: ProjectAnalysis) => void;
  onConfirm: () => void;
}

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-lg)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-md)",
};

const groupLabel: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const noticeHeading: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-sm)",
  fontSize: 18,
  fontWeight: 600,
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const selectedCount = analysis.pages.filter((p) => p.selected).length;

  const toggleSectionExpanded = (sectionId: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });

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
  const uniqueTags = [...new Set(analysis.tags)];
  const visibleTags = tagsExpanded
    ? uniqueTags
    : uniqueTags.slice(0, TAGS_PREVIEW_COUNT);
  const hiddenTagCount = uniqueTags.length - visibleTags.length;

  const taskBanner = (
    <div
      style={{
        ...card,
        padding: "var(--space-base) var(--space-md)",
        background: "var(--primary-soft)",
        border: "1px solid var(--primary)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-md)",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-sm)",
          fontWeight: 700,
          fontSize: 14,
          color: "var(--primary)",
        }}
      >
        <Info size={18} color="var(--primary)" />
        구성 페이지를 확인하고 선택한 뒤, 하단에서 분석을 확정하세요
      </span>
      <span
        style={{
          fontWeight: 700,
          fontSize: 14,
          color: "var(--primary)",
          background: "var(--surface)",
          borderRadius: "var(--radius-full)",
          padding: "4px 14px",
        }}
      >
        {selectedCount}/{MAX_SELECTED_PAGES}개 선택됨
      </span>
    </div>
  );

  return (
    <PageLayout
      title="분석 결과"
      description="AI가 도출한 구성 페이지·섹션·도메인을 확인하고 필요하면 수정하세요."
      banner={taskBanner}
    >
      {/* 프로젝트 정보 */}
      <div style={card}>
        <span style={groupLabel}>프로젝트 정보</span>
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          <input
            value={analysis.title}
            onChange={(e) => onChange({ ...analysis, title: e.target.value })}
            style={{ ...inputStyle, fontSize: 22, fontWeight: 700, border: "none", padding: "4px 0" }}
          />
        </label>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          {analysis.description}
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          타겟: {analysis.targetUser || "—"}
        </p>
        {analysis.brandColors && analysis.brandColors.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <span style={{ fontWeight: 600, fontSize: 16 }}>브랜드 컬러</span>
            <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
              {analysis.brandColors.map((c) => (
                <div
                  key={c}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-xs)" }}
                >
                  <span
                    title={c}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "var(--radius-md)",
                      background: c,
                      border: "1px solid var(--border)",
                    }}
                  />
                  <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{c}</span>
                </div>
              ))}
            </div>
            {isLikelyPlaceholderBlack(analysis.brandColors) && (
              <p
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-xs)",
                  fontSize: 14,
                  color: "var(--warning-weak-text)",
                }}
              >
                <AlertTriangle size={16} color="var(--warning-weak-text)" />
                색상이 전부 동일한 검은색입니다 — AI가 실제 브랜드 컬러를
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
        <div style={{ display: "flex", gap: "var(--space-lg)", flexWrap: "wrap", alignItems: "flex-start" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-muted)" }}>
              도메인
            </span>
            <select
              value={analysis.domain}
              onChange={(e) =>
                onChange({ ...analysis, domain: e.target.value as DomainHint })
              }
              className="select-box"
            >
              {(Object.keys(DOMAIN_LABELS) as DomainHint[]).map((d) => (
                <option key={d} value={d}>
                  {DOMAIN_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-muted)" }}>
              종류
            </span>
            <input
              value={analysis.projectType}
              onChange={(e) =>
                onChange({ ...analysis, projectType: e.target.value })
              }
              className="input-box"
              style={{ ...inputStyle, width: 160, border: undefined }}
            />
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", minWidth: 140 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-muted)" }}>
              신뢰도
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <div
                style={{
                  width: 80,
                  height: 6,
                  borderRadius: "var(--radius-full)",
                  background: "var(--border)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${confidencePct}%`,
                    height: "100%",
                    background: confidenceLow ? "var(--warning)" : "var(--success)",
                  }}
                />
              </div>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: confidenceLow ? "var(--warning)" : "var(--success)",
                }}
              >
                {confidencePct}%
              </span>
            </div>
            {confidenceLow && (
              <span style={{ fontSize: 14, color: "var(--warning)" }}>낮음 — 직접 확인 필요</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
          {visibleTags.map((t) => (
            <span
              key={t}
              style={{
                background: "var(--primary-soft)",
                color: "var(--primary)",
                borderRadius: "var(--radius-full)",
                padding: "4px 12px",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              #{t}
            </span>
          ))}
          {hiddenTagCount > 0 && (
            <button
              onClick={() => setTagsExpanded(true)}
              className="btn-tertiary"
              style={{
                border: "none",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              +{hiddenTagCount}
            </button>
          )}
          {tagsExpanded && uniqueTags.length > TAGS_PREVIEW_COUNT && (
            <button
              onClick={() => setTagsExpanded(false)}
              className="btn-tertiary"
              style={{
                border: "none",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              접기
            </button>
          )}
        </div>
      </div>

      {analysis.existingContentVariants &&
        analysis.existingContentVariants.length > 0 && (
          <div style={{ ...card, borderColor: "var(--warning)", background: "var(--warning-weak-bg)" }}>
            <h3 style={{ ...noticeHeading, color: "var(--warning-weak-text)" }}>
              <FileText size={20} color="var(--warning-weak-text)" />
              이 문서에 이미 {analysis.existingContentVariants.length}개
              시안 변형이 있습니다
            </h3>
            <ul style={{ paddingLeft: 20, fontSize: 14 }}>
              {analysis.existingContentVariants.map((v) => (
                <li key={v.variantId}>
                  <b>{v.label}</b> — {v.contentSummary}
                  {v.sourceSlides && ` (슬라이드 ${v.sourceSlides.join(", ")})`}
                </li>
              ))}
            </ul>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
              컨셉 3안 생성 시 이 변형들을 기반으로 만들지 물어봅니다 — AI가
              처음부터 새로 만들지 않습니다.
            </p>
          </div>
        )}

      {analysis.parentSiteRelation && (
        <div style={{ ...card, borderColor: "var(--border)", background: "var(--surface-alt)" }}>
          <h3 style={{ ...noticeHeading, color: "var(--text-strong)" }}>
            <LinkIcon size={20} color="var(--text-muted)" />
            이 문서는 다른 사이트의 관리자 화면으로 보입니다
          </h3>
          <p style={{ fontSize: 14 }}>{analysis.parentSiteRelation.relationNote}</p>
          {analysis.parentSiteRelation.confirmed ? (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-xs)",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "var(--success)",
                }}
              >
                <Check size={16} color="var(--success)" />
                확정됨 — 레퍼런스가 &ldquo;부모 사이트를 관리하는 CMS
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
                className="btn-secondary"
                style={{
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  padding: "4px var(--space-md)",
                  fontSize: 14,
                }}
              >
                해제
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
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
                className="btn-weak-primary"
                style={{
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  padding: "10px var(--space-base)",
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
                className="btn-secondary"
                style={{
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  padding: "10px var(--space-base)",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                아닙니다 — 무시
              </button>
              <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                확정하면 레퍼런스 검색이 일반 관리자 대시보드 대신 CMS
                백오피스 쪽으로 좁혀집니다
              </span>
            </div>
          )}
        </div>
      )}

      {analysis.detectedCaseStudies &&
        analysis.detectedCaseStudies.length > 0 && (
          <div style={{ ...card, borderColor: "var(--border)", background: "var(--surface-alt)" }}>
            <h3 style={{ ...noticeHeading, color: "var(--text-strong)" }}>
              <Search size={20} color="var(--text-muted)" />
              문서 안에 기존 사례분석 {analysis.detectedCaseStudies.length}건
            </h3>
            <ul style={{ paddingLeft: 20, fontSize: 14 }}>
              {analysis.detectedCaseStudies.map((c, i) => (
                <li key={i}>
                  <b>{c.name}</b> — {c.extractedNote}
                </li>
              ))}
            </ul>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
              분석 대상 브랜드 목록에 &ldquo;이미 분석됨&rdquo;으로
              선반영됩니다 (처음부터 재조사하지 않음).
            </p>
          </div>
        )}

      {/* 구성 페이지 */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={groupLabel}>구성 페이지</span>
          <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
            제외한 페이지는 이후 AI 참조가 차단됩니다
          </span>
        </div>
        {notice && <p style={{ color: "var(--warning)", fontWeight: 600, fontSize: 14 }}>{notice}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {analysis.pages.map((p) => {
            const RoleIcon = ROLE_ICONS[p.pageRole] ?? FileText;
            return (
              <div
                key={p.pageId}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "var(--space-base)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-sm)",
                  opacity: p.selected ? 1 : 0.6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                  <input
                    type="checkbox"
                    checked={p.selected}
                    onChange={(e) => togglePage(p.pageId, e.target.checked)}
                  />
                  <span
                    aria-hidden
                    style={{ display: "flex", alignItems: "center" }}
                  >
                    <RoleIcon size={18} color="var(--text-muted)" />
                  </span>
                  <span style={{ fontWeight: 700, flex: 1, fontSize: 14 }}>{p.pageTitle}</span>
                  {!p.selected && p.excludedReason && (
                    <select
                      value={p.excludedReason}
                      onChange={(e) =>
                        patchPage(p.pageId, {
                          excludedReason: e.target.value as ExclusionReason,
                        })
                      }
                      className="select-box"
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
                  {/* excludedReason이 없으면 "제외"가 아니라 상위 N개 자동 선택에서 밀린
                      것뿐 — 사용자·AI 누구도 이 페이지를 의도적으로 뺀 적이 없으므로
                      "직접 제외" 같은 확정적 사유를 보여주지 않는다 (체크만 하면 바로 복귀). */}
                  {!p.selected && !p.excludedReason && (
                    <span
                      style={{
                        fontSize: 14,
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      자동 미선택 — 상위 {MAX_SELECTED_PAGES}개만 기본 선택됨
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-sm)",
                    flexWrap: "wrap",
                    fontSize: 14,
                    color: "var(--text-muted)",
                    paddingLeft: 28,
                  }}
                >
                  <span style={{ ...neutralPill }}>
                    {ROLE_LABELS[p.pageRole] ?? p.pageRole}
                  </span>
                  {p.sourceSlides && <span>슬라이드 {p.sourceSlides.join(", ")}</span>}
                  {p.sourceDocumentId && <span>ID: {p.sourceDocumentId}</span>}
                </div>
                {p.selected && (
                  <>
                    <div style={{ borderTop: "1px solid var(--border)" }} />
                    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                      {p.sections.map((s) => (
                        <li
                          key={s.sectionId}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "var(--space-xs)",
                            padding: "10px var(--space-md)",
                            background: "var(--bg)",
                            borderRadius: "var(--radius-md)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                            <input
                              value={s.sectionTitle}
                              onChange={(e) =>
                                renameSection(p.pageId, s.sectionId, e.target.value)
                              }
                              className="input-box"
                              style={{
                                ...inputStyle,
                                border: undefined,
                                fontWeight: 600,
                                width: 180,
                                padding: "4px var(--space-sm)",
                              }}
                            />
                            <span style={pill}>{s.contentType}</span>
                            <span style={neutralPill}>
                              {s.recommendedLayout}
                            </span>
                            {s.unresolvedNotes && s.unresolvedNotes.length > 0 && (
                              <span style={{ ...pill, background: "var(--warning-weak-bg)", color: "var(--warning-weak-text)" }}>
                                미결 {s.unresolvedNotes.length}
                              </span>
                            )}
                            <button
                              onClick={() => deleteSection(p.pageId, s.sectionId)}
                              aria-label="섹션 제외"
                              title="섹션 제외"
                              className="btn-icon-neutral"
                              style={{ marginLeft: "auto", width: 28, height: 28 }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                          {(() => {
                            const expanded = expandedSections.has(s.sectionId);
                            const isLong = s.contentSummary.length > 50;
                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span
                                  style={{
                                    color: "var(--text-muted)",
                                    fontSize: 14,
                                    ...(expanded || !isLong
                                      ? {}
                                      : {
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }),
                                  }}
                                >
                                  {s.contentSummary}
                                </span>
                                {isLong && (
                                  <button
                                    onClick={() => toggleSectionExpanded(s.sectionId)}
                                    className="btn-tertiary"
                                    style={{
                                      alignSelf: "flex-start",
                                      border: "none",
                                      padding: "2px 4px",
                                      fontSize: 14,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {expanded ? "접기" : "펼쳐보기"}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <PageCta onClick={onConfirm} disabled={selectedCount === 0} locked={selectedCount === 0}>
        다음
      </PageCta>
    </PageLayout>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px var(--space-md)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  fontSize: 14,
  font: "inherit",
};

const pill: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--primary)",
  background: "var(--primary-soft)",
  borderRadius: "var(--radius-full)",
  padding: "4px 10px",
};

const neutralPill: React.CSSProperties = {
  ...pill,
  color: "var(--text-muted)",
  background: "var(--surface-alt)",
};
