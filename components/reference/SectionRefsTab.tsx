"use client";

import { Check, ChevronDown, ChevronRight, Copy, Info, Link, X } from "lucide-react";
import { useRef, useState } from "react";
import type { ProjectAnalysis, ProjectDirective, Section } from "@/lib/analysis/types";
import {
  buildPlatformQueries,
  buildProfiledPlatformQueries,
  platformNameFromUrl,
} from "@/lib/reference/platforms";
import type {
  MoodImage,
  ReferenceItem,
  ReferenceResult,
  ReferenceResultUpdater,
  SectionReference,
} from "@/lib/reference/types";
import { ErrorState } from "../shell/PageLayout";

// [섹션별 레퍼런스] 탭 (Step 10-b, flow-spec ④)
// 아코디언: 접힌 상태 기본, 펼친 것만 상세. 플랫폼 칩 = 자동검색(새 탭) / 키워드복사.
// 스크린샷은 쓰지 않는다(링크 방식) — 무료 할당량은 분석 대상 브랜드에 아낀다.

interface SectionRefsTabProps {
  analysis: ProjectAnalysis;
  directives: ProjectDirective[];
  references: ReferenceResult;
  onChange: (next: ReferenceResultUpdater) => void;
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
  const [imagesBusy, setImagesBusy] = useState<Record<string, boolean>>({});
  const [platformsOpen, setPlatformsOpen] = useState<Record<string, boolean>>({});
  const [copiedMain, setCopiedMain] = useState<string>();
  // 섹션별 이미지 요청 취소 — 같은 섹션에서 검색어를 바꿔 다시 요청하면 이전 요청은
  // 취소한다(§P1 item 8).
  const sectionImagesAbortRef = useRef<Record<string, AbortController>>({});

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
          // 부모-자식 사이트 관계 (실사용#31) — 읽기 전용 근거, AI가 감지했으면 항상 전달
          parentSiteNote: analysis.parentSiteRelation?.relationNote,
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
      // 이번 응답이 실제로 갱신하는 섹션만 담는다 — 나머지 섹션의 최신 상태는
      // onChange에서 prev.bySectionId를 그대로 살려 덮어쓰지 않는다.
      const next: Record<string, SectionReference> = {};
      const candidates: Record<string, string[]> = {};
      for (const q of body.queries as {
        sectionId: string;
        searchQuery: string;
        layoutCandidates: string[];
        queriesByPlatform?: Record<string, string>;
      }[]) {
        const section = confirmedSections.find((s) => s.sectionId === q.sectionId);
        if (!section) continue;
        next[q.sectionId] = {
          sectionId: q.sectionId,
          layoutPattern: section.recommendedLayout,
          searchQuery: q.searchQuery,
          // 플랫폼마다 다른 검색어(Gemini 생성) — 검증 실패 시 플랫폼별 폴백으로 대체됨
          platformQueries: buildProfiledPlatformQueries(
            q.queriesByPlatform ?? {},
            analysis.domain,
            q.searchQuery,
          ),
        };
        candidates[q.sectionId] = [
          ...new Set([section.recommendedLayout, ...q.layoutCandidates]),
        ];
      }
      setLayoutCandidates(candidates);
      onChange((prev) => ({
        ...prev,
        bySectionId: { ...(prev.bySectionId ?? {}), ...next },
      }));
      setOpenId(confirmedSections[0]?.sectionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "검색어 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const updateQuery = (sectionId: string, query: string) =>
    patchRef(sectionId, () => ({
      searchQuery: query,
      platformQueries: buildPlatformQueries(query, analysis.domain),
    }));

  const setLayout = (sectionId: string, layout: string) =>
    patchRef(sectionId, () => ({ layoutPattern: layout }));

  const copy = async (sectionId: string, platform: string, query: string) => {
    await navigator.clipboard.writeText(query);
    setCopied(`${sectionId}:${platform}`);
    setTimeout(() => setCopied(undefined), 1500);
  };

  const copyMain = async (sectionId: string, query: string) => {
    await navigator.clipboard.writeText(query);
    setCopiedMain(sectionId);
    setTimeout(() => setCopiedMain(undefined), 1500);
  };

  // patch를 값 또는 (현재 ref) => 값 형태로 받는다 — 함수형이면 항상 flush 시점의
  // 최신 ref를 기준으로 계산해, await 이후 호출(예: fetchSectionImages)이 그 사이
  // 다른 곳에서 바뀐 값을 덮어쓰지 않게 한다(§2.9/§6.5).
  const patchRef = (
    sectionId: string,
    patch:
      | Partial<SectionReference>
      | ((ref: SectionReference) => Partial<SectionReference>),
  ) =>
    onChange((prev) => {
      const ref = (prev.bySectionId ?? {})[sectionId];
      if (!ref) return prev;
      const resolved = typeof patch === "function" ? patch(ref) : patch;
      return {
        ...prev,
        bySectionId: { ...prev.bySectionId, [sectionId]: { ...ref, ...resolved } },
      };
    });

  // 섹션 전용 레퍼런스 이미지 (Step 10-b 보강) — 전역 무드보드(도메인 기준)와 별개로
  // 이 섹션의 검색어(예: 로고 방향)로 직접 이미지를 가져온다.
  const fetchSectionImages = async (sectionId: string, query: string) => {
    if (!query.trim()) return;
    sectionImagesAbortRef.current[sectionId]?.abort();
    const controller = new AbortController();
    sectionImagesAbortRef.current[sectionId] = controller;
    setImagesBusy((b) => ({ ...b, [sectionId]: true }));
    try {
      const res = await fetch("/api/mood-images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });
      const body = await res.json().catch(() => null);
      patchRef(sectionId, {
        images: Array.isArray(body?.images) ? (body.images as MoodImage[]) : [],
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    } finally {
      if (sectionImagesAbortRef.current[sectionId] === controller) {
        setImagesBusy((b) => ({ ...b, [sectionId]: false }));
      }
    }
  };

  const addReferenceItem = (sectionId: string, item: ReferenceItem) =>
    patchRef(sectionId, (ref) => ({
      references: [...(ref.references ?? []), item],
    }));

  const removeReferenceItem = (sectionId: string, index: number) =>
    patchRef(sectionId, (ref) => ({
      references: (ref.references ?? []).filter((_, i) => i !== index),
    }));

  const updateReferenceItem = (
    sectionId: string,
    index: number,
    patch: Partial<ReferenceItem>,
  ) =>
    patchRef(sectionId, (ref) => ({
      references: (ref.references ?? []).map((r, i) =>
        i === index ? { ...r, ...patch } : r,
      ),
    }));

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
          background: "var(--primary-soft)",
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
            color: "var(--primary-hover)",
          }}
        >
          <Info size={18} color="var(--primary-hover)" />
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
              color: busy ? "var(--on-primary)" : undefined,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {busy ? "검색 키워드 생성 중…" : "섹션별 검색 키워드 생성"}
          </button>
        )}
        {error && (
          <ErrorState
            title="검색 키워드 생성에 실패했어요"
            detail={error}
            onRetry={generate}
          />
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
                  <button
                    onClick={() => copyMain(s.sectionId, ref.searchQuery)}
                    className="btn-tertiary"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-xs)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "6px var(--space-sm)",
                      fontSize: 14,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {copiedMain === s.sectionId ? (
                      <Check size={14} color="var(--text-muted)" />
                    ) : (
                      <Copy size={14} color="var(--text-muted)" />
                    )}
                    {copiedMain === s.sectionId ? "복사됨" : "키워드 복사"}
                  </button>
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                  <button
                    onClick={() => fetchSectionImages(s.sectionId, ref.searchQuery)}
                    disabled={imagesBusy[s.sectionId]}
                    className="btn-weak-primary"
                    style={{
                      alignSelf: "flex-start",
                      padding: "6px 14px",
                      borderRadius: "var(--radius-md)",
                      border: "none",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {imagesBusy[s.sectionId]
                      ? "이미지 불러오는 중…"
                      : ref.images
                        ? "🖼 이미지 다시 불러오기"
                        : "🖼 이 섹션 이미지 미리보기"}
                  </button>
                  {ref.images && (
                    ref.images.length > 0 ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                          gap: "var(--space-sm)",
                        }}
                      >
                        {ref.images.map((img, i) => (
                          <figure key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt={img.attribution}
                              style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: "var(--radius-md)" }}
                            />
                            <figcaption style={{ fontSize: 12, color: "var(--text-muted)" }}>
                              {img.attribution}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                        이 검색어로 이미지를 찾지 못했습니다 (키워드로 플랫폼에서 직접 검색해 보세요).
                      </p>
                    )
                  )}
                </div>
                <div>
                  <button
                    onClick={() =>
                      setPlatformsOpen((o) => ({ ...o, [s.sectionId]: !o[s.sectionId] }))
                    }
                    className="btn-tertiary"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-xs)",
                      border: "none",
                      padding: "4px var(--space-sm)",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {platformsOpen[s.sectionId] ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                    플랫폼별 검색 경로 ({ref.platformQueries.length})
                  </button>
                  {platformsOpen[s.sectionId] && (
                    <ul
                      style={{
                        listStyle: "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-xs)",
                        marginTop: "var(--space-xs)",
                      }}
                    >
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
                                  border: "none",
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
                  )}
                </div>
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
                background: "var(--surface)",
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
                  className="select-box"
                  style={{
                    color: r.usage === "embeddable" ? "var(--success)" : "var(--warning-weak-text)",
                    fontWeight: 600,
                  }}
                >
                  <option value="inspiration-only">참고용</option>
                  <option value="embeddable">삽입 가능</option>
                </select>
                <span
                  title={
                    "참고용: 무드보드 참고 이미지로만 사용, 산출물에 직접 삽입하지 않음\n" +
                    "삽입 가능: 라이선스를 확인했고 산출물에 그대로 삽입 가능"
                  }
                >
                  <Info size={14} color="var(--text-muted)" />
                </span>
                <button
                  onClick={() => onRemove(i)}
                  aria-label="레퍼런스 제외"
                  title="제외"
                  className="btn-icon-neutral"
                  style={{ width: 28, height: 28 }}
                >
                  <X size={14} />
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
