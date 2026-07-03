"use client";

import { useState } from "react";
import { MAX_SELECTED_PAGES } from "@/lib/analysis/normalize";
import type {
  DomainHint,
  ExclusionReason,
  ProjectAnalysis,
} from "@/lib/analysis/types";

// ③ 분석 결과 (Step 7) — 자동 도출하되 셀렉트/편집으로 수정 가능 (UI 원칙).
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

const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  sensitive: "민감 정보",
  "out-of-scope": "범위 밖",
  "low-priority": "낮은 우선순위",
  duplicate: "중복",
  "quality-issue": "품질 문제",
  "user-choice": "직접 제외",
  other: "기타",
};

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

export default function AnalysisResult({
  analysis,
  onChange,
  onConfirm,
}: AnalysisResultProps) {
  const [notice, setNotice] = useState<string>();
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>
      <div style={card}>
        <h2>③ 분석 결과</h2>
        <p style={{ color: "var(--text-muted)" }}>
          AI 분석은 초안입니다 — 도메인·페이지·섹션을 확인하고 수정한 뒤
          확정하세요.
        </p>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontWeight: 600 }}>프로젝트명</span>
          <input
            value={analysis.title}
            onChange={(e) => onChange({ ...analysis, title: e.target.value })}
            style={inputStyle}
          />
        </label>
        <p style={{ color: "var(--text-muted)" }}>{analysis.description}</p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>도메인</span>
            <select
              value={analysis.domain}
              onChange={(e) =>
                onChange({ ...analysis, domain: e.target.value as DomainHint })
              }
              style={inputStyle}
            >
              {(Object.keys(DOMAIN_LABELS) as DomainHint[]).map((d) => (
                <option key={d} value={d}>
                  {DOMAIN_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <span
            style={{
              color:
                analysis.domainConfidence < 0.7 ? "#b45309" : "var(--text-muted)",
            }}
          >
            신뢰도 {(analysis.domainConfidence * 100).toFixed(0)}%
            {analysis.domainConfidence < 0.7 && " — 낮음, 직접 확인 필요"}
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>종류</span>
            <input
              value={analysis.projectType}
              onChange={(e) =>
                onChange({ ...analysis, projectType: e.target.value })
              }
              style={{ ...inputStyle, width: 160 }}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {analysis.tags.map((t) => (
            <span
              key={t}
              style={{
                background: "var(--primary-soft)",
                color: "var(--primary)",
                borderRadius: 999,
                padding: "2px 12px",
                fontWeight: 600,
              }}
            >
              #{t}
            </span>
          ))}
        </div>
        {analysis.brandColors && analysis.brandColors.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontWeight: 600 }}>브랜드 컬러</span>
            {analysis.brandColors.map((c) => (
              <span
                key={c}
                title={c}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: c,
                  border: "1px solid var(--border)",
                }}
              />
            ))}
          </div>
        )}
        <p style={{ color: "var(--text-muted)" }}>
          타겟: {analysis.targetUser || "—"}
        </p>
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
              컨셉 3안 생성 시(⑤) 이 변형들을 기반으로 만들지 물어봅니다 —
              AI가 처음부터 새로 만들지 않습니다.
            </p>
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
              ④ 분석 대상 브랜드 목록에 &ldquo;이미 분석됨&rdquo;으로 선반영됩니다
              (처음부터 재조사하지 않음).
            </p>
          </div>
        )}

      <div style={card}>
        <h3 style={{ fontSize: 15 }}>
          구성 페이지{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
            {selectedCount}/{MAX_SELECTED_PAGES}개 선택 — 제외한 페이지는 이후
            AI 참조가 차단됩니다
          </span>
        </h3>
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
                gap: 8,
                opacity: p.selected ? 1 : 0.6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={p.selected}
                    onChange={(e) => togglePage(p.pageId, e.target.checked)}
                  />
                  {p.pageTitle}
                </label>
                <span style={pill}>{ROLE_LABELS[p.pageRole] ?? p.pageRole}</span>
                {p.sourceSlides && (
                  <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
                    슬라이드 {p.sourceSlides.join(", ")}
                  </span>
                )}
                {p.sourceDocumentId && (
                  <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
                    ID: {p.sourceDocumentId}
                  </span>
                )}
                {!p.selected && (
                  <select
                    value={p.excludedReason ?? "user-choice"}
                    onChange={(e) =>
                      patchPage(p.pageId, {
                        excludedReason: e.target.value as ExclusionReason,
                      })
                    }
                    style={{ ...inputStyle, fontSize: 14 }}
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
              {p.selected && (
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                  {p.sections.map((s) => (
                    <li
                      key={s.sectionId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        padding: "6px 10px",
                        background: "var(--bg)",
                        borderRadius: 8,
                      }}
                    >
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
                      <span style={{ flex: 1, color: "var(--text-muted)", fontSize: 14 }}>
                        {s.contentSummary}
                      </span>
                      {s.unresolvedNotes && s.unresolvedNotes.length > 0 && (
                        <span style={{ ...pill, background: "#fef3c7", color: "#b45309" }}>
                          미결 {s.unresolvedNotes.length}
                        </span>
                      )}
                      <button
                        onClick={() => deleteSection(p.pageId, s.sectionId)}
                        style={{
                          border: "1px solid var(--border)",
                          background: "transparent",
                          borderRadius: 6,
                          padding: "2px 8px",
                          color: "var(--text-muted)",
                        }}
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
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
          padding: "12px 24px",
          borderRadius: 10,
          border: "none",
          background: selectedCount === 0 ? "var(--locked)" : "var(--primary)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        분석 확정 — 섹션을 확정하고 ④ 레퍼런스로
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

const pill: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--primary)",
  background: "var(--primary-soft)",
  borderRadius: 6,
  padding: "1px 8px",
};
