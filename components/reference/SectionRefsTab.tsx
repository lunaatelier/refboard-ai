"use client";

import { useState } from "react";
import type { ProjectAnalysis, ProjectDirective, Section } from "@/lib/analysis/types";
import { buildPlatformQueries } from "@/lib/reference/platforms";
import type { ReferenceResult, SectionReference } from "@/lib/reference/types";

// [섹션별 레퍼런스] 탭 (Step 10-b, flow-spec ④)
// 아코디언: 접힌 상태 기본, 펼친 것만 상세. 플랫폼 칩 = 자동검색(새 탭) / 키워드복사.
// 스크린샷은 쓰지 않는다(링크 방식) — 무료 할당량은 분석 대상 브랜드에 아낀다.

interface SectionRefsTabProps {
  analysis: ProjectAnalysis;
  directives: ProjectDirective[];
  references: ReferenceResult;
  onChange: (next: ReferenceResult) => void;
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

export default function SectionRefsTab({
  analysis,
  directives,
  references,
  onChange,
}: SectionRefsTabProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [openId, setOpenId] = useState<string>();
  const [copied, setCopied] = useState<string>();
  const [layoutCandidates, setLayoutCandidates] = useState<Record<string, string[]>>({});

  const confirmedSections: (Section & { pageTitle: string })[] =
    analysis.pages
      .filter((p) => p.selected)
      .flatMap((p) =>
        p.sections
          .filter((s) => s.status === "confirmed")
          .map((s) => ({ ...s, pageTitle: p.pageTitle })),
      );

  const bySectionId = references.bySectionId ?? {};

  const generate = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/section-queries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          domain: analysis.domain,
          directives,
          sections: confirmedSections.map((s) => ({
            sectionId: s.sectionId,
            sectionTitle: s.sectionTitle,
            contentType: s.contentType,
            recommendedLayout: s.recommendedLayout,
            contentSummary: s.contentSummary,
          })),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.queries)) {
        throw new Error(body?.error ?? "검색어 생성에 실패했습니다.");
      }
      const next: Record<string, SectionReference> = { ...bySectionId };
      const candidates: Record<string, string[]> = {};
      for (const q of body.queries as {
        sectionId: string;
        searchQuery: string;
        layoutCandidates: string[];
      }[]) {
        const section = confirmedSections.find((s) => s.sectionId === q.sectionId);
        if (!section) continue;
        next[q.sectionId] = {
          sectionId: q.sectionId,
          layoutPattern: section.recommendedLayout,
          searchQuery: q.searchQuery,
          platformQueries: buildPlatformQueries(q.searchQuery, analysis.domain),
        };
        candidates[q.sectionId] = [
          ...new Set([section.recommendedLayout, ...q.layoutCandidates]),
        ];
      }
      setLayoutCandidates(candidates);
      onChange({ ...references, bySectionId: next });
      setOpenId(confirmedSections[0]?.sectionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "검색어 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const updateQuery = (sectionId: string, query: string) => {
    const ref = bySectionId[sectionId];
    if (!ref) return;
    onChange({
      ...references,
      bySectionId: {
        ...bySectionId,
        [sectionId]: {
          ...ref,
          searchQuery: query,
          platformQueries: buildPlatformQueries(query, analysis.domain),
        },
      },
    });
  };

  const setLayout = (sectionId: string, layout: string) => {
    const ref = bySectionId[sectionId];
    if (!ref) return;
    onChange({
      ...references,
      bySectionId: {
        ...bySectionId,
        [sectionId]: { ...ref, layoutPattern: layout },
      },
    });
  };

  const copy = async (sectionId: string, platform: string, query: string) => {
    await navigator.clipboard.writeText(query);
    setCopied(`${sectionId}:${platform}`);
    setTimeout(() => setCopied(undefined), 1500);
  };

  if (confirmedSections.length === 0) {
    return (
      <div style={card}>
        <p style={{ color: "var(--text-muted)" }}>
          확정된 섹션이 없습니다. ③ 분석에서 섹션을 확정하세요.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={card}>
        <h3 style={{ fontSize: 15 }}>
          섹션별 레퍼런스{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
            확정 섹션 {confirmedSections.length}개 — 자동 검색 이동 또는 키워드
            복사
          </span>
        </h3>
        {Object.keys(bySectionId).length === 0 && (
          <button
            onClick={generate}
            disabled={busy}
            style={{
              alignSelf: "flex-start",
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: busy ? "var(--locked)" : "var(--primary)",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            {busy ? "검색 키워드 생성 중…" : "섹션별 검색 키워드 생성"}
          </button>
        )}
        {error && (
          <p role="alert" style={{ color: "#dc2626", fontWeight: 600 }}>
            {error}
          </p>
        )}
      </div>

      {confirmedSections.map((s) => {
        const ref = bySectionId[s.sectionId];
        const open = openId === s.sectionId;
        return (
          <div key={s.sectionId} style={{ ...card, padding: 0, overflow: "hidden" }}>
            <button
              onClick={() => setOpenId(open ? undefined : s.sectionId)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 24px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>{open ? "▾" : "▸"}</span>
              {s.sectionTitle}
              <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 14 }}>
                {s.pageTitle} · {s.contentType}
                {ref && ` · ${ref.layoutPattern}`}
              </span>
            </button>
            {open && ref && (
              <div style={{ padding: "0 24px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>표현 방식</span>
                  {(layoutCandidates[s.sectionId] ?? [ref.layoutPattern]).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLayout(s.sectionId, l)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 999,
                        border: `1px solid ${ref.layoutPattern === l ? "var(--primary)" : "var(--border)"}`,
                        background: ref.layoutPattern === l ? "var(--primary-soft)" : "transparent",
                        color: ref.layoutPattern === l ? "var(--primary)" : "var(--text)",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>검색어</span>
                  <input
                    value={ref.searchQuery}
                    onChange={(e) => updateQuery(s.sectionId, e.target.value)}
                    style={{
                      flex: 1,
                      padding: "6px 12px",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      font: "inherit",
                    }}
                  />
                </label>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                  {ref.platformQueries.map((pq) => (
                    <li
                      key={pq.platform}
                      style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
                    >
                      <span style={{ width: 140, fontWeight: 600, fontSize: 14 }}>
                        {pq.platform}
                      </span>
                      <span style={{ color: "var(--text-muted)", fontSize: 14, flex: 1 }}>
                        &ldquo;{pq.query}&rdquo;
                      </span>
                      {pq.mode === "auto-search" && pq.url ? (
                        <a
                          href={pq.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--primary)",
                            textDecoration: "none",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "3px 10px",
                          }}
                        >
                          🔗 바로 검색
                        </a>
                      ) : (
                        <button
                          onClick={() => copy(s.sectionId, pq.platform, pq.query)}
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "3px 10px",
                            background: "transparent",
                            color: "var(--text-muted)",
                          }}
                        >
                          {copied === `${s.sectionId}:${pq.platform}`
                            ? "✓ 복사됨"
                            : "📋 키워드 복사"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {open && !ref && (
              <p style={{ padding: "0 24px 20px", color: "var(--text-muted)" }}>
                먼저 위에서 검색 키워드를 생성하세요.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
