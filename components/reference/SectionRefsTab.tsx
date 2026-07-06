"use client";

import { Check, ChevronDown, ChevronRight, Copy, Info, Link, X } from "lucide-react";
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
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-lg)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-md)",
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-base)" }}>
      <div
        style={{
          ...card,
          padding: "var(--space-base) var(--space-md)",
          background: "var(--info-weak-bg)",
          border: "none",
          flexDirection: "row",
          alignItems: "center",
          gap: "var(--space-md)",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            fontWeight: 600,
            fontSize: 14,
            color: "var(--info)",
          }}
        >
          <Info size={18} color="var(--info)" />
          섹션을 펼쳐서 검색 키워드와 표현 방식을 확인·수정하세요
        </span>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>섹션별 레퍼런스</h3>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          확정 섹션 {confirmedSections.length}개 — 자동 검색 이동 또는 키워드
          복사
        </p>
        {Object.keys(bySectionId).length === 0 && (
          <button
            onClick={generate}
            disabled={busy}
            className="btn-weak-primary"
            style={{
              alignSelf: "flex-start",
              padding: "10px var(--space-lg)",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: busy ? "var(--locked)" : undefined,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {busy ? "검색 키워드 생성 중…" : "섹션별 검색 키워드 생성"}
          </button>
        )}
        {error && (
          <p role="alert" style={{ color: "var(--error-weak-text)", fontWeight: 600, fontSize: 14 }}>
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
              className="btn-tertiary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-sm)",
                width: "100%",
                padding: "var(--space-md) var(--space-lg)",
                border: "none",
                textAlign: "left",
              }}
            >
              <span style={{ display: "flex", color: "var(--text-muted)" }}>
                {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </span>
              <span style={{ fontWeight: 600, fontSize: 16, flex: 1 }}>{s.sectionTitle}</span>
              {ref && (
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--primary-hover)",
                    background: "var(--primary-weak-bg)",
                    borderRadius: "var(--radius-full)",
                    padding: "var(--space-xs) var(--space-md)",
                  }}
                >
                  {ref.layoutPattern}
                </span>
              )}
            </button>
            {open && ref && (
              <div style={{ padding: "0 var(--space-lg) var(--space-lg)", display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                  {s.pageTitle} · {s.contentType}
                </p>
                <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>표현 방식</span>
                  {(layoutCandidates[s.sectionId] ?? [ref.layoutPattern]).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLayout(s.sectionId, l)}
                      style={{
                        padding: "var(--space-xs) var(--space-md)",
                        borderRadius: "var(--radius-full)",
                        border: "none",
                        background: ref.layoutPattern === l ? "var(--primary-weak-bg)" : "var(--surface-alt)",
                        color: ref.layoutPattern === l ? "var(--primary-hover)" : "var(--text-muted)",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>검색어</span>
                  <input
                    value={ref.searchQuery}
                    onChange={(e) => updateQuery(s.sectionId, e.target.value)}
                    className="input-box"
                    style={{
                      flex: 1,
                      padding: "8px var(--space-md)",
                      borderRadius: "var(--radius-md)",
                      font: "inherit",
                      fontSize: 14,
                    }}
                  />
                </label>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                  {ref.platformQueries.map((pq) => (
                    <li
                      key={pq.platform}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "var(--space-sm)",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {pq.platform}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                        <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
                          &ldquo;{pq.query}&rdquo;
                        </span>
                        {pq.mode === "auto-search" && pq.url ? (
                          <a
                            href={pq.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "var(--space-xs)",
                              fontSize: 14,
                              fontWeight: 600,
                              color: "var(--primary)",
                              textDecoration: "none",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-sm)",
                              padding: "3px var(--space-sm)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <Link size={14} color="var(--primary)" />
                            바로 검색
                          </a>
                        ) : (
                          <button
                            onClick={() => copy(s.sectionId, pq.platform, pq.query)}
                            className="btn-tertiary"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "var(--space-xs)",
                              fontSize: 14,
                              fontWeight: 600,
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-sm)",
                              padding: "3px var(--space-sm)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {copied === `${s.sectionId}:${pq.platform}` ? (
                              <>
                                <Check size={14} color="var(--text-muted)" />
                                복사됨
                              </>
                            ) : (
                              <>
                                <Copy size={14} color="var(--text-muted)" />
                                키워드 복사
                              </>
                            )}
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
              <div style={{ padding: "0 var(--space-lg) var(--space-lg)", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                  {s.pageTitle} · {s.contentType}
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
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
        gap: "var(--space-sm)",
        borderTop: "1px solid var(--border)",
        paddingTop: "var(--space-md)",
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600 }}>
        수집한 레퍼런스{" "}
        <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 14 }}>
          — 검색에서 찾은 URL을 붙여 기록. 기본은 참고용이며, 라이선스를
          확인한 것만 &ldquo;삽입 가능&rdquo;으로 바꾸세요
        </span>
      </span>

      {items.length > 0 && (
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {items.map((r, i) => (
            <li
              key={`${r.sourceUrl}-${i}`}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-xs)",
                padding: "var(--space-sm) var(--space-md)",
                background: "var(--bg)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{r.platform}</span>
                <a
                  href={r.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{
                    flex: 1,
                    minWidth: 160,
                    fontSize: 14,
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
                    padding: "var(--space-sm) var(--space-md)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    font: "inherit",
                    fontSize: 14,
                    color: r.usage === "embeddable" ? "var(--success)" : "var(--warning-weak-text)",
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
                  className="btn-danger"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border: "none",
                    padding: "var(--space-xs) var(--space-sm)",
                  }}
                >
                  <X size={14} color="var(--on-primary)" />
                </button>
              </div>
              {r.usage === "embeddable" && (
                <input
                  value={r.licenseNote ?? ""}
                  onChange={(e) => onUpdate(i, { licenseNote: e.target.value })}
                  placeholder="라이선스 근거 메모 (예: CC BY 4.0, 구매 라이선스 보유)"
                  className="input-box"
                  style={{
                    padding: "var(--space-xs) var(--space-sm)",
                    borderRadius: "var(--radius-sm)",
                    font: "inherit",
                    fontSize: 14,
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="레퍼런스 URL 붙여넣기"
          className="input-box"
          style={{
            flex: 2,
            minWidth: 200,
            padding: "var(--space-sm) var(--space-md)",
            borderRadius: "var(--radius-md)",
            font: "inherit",
            fontSize: 14,
          }}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="제목 (선택)"
          className="input-box"
          style={{
            flex: 1,
            minWidth: 120,
            padding: "var(--space-sm) var(--space-md)",
            borderRadius: "var(--radius-md)",
            font: "inherit",
            fontSize: 14,
          }}
        />
        <button
          onClick={handleAdd}
          className="btn-weak-primary"
          style={{
            padding: "var(--space-sm) var(--space-base)",
            borderRadius: "var(--radius-md)",
            border: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          추가
        </button>
      </div>
      {inputError && (
        <p role="alert" style={{ color: "var(--error-weak-text)", fontWeight: 600, fontSize: 14 }}>
          {inputError}
        </p>
      )}
    </div>
  );
}
