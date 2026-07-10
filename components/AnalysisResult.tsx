"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  ExplicitRequirementKind,
  Page,
  ProjectAnalysis,
  ProjectDirective,
} from "@/lib/analysis/types";
import DirectiveEditor from "./DirectiveEditor";
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

const REQUIREMENT_KIND_LABELS: Record<ExplicitRequirementKind, string> = {
  "background-color": "배경색",
  mode: "모드",
  layout: "레이아웃",
  other: "기타",
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

// 섹션이 "페이지 전체 구조 개요" 성격이면(예: 대시보드 레이아웃 통짜 설명) 부분 제외가
// 의미 없다 — 페이지 단위 체크 해제로 충분하므로 X 버튼 자체를 렌더하지 않는다.
// recommendedLayout 기준(contentType은 hero/feature/team 같은 "내용 성격" 축이라
// 이 판단에 맞지 않음) + 명시 목록(넓은 "-layout" 접미사 매칭은 card-layout 같은
// 일반 표현 방식까지 오탐할 수 있어 배제).
const PAGE_STRUCTURE_LAYOUTS = new Set(["dashboard-layout"]);

const SECTIONS_PREVIEW_COUNT = 3;

interface AnalysisResultProps {
  analysis: ProjectAnalysis;
  onChange: (next: ProjectAnalysis) => void;
  onConfirm: () => void;
  directives: ProjectDirective[];
  onDirectivesChange: (next: ProjectDirective[]) => void;
}

const card: React.CSSProperties = {
  background: "var(--canvas)",
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

const fieldLabel: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 14,
  color: "var(--text-muted)",
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

// 실제 렌더링된 한 줄 폭을 넘길 때만 "펼쳐보기"를 노출 (게이트 2 해소).
// 글자수 휴리스틱 대신 scrollWidth/clientWidth 실측 — 카드 폭·폰트에 따라 정확히 판정된다.
function ContentSummaryText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      setOverflowing(false);
      return;
    }
    setOverflowing(el.scrollWidth > el.clientWidth + 1);
  }, [text]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        ref={ref}
        style={{
          color: "var(--text-muted)",
          fontSize: 14,
          ...(expanded
            ? {}
            : {
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }),
        }}
      >
        {text}
      </span>
      {overflowing && (
        <button
          onClick={() => setExpanded((v) => !v)}
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
}

interface PendingConfirm {
  title: string;
  message: string;
  onConfirm: () => void;
}

// 파괴적이진 않지만 하류(레퍼런스·무드·컨셉) 추천 방향이 바뀌는 변경 — 사전 고지 후 확정.
function ConfirmDialog({
  pending,
  onCancel,
}: {
  pending: PendingConfirm;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-md)",
      }}
    >
      <div
        style={{
          background: "var(--canvas)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{pending.title}</h3>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{pending.message}</p>
        <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            className="btn-secondary"
            style={{
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: "8px var(--space-base)",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            취소
          </button>
          <button
            onClick={pending.onConfirm}
            className="btn-primary"
            style={{
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: "8px var(--space-base)",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            변경 적용
          </button>
        </div>
      </div>
    </div>
  );
}

// 페이지 3가지 상태(선택됨 / 사용자 직접 제외 / AI 자동 미선택)를 한눈에 구분.
function pageContainerStyle(p: Page): React.CSSProperties {
  if (p.selected) {
    return { border: "1px solid var(--border)", opacity: 1 };
  }
  if (p.excludedReason) {
    // 사용자가 의도적으로 뺀 페이지 — 사유 셀렉트가 함께 노출된다.
    return { border: "1px solid var(--border)", opacity: 0.82 };
  }
  // AI가 상위 N개 자동 선택에서 밀린 것뿐 — 점선으로 "확정 아님"을 표시.
  return { border: "1px dashed var(--border)", opacity: 0.55 };
}

function SectionList({
  page,
  expanded,
  onToggleExpanded,
  onRenameSection,
  onDeleteSection,
}: {
  page: Page;
  expanded: boolean;
  onToggleExpanded: () => void;
  onRenameSection: (sectionId: string, title: string) => void;
  onDeleteSection: (sectionId: string) => void;
}) {
  const visible = expanded ? page.sections : page.sections.slice(0, SECTIONS_PREVIEW_COUNT);
  const hiddenCount = page.sections.length - visible.length;

  return (
    <>
      <div style={{ borderTop: "1px solid var(--border)" }} />
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        {visible.map((s) => (
          <li
            key={s.sectionId}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-xs)",
              padding: "10px var(--space-md)",
              background: "var(--surface)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
              <input
                value={s.sectionTitle}
                onChange={(e) => onRenameSection(s.sectionId, e.target.value)}
                className="input-box"
                style={{
                  ...inputStyle,
                  border: undefined,
                  fontWeight: 600,
                  width: 180,
                  padding: "4px var(--space-sm)",
                }}
              />
              <span style={contentTypeTag} title="내용 성격">
                {s.contentType}
              </span>
              <span style={layoutPatternTag} title="표현 방식">
                {s.recommendedLayout}
              </span>
              {s.unresolvedNotes && s.unresolvedNotes.length > 0 && (
                <span style={warningPill}>미결 {s.unresolvedNotes.length}</span>
              )}
              {!PAGE_STRUCTURE_LAYOUTS.has(s.recommendedLayout) && (
                <button
                  onClick={() => onDeleteSection(s.sectionId)}
                  aria-label="이 섹션 제외"
                  title="이 섹션 제외"
                  className="btn-icon-neutral"
                  style={{ marginLeft: "auto", width: 28, height: 28 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <ContentSummaryText text={s.contentSummary} />
          </li>
        ))}
      </ul>
      {page.sections.length > SECTIONS_PREVIEW_COUNT && (
        <button
          onClick={onToggleExpanded}
          className="btn-tertiary"
          style={{ alignSelf: "flex-start", border: "none", fontSize: 14, fontWeight: 600 }}
        >
          {expanded ? "접기" : `+${hiddenCount}개 섹션 더 보기`}
        </button>
      )}
    </>
  );
}

export default function AnalysisResult({
  analysis,
  onChange,
  onConfirm,
  directives,
  onDirectivesChange,
}: AnalysisResultProps) {
  const [notice, setNotice] = useState<string>();
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [businessDomainDraft, setBusinessDomainDraft] = useState(
    analysis.businessDomain ?? "",
  );
  const [expandedSectionPages, setExpandedSectionPages] = useState<Set<string>>(new Set());
  const selectedCount = analysis.pages.filter((p) => p.selected).length;

  // 다른 분석 결과가 로드되면(재활용 등) 초안도 새 값으로 맞춘다.
  useEffect(() => {
    setBusinessDomainDraft(analysis.businessDomain ?? "");
  }, [analysis.businessDomain]);

  const toggleSectionPageExpanded = (pageId: string) =>
    setExpandedSectionPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });

  // 화면 유형·프로젝트 도메인 변경 = 자동 반영 금지 (Step 6). 값만 바뀔 뿐 구성
  // 페이지·섹션 자체는 건드리지 않지만, 이후 레퍼런스·무드·컨셉 추천이 새 값
  // 기준으로 달라지므로 사전 고지 후 확정한다.
  const requestFieldChange = (label: string, apply: () => void) => {
    setPendingConfirm({
      title: `${label} 변경`,
      message: `${label} 변경은 이후 레퍼런스·컨셉 추천에 반영됩니다. 현재 선택한 페이지·섹션은 그대로 유지됩니다.`,
      onConfirm: () => {
        apply();
        setPendingConfirm(null);
      },
    });
  };

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
  const businessDomainDirty = businessDomainDraft !== (analysis.businessDomain ?? "");

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
          background: "var(--canvas)",
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
      {pendingConfirm && (
        <ConfirmDialog pending={pendingConfirm} onCancel={() => setPendingConfirm(null)} />
      )}

      {/* 분석 요약 — 프로젝트 정보 + 분석 정보를 단일 카드로 통합 */}
      <div style={card}>
        <span style={groupLabel}>분석 요약</span>
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          <input
            value={analysis.title}
            onChange={(e) => onChange({ ...analysis, title: e.target.value })}
            style={{ ...inputStyle, fontSize: 22, fontWeight: 700, border: "none", padding: "4px 0" }}
          />
        </label>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          {analysis.description || "—"}
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          타겟: {analysis.targetUser || "—"}
        </p>

        {analysis.parentSiteRelation && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-sm)",
              flexWrap: "wrap",
              fontSize: 14,
              padding: "8px var(--space-md)",
              background: "var(--surface-alt)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <LinkIcon size={16} color="var(--text-muted)" />
            <span style={{ color: "var(--text-muted)" }}>
              {analysis.parentSiteRelation.relationNote}
            </span>
            {analysis.parentSiteRelation.confirmed ? (
              <>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontWeight: 700,
                    color: "var(--success)",
                  }}
                >
                  <Check size={14} color="var(--success)" />
                  반영됨
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
                  className="btn-tertiary"
                  style={{ border: "none", fontSize: 13, fontWeight: 600 }}
                >
                  해제
                </button>
              </>
            ) : (
              <>
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
                    padding: "4px 10px",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  맞습니다
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
                    padding: "4px 10px",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  아닙니다
                </button>
              </>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: "var(--space-lg)", flexWrap: "wrap", alignItems: "flex-start" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <span style={fieldLabel}>프로젝트 도메인</span>
            <div style={{ display: "flex", gap: "var(--space-xs)", alignItems: "center" }}>
              <input
                value={businessDomainDraft}
                onChange={(e) => setBusinessDomainDraft(e.target.value)}
                placeholder="예: 스마트시티, 통합관제"
                className="input-box"
                style={{ ...inputStyle, width: 160, border: undefined }}
              />
              {businessDomainDirty && (
                <button
                  onClick={() =>
                    requestFieldChange("프로젝트 도메인", () =>
                      onChange({
                        ...analysis,
                        businessDomain: businessDomainDraft || undefined,
                      }),
                    )
                  }
                  className="btn-weak-primary"
                  style={{
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    padding: "8px 10px",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  적용
                </button>
              )}
            </div>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <span style={fieldLabel}>화면 유형</span>
            <select
              value={analysis.domain}
              onChange={(e) => {
                const next = e.target.value as DomainHint;
                if (next === analysis.domain) return;
                requestFieldChange("화면 유형", () => onChange({ ...analysis, domain: next }));
              }}
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
            <span style={fieldLabel}>산출물 형식</span>
            <input
              value={analysis.projectType}
              onChange={(e) =>
                onChange({ ...analysis, projectType: e.target.value })
              }
              className="input-box"
              style={{ ...inputStyle, width: 160, border: undefined }}
            />
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", minWidth: 160 }}>
            <span style={fieldLabel}>AI 분석 신뢰도</span>
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
            {analysis.domainConfidenceReason && (
              <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                근거: {analysis.domainConfidenceReason}
              </span>
            )}
            {confidenceLow && (
              <span style={{ fontSize: 14, color: "var(--warning)" }}>낮음 — 직접 확인 필요</span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          <span style={fieldLabel}>핵심 키워드</span>
          {/* 접기/펼치기 없이 항상 전체 노출 — 현재 개수(7개 안팎) 수준에선 접을
              이유가 없다. 실사용에서 개수가 크게 늘어나면 그때 임계값을 재검토. */}
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
            {uniqueTags.map((t) => (
              <span key={t} style={hashtagPill}>
                #{t}
              </span>
            ))}
          </div>
        </div>

        {analysis.brandColors && analysis.brandColors.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <span style={fieldLabel}>브랜드 컬러</span>
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

      {analysis.explicitRequirements && analysis.explicitRequirements.length > 0 && (
        <div style={{ ...card, borderColor: "var(--border)", background: "var(--surface-alt)" }}>
          <h3 style={{ ...noticeHeading, color: "var(--text-strong)" }}>
            <FileText size={20} color="var(--text-muted)" />
            문서 명시 요구사항 {analysis.explicitRequirements.length}건
          </h3>
          <ul style={{ paddingLeft: 20, fontSize: 14, display: "flex", flexDirection: "column", gap: 4 }}>
            {analysis.explicitRequirements.map((r, i) => (
              <li key={i}>
                <span style={{ ...contentTypeTag, marginRight: 8 }}>
                  {REQUIREMENT_KIND_LABELS[r.kind]}
                </span>
                {r.text}
                {r.value && <code style={{ marginLeft: 6 }}>({r.value})</code>}
              </li>
            ))}
          </ul>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            컨셉 3안 생성 시 변주 대상이 아니라 모든 안이 지켜야 할 제약으로
            반영됩니다.
          </p>
        </div>
      )}

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
                  ...pageContainerStyle(p),
                  borderRadius: "var(--radius-lg)",
                  padding: "var(--space-base)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-sm)",
                }}
              >
                {/* 1행 — 강한 위계: 체크박스 + 페이지명(헤더) + 역할 뱃지 */}
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
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{p.pageTitle}</span>
                  <span style={contentTypeTag}>{ROLE_LABELS[p.pageRole] ?? p.pageRole}</span>
                  <span style={{ flex: 1 }} />
                  {!p.selected && p.excludedReason && (
                    <>
                      <span style={{ ...warningPill, fontSize: 13 }}>제외됨</span>
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
                    </>
                  )}
                  {/* excludedReason이 없으면 "제외"가 아니라 상위 N개 자동 선택에서 밀린
                      것뿐 — 사용자·AI 누구도 이 페이지를 의도적으로 뺀 적이 없으므로
                      "직접 제외" 같은 확정적 사유·셀렉트를 보여주지 않는다(체크만 하면
                      바로 복귀). 점선 테두리+안내 문구만으로 "AI 자동 미선택"임을 표시. */}
                  {!p.selected && !p.excludedReason && (
                    <span
                      style={{
                        fontSize: 13,
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      자동 미선택 — 상위 {MAX_SELECTED_PAGES}개만 기본 선택됨
                    </span>
                  )}
                </div>
                {/* 2행 — 보조 정보(낮은 위계): 출처 슬라이드·문서ID */}
                {(p.sourceSlides || p.sourceDocumentId) && (
                  <div
                    style={{
                      display: "flex",
                      gap: "var(--space-sm)",
                      flexWrap: "wrap",
                      fontSize: 12,
                      color: "var(--text-muted)",
                      paddingLeft: 28,
                    }}
                  >
                    {p.sourceSlides && <span>슬라이드 {p.sourceSlides.join(", ")}</span>}
                    {p.sourceDocumentId && <span>ID: {p.sourceDocumentId}</span>}
                  </div>
                )}
                {p.selected && (
                  <SectionList
                    page={p}
                    expanded={expandedSectionPages.has(p.pageId)}
                    onToggleExpanded={() => toggleSectionPageExpanded(p.pageId)}
                    onRenameSection={(sectionId, title) => renameSection(p.pageId, sectionId, title)}
                    onDeleteSection={(sectionId) => deleteSection(p.pageId, sectionId)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={card}>
        <DirectiveEditor directives={directives} onChange={onDirectivesChange} />
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

const tagBase: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  padding: "4px 10px",
};

// 내용 성격(contentType) — 채워진 중립톤 pill. 인터랙티브 요소가 아니므로 primary 금지.
const contentTypeTag: React.CSSProperties = {
  ...tagBase,
  color: "var(--text-muted)",
  background: "var(--surface-alt)",
  borderRadius: "var(--radius-full)",
};

// 표현 방식(layoutPattern) — contentType과 다른 축임을 "모양"으로 구분(테두리만, 사각).
// 같은 중립톤(text-muted)이지만 locked(#94a3b8)와는 다른 토큰이라 "비활성"으로 안 읽힌다.
const layoutPatternTag: React.CSSProperties = {
  ...tagBase,
  color: "var(--text-muted)",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
};

// 프로젝트 전역 해시태그(핵심 키워드) — contentType/layoutPattern(섹션 축)과 구분되도록
// text-strong로 한 단계 진하게. surface-alt 배경은 공유하되 텍스트 톤 차등만 준다.
const hashtagPill: React.CSSProperties = {
  ...tagBase,
  color: "var(--text-strong)",
  background: "var(--surface-alt)",
  borderRadius: "var(--radius-full)",
};

const warningPill: React.CSSProperties = {
  ...tagBase,
  color: "var(--warning-weak-text)",
  background: "var(--warning-weak-bg)",
  borderRadius: "var(--radius-full)",
};
