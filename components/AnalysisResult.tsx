"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  FileText,
  Info,
  Link as LinkIcon,
  Pencil,
  Search,
  X,
} from "lucide-react";
import { MAX_SELECTED_PAGES, humanizeSlug } from "@/lib/analysis/normalize";
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

// 카드/구획 라벨 공통 스타일 — "분석 요약" / "문서 명시 요구사항 N건" / "이미 N개 시안
// 변형" / "기존 사례분석 N건" / "구성 페이지" 5곳이 전부 같은 레벨로 읽히도록 통일.
// 문서 제목(22px/700, --foreground)보다는 작고, 본문(14~16px)보다는 뚜렷해야 한다.
const sectionHeading: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-sm)",
  fontSize: 16,
  fontWeight: 700,
  color: "var(--text-strong)",
};

const fieldLabel: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 14,
  color: "var(--text-muted)",
};

function isLikelyPlaceholderBlack(colors: string[]): boolean {
  const normalized = new Set(colors.map((c) => c.trim().toLowerCase()));
  if (normalized.size !== 1) return false;
  const only = [...normalized][0];
  return /^#0{3,6}$/.test(only) || only === "black";
}

// 자동 도출값을 input 박스 없이 텍스트로 보여주되, 호버 시 연필 아이콘으로
// 인라인 편집을 여는 공통 처리 — "자동 도출하되 수정 가능" 원칙(CLAUDE.md §9)을
// 항상 떠 있는 input 없이 유지한다. 문서 제목·섹션명에 사용.
function InlineEditableText({
  value,
  onCommit,
  ariaLabel,
  textStyle,
  editInputStyle,
}: {
  value: string;
  onCommit: (next: string) => void;
  ariaLabel: string;
  textStyle?: React.CSSProperties;
  editInputStyle?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== value) onCommit(next);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        aria-label={ariaLabel}
        className="input-box"
        style={{ ...inputStyle, ...textStyle, padding: "4px 8px", ...editInputStyle }}
      />
    );
  }
  // 연필 아이콘은 항상 노출(옅은 톤) — 편집이 이 화면의 핵심 동선이므로
  // 호버 전에도 "수정 가능"이 보여야 한다. 호버 숨김은 발견성·터치 접근성 문제.
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-xs)",
        minWidth: 0,
      }}
    >
      <span style={textStyle}>{value}</span>
      <button
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        aria-label={`${ariaLabel} 편집`}
        title="편집"
        className="btn-icon-neutral"
        style={{ width: 24, height: 24 }}
      >
        <Pencil size={13} />
      </button>
    </span>
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
// 페이지별 박스를 걷어내고(박스 깊이 = 카드 > 섹션 두 단계로 제한) 페이지 사이는
// 구분선으로 나누므로, 상태는 투명도(+제외 UI·안내 문구)로만 표현한다.
function pageOpacity(p: Page): number {
  if (p.selected) return 1;
  if (p.excludedReason) return 0.82; // 사용자가 의도적으로 뺀 페이지 — 사유 셀렉트 노출
  return 0.55; // AI 자동 미선택 — 체크만 하면 바로 복귀
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
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        {visible.map((s) => {
          return (
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
                <InlineEditableText
                  value={s.sectionTitle}
                  onCommit={(title) => onRenameSection(s.sectionId, title)}
                  ariaLabel="섹션명"
                  textStyle={{ fontWeight: 600, fontSize: 14, color: "var(--text-strong)" }}
                  editInputStyle={{ width: 240 }}
                />
                <span style={contentTypeTag} title="내용 성격">
                  {s.contentTypeLabel ?? humanizeSlug(s.contentType)}
                </span>
                <span style={layoutPatternTag} title="표현 방식">
                  {s.recommendedLayoutLabel ?? humanizeSlug(s.recommendedLayout)}
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
              <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
                {s.contentSummary}
              </span>
            </li>
          );
        })}
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
  // 프로젝트 도메인은 여러 개일 수 있다(실사용#11) — 칩 목록 초안 + 별도 입력창.
  const [businessDomainsDraft, setBusinessDomainsDraft] = useState<string[]>(
    analysis.businessDomains ?? [],
  );
  const [businessDomainInput, setBusinessDomainInput] = useState("");
  const [expandedSectionPages, setExpandedSectionPages] = useState<Set<string>>(new Set());
  const selectedCount = analysis.pages.filter((p) => p.selected).length;

  // 다른 분석 결과가 로드되면(재활용 등) 초안도 새 값으로 맞춘다.
  useEffect(() => {
    setBusinessDomainsDraft(analysis.businessDomains ?? []);
  }, [analysis.businessDomains]);

  const addBusinessDomainDraft = () => {
    const value = businessDomainInput.trim();
    if (!value || businessDomainsDraft.includes(value)) {
      setBusinessDomainInput("");
      return;
    }
    setBusinessDomainsDraft((prev) => [...prev, value]);
    setBusinessDomainInput("");
  };

  const removeBusinessDomainDraft = (index: number) =>
    setBusinessDomainsDraft((prev) => prev.filter((_, i) => i !== index));

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
  const currentBusinessDomains = analysis.businessDomains ?? [];
  const businessDomainsDirty =
    businessDomainsDraft.length !== currentBusinessDomains.length ||
    businessDomainsDraft.some((d, i) => d !== currentBusinessDomains[i]);

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
        {selectedCount}/{analysis.pages.length}개 선택됨
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

      {/* 분석 요약 — 문서 제목/설명 → 메타 그리드 → AI 판단 → 프로젝트 도메인 →
          키워드·컬러 순. 블록 간 space-lg + 구분선으로 그룹 경계를 표시. */}
      <div style={{ ...card, gap: "var(--space-lg)" }}>
        <span style={sectionHeading}>분석 요약</span>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          <InlineEditableText
            value={analysis.title}
            onCommit={(title) => onChange({ ...analysis, title })}
            ariaLabel="문서 제목"
            textStyle={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}
            editInputStyle={{ width: "100%" }}
          />
          <p style={{ color: "var(--text-muted)", fontSize: 16 }}>
            {analysis.description || "—"}
          </p>
        </div>

        {/* 메타 그리드 — 타겟·화면 유형·산출물 형식·AI 신뢰도를 같은 라벨 위계로 한 행에 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={metaCell}>
            <span style={fieldLabel}>타겟</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>
              {analysis.targetUser || "—"}
            </span>
          </div>
          <label style={{ ...metaCell, borderLeft: "1px solid var(--border)" }}>
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
          <label
            style={{ ...metaCell, borderLeft: "1px solid var(--border)" }}
            title="화면 유형과 별도 기준입니다"
          >
            <span style={fieldLabel}>산출물 형식</span>
            <input
              value={analysis.projectType}
              onChange={(e) =>
                onChange({ ...analysis, projectType: e.target.value })
              }
              className="input-box"
              style={{ ...inputStyle, width: "100%", border: undefined }}
            />
          </label>
          {/* AI 판단 결과 — 메타 그리드의 마지막 칸. 편집 필드들과 같은 행에 있지만
              라벨+게이지로 "판단 결과"임이 구분된다. */}
          <div style={{ ...metaCell, borderLeft: "1px solid var(--border)" }}>
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
              <span style={{ fontSize: 14, color: "var(--warning)" }}>
                낮음 — 직접 확인 필요
              </span>
            )}
          </div>
        </div>

        {/* 관리자 화면 판단 근거 — 프로젝트 설명이 아니라 AI 판단 보조 정보라서
            제목 밑이 아닌 메타 그리드 아래에 낮은 위계로 붙인다. */}
        {analysis.parentSiteRelation && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-sm)",
              fontSize: 14,
              color: "var(--text-muted)",
            }}
          >
            <LinkIcon size={14} color="var(--text-muted)" />
            <span>AI 판단: {analysis.parentSiteRelation.relationNote}</span>
            <button
              onClick={() => {
                const { parentSiteRelation: _removed, ...rest } = analysis;
                onChange(rest);
              }}
              aria-label="이 판단 근거 제외"
              title="이 판단 근거 제외"
              className="btn-icon-neutral"
              style={{ width: 24, height: 24 }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* 프로젝트 도메인 — 값 개수가 가변(실사용#11)이라 고정폭 그리드가 아닌
            전용 full-width 행으로 분리. 칩 wrap + 추가 입력. */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          <span style={fieldLabel}>프로젝트 도메인</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {businessDomainsDraft.map((d, i) => (
              <span
                key={`${d}-${i}`}
                style={{ ...hashtagPill, display: "flex", alignItems: "center", gap: 4 }}
              >
                {d}
                <button
                  onClick={() => removeBusinessDomainDraft(i)}
                  aria-label={`${d} 제거`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    color: "inherit",
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              value={businessDomainInput}
              onChange={(e) => setBusinessDomainInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addBusinessDomainDraft();
                }
              }}
              placeholder="예: 스마트시티"
              className="input-box"
              style={{ ...inputStyle, width: 120, border: undefined }}
            />
            <button
              onClick={addBusinessDomainDraft}
              className="btn-weak-primary"
              style={{
                border: "none",
                borderRadius: "var(--radius-md)",
                padding: "6px 12px",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              추가
            </button>
            {businessDomainsDirty && (
              <button
                onClick={() =>
                  requestFieldChange("프로젝트 도메인", () =>
                    onChange({
                      ...analysis,
                      businessDomains:
                        businessDomainsDraft.length > 0 ? businessDomainsDraft : undefined,
                    }),
                  )
                }
                className="btn-weak-primary"
                style={{
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  padding: "6px 12px",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                적용
              </button>
            )}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)" }} />

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
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
            <span style={fieldLabel}>브랜드 컬러</span>
            <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
              {analysis.brandColors.map((c) => (
                <div
                  key={c}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span
                    title={c}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "var(--radius-sm)",
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

      {/* 분석요약·구성페이지와 동일 레벨의 표준 카드 — 배경·아이콘으로 다르게
          표현하지 않는다(같은 구획 라벨 위계). */}
      {analysis.explicitRequirements && analysis.explicitRequirements.length > 0 && (
        <div style={card}>
          <h3 style={sectionHeading}>
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
            <h3 style={{ ...sectionHeading, color: "var(--warning-weak-text)" }}>
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
            <h3 style={sectionHeading}>
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--space-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
            <span style={sectionHeading}>구성 페이지</span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "var(--text-muted)",
              }}
            >
              <span style={contentTypeTag}>Aa</span>
              내용 성격
              <span style={layoutPatternTag}>Aa</span>
              표현 방식
            </span>
          </div>
          <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
            제외한 페이지는 이후 AI 참조가 차단됩니다
          </span>
        </div>
        {notice && <p style={{ color: "var(--warning)", fontWeight: 600, fontSize: 14 }}>{notice}</p>}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {analysis.pages.map((p, pageIndex) => {
            return (
              <div
                key={p.pageId}
                style={{
                  // 페이지별 박스 대신 페이지 사이 구분선 — 박스 깊이를 카드 > 섹션
                  // 두 단계로 제한한다. 상태(선택/제외/자동미선택)는 투명도로 표현.
                  ...(pageIndex > 0 ? { borderTop: "1px solid var(--border)" } : {}),
                  opacity: pageOpacity(p),
                  padding: "var(--space-base) 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-sm)",
                }}
              >
                {/* 한 줄 구성 — 좌측: 체크박스+페이지명 / 우측: 역할 뱃지+출처(보조 정보) */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                  <input
                    type="checkbox"
                    checked={p.selected}
                    onChange={(e) => togglePage(p.pageId, e.target.checked)}
                  />
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{p.pageTitle}</span>
                  <span style={{ flex: 1 }} />
                  <span style={pageRoleTag}>{ROLE_LABELS[p.pageRole] ?? p.pageRole}</span>
                  {p.sourceSlides && (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      슬라이드 {p.sourceSlides.join(", ")}
                    </span>
                  )}
                  {p.sourceDocumentId && (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      ID: {p.sourceDocumentId}
                    </span>
                  )}
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

// 태그 공통 — 13px 예외(최소 14px 원칙의 명시적 예외), 타이트한 패딩, radius full.
const tagBase: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  padding: "2px 10px",
  borderRadius: "var(--radius-full)",
};

// 비인터랙티브 칩이므로 진한 primary 채움은 금지(must) — soft/outline 톤만 사용.

// 페이지 유형(pageRole) — primary-soft 배경 + primary 텍스트.
const pageRoleTag: React.CSSProperties = {
  ...tagBase,
  color: "var(--primary-hover)",
  background: "var(--primary-soft)",
};

// 내용 성격·표현 방식 — "문서 명시/확인 필요"형 아웃라인 칩(테두리+컬러 텍스트,
// 배경 투명). 축은 primary(인디고)와 어울리는 보조 2색으로 구분: teal / fuchsia.
const contentTypeTag: React.CSSProperties = {
  ...tagBase,
  color: "var(--chip-teal-text)",
  background: "transparent",
  border: "1px solid var(--chip-teal-border)",
};

const layoutPatternTag: React.CSSProperties = {
  ...tagBase,
  color: "var(--chip-fuchsia-text)",
  background: "transparent",
  border: "1px solid var(--chip-fuchsia-border)",
};

// 분석 요약 메타 그리드 셀 — 타겟/화면유형/산출물형식/AI신뢰도를 같은 라벨 위계로.
const metaCell: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-xs)",
  padding: "var(--space-md) var(--space-base)",
  minWidth: 0,
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
};
