"use client";

import { useState } from "react";
import type { ProjectAnalysis, ProjectDirective, Section } from "@/lib/analysis/types";
import { buildPlatformQueries, platformNameFromUrl } from "@/lib/reference/platforms";
import type {
  ReferenceItem,
  ReferenceResult,
  SectionReference,
} from "@/lib/reference/types";

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
          // 부모-자식 사이트 관계 (실사용#31) — 사용자가 확정한 경우에만 전달
          parentSiteNote: analysis.parentSiteRelation?.confirmed
            ? analysis.parentSiteRelation.relationNote
            : undefined,
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

  const patchRef = (sectionId: string, patch: Partial<SectionReference>) => {
    const ref = bySectionId[sectionId];
    if (!ref) return;
    onChange({
      ...references,
      bySectionId: { ...bySectionId, [sectionId]: { ...ref, ...patch } },
    });
  };

  const addReferenceItem = (sectionId: string, item: ReferenceItem) =>
    patchRef(sectionId, {
      references: [...(bySectionId[sectionId]?.references ?? []), item],
    });

  const removeReferenceItem = (sectionId: string, index: number) =>
    patchRef(sectionId, {
      references: (bySectionId[sectionId]?.references ?? []).filter(
        (_, i) => i !== index,
      ),
    });

  const updateReferenceItem = (
    sectionId: string,
    index: number,
    patch: Partial<ReferenceItem>,
  ) =>
    patchRef(sectionId, {
      references: (bySectionId[sectionId]?.references ?? []).map((r, i) =>
        i === index ? { ...r, ...patch } : r,
      ),
    });

  if (confirmedSections.length === 0) {
    return (
      <div style={card}>
        <p style={{ color: "var(--text-muted)" }}>
          확정된 섹션이 없습니다. 분석 결과에서 섹션을 확정하세요.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          ...card,
          padding: "16px 20px",
          background: "var(--primary-soft)",
          border: "1px solid var(--primary)",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--primary)" }}>
          👉 섹션을 펼쳐서 검색 키워드와 표현 방식을 확인·수정하세요
        </span>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 18, fontWeight: 800 }}>섹션별 레퍼런스</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          확정 섹션 {confirmedSections.length}개 — 자동 검색 이동 또는 키워드
          복사
        </p>
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
                width: "100%",
                padding: "14px 24px",
                border: "none",
                background: "transparent",
                textAlign: "left",
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>{open ? "▾" : "▸"}</span>
              <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{s.sectionTitle}</span>
              {ref && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--primary)",
                    background: "var(--primary-soft)",
                    borderRadius: 999,
                    padding: "2px 10px",
                  }}
                >
                  {ref.layoutPattern}
                </span>
              )}
            </button>
            {open && ref && (
              <div style={{ padding: "0 24px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {s.pageTitle} · {s.contentType}
                </p>
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
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {pq.platform}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
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
                              whiteSpace: "nowrap",
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
                              whiteSpace: "nowrap",
                            }}
                          >
                            {copied === `${s.sectionId}:${pq.platform}`
                              ? "✓ 복사됨"
                              : "📋 키워드 복사"}
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <CollectedReferences
                  items={ref.references ?? []}
                  onAdd={(item) => addReferenceItem(s.sectionId, item)}
                  onRemove={(i) => removeReferenceItem(s.sectionId, i)}
                  onUpdate={(i, patch) =>
                    updateReferenceItem(s.sectionId, i, patch)
                  }
                />
              </div>
            )}
            {open && !ref && (
              <div style={{ padding: "0 24px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {s.pageTitle} · {s.contentType}
                </p>
                <p style={{ color: "var(--text-muted)" }}>
                  먼저 위에서 검색 키워드를 생성하세요.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 수집한 레퍼런스 (Step 10-b, data-model §5 ReferenceItem)
// 플랫폼 검색에서 찾은 URL을 직접 붙여 수집. 기본 usage = 참고용(안전).
// "삽입 가능"은 라이선스를 확인한 경우에만 사용자가 명시적으로 바꾼다.
function CollectedReferences({
  items,
  onAdd,
  onRemove,
  onUpdate,
}: {
  items: ReferenceItem[];
  onAdd: (item: ReferenceItem) => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<ReferenceItem>) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [inputError, setInputError] = useState<string>();

  const handleAdd = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const platform = platformNameFromUrl(trimmed);
    if (!platform) {
      setInputError("올바른 URL이 아닙니다 (https://... 형태로 붙여넣어 주세요).");
      return;
    }
    setInputError(undefined);
    onAdd({
      platform,
      sourceUrl: trimmed,
      usage: "inspiration-only",
      ...(title.trim() ? { title: title.trim() } : {}),
    });
    setUrl("");
    setTitle("");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderTop: "1px solid var(--border)",
        paddingTop: 12,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600 }}>
        수집한 레퍼런스{" "}
        <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 13 }}>
          — 검색에서 찾은 URL을 붙여 기록. 기본은 참고용이며, 라이선스를
          확인한 것만 &ldquo;삽입 가능&rdquo;으로 바꾸세요
        </span>
      </span>

      {items.length > 0 && (
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((r, i) => (
            <li
              key={`${r.sourceUrl}-${i}`}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "8px 12px",
                background: "var(--bg)",
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{r.platform}</span>
                <a
                  href={r.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{
                    flex: 1,
                    minWidth: 160,
                    fontSize: 13,
                    color: "var(--primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.title || r.sourceUrl}
                </a>
                <select
                  value={r.usage}
                  onChange={(e) =>
                    onUpdate(i, {
                      usage: e.target.value as ReferenceItem["usage"],
                    })
                  }
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    font: "inherit",
                    fontSize: 13,
                    color: r.usage === "embeddable" ? "#16a34a" : "#b45309",
                    fontWeight: 600,
                  }}
                >
                  <option value="inspiration-only">참고용 (기본)</option>
                  <option value="embeddable">삽입 가능 — 라이선스 확인함</option>
                </select>
                <button
                  onClick={() => onRemove(i)}
                  aria-label="레퍼런스 삭제"
                  title="삭제"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--text-muted)",
                    fontSize: 13,
                    padding: "2px 6px",
                  }}
                >
                  ✕
                </button>
              </div>
              {r.usage === "embeddable" && (
                <input
                  value={r.licenseNote ?? ""}
                  onChange={(e) => onUpdate(i, { licenseNote: e.target.value })}
                  placeholder="라이선스 근거 메모 (예: CC BY 4.0, 구매 라이선스 보유)"
                  style={{
                    padding: "6px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    font: "inherit",
                    fontSize: 13,
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="레퍼런스 URL 붙여넣기"
          style={{
            flex: 2,
            minWidth: 200,
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            font: "inherit",
            fontSize: 13,
          }}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="제목 (선택)"
          style={{
            flex: 1,
            minWidth: 120,
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            font: "inherit",
            fontSize: 13,
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "transparent",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          추가
        </button>
      </div>
      {inputError && (
        <p role="alert" style={{ color: "#dc2626", fontWeight: 600, fontSize: 13 }}>
          {inputError}
        </p>
      )}
    </div>
  );
}
