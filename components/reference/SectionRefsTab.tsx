"use client";

import { Check, ChevronDown, ChevronRight, Copy, Info, Link, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Page, ProjectAnalysis, ProjectDirective, Section } from "@/lib/analysis/types";
import {
  buildPlatformQueries,
  buildProfiledPlatformQueries,
  platformNameFromUrl,
} from "@/lib/reference/platforms";
import { resolvePageBoardSummary } from "@/lib/reference/pageBoard";
import {
  buildImageQueryCacheKey,
  buildSectionQueriesCacheKey,
  SessionRequestCache,
} from "@/lib/reference/requestCache";
import { seedSectionPriorities, sectionKey } from "@/lib/reference/sectionPriority";
import { buildSectionQuerySet, type SectionQueryAxis } from "@/lib/reference/sectionQuery";
import type {
  MoodImage,
  ReferenceItem,
  ReferenceResult,
  ReferenceResultUpdater,
  SectionReference,
  SectionReferencePriority,
} from "@/lib/reference/types";
import { hashValue } from "@/lib/state/hash";
import { ErrorState } from "../shell/PageLayout";

// [섹션별 레퍼런스] 탭 — 페이지별 3-column 보드 (P5-3, 개선 지시서 P5 items 1-7).
// 왼쪽 페이지 내비게이션 / 중앙 선택 페이지+섹션 우선순위 / 오른쪽 결정 패널.
// 여기서 P4(로컬 3축 검색어, UI 용어 없는 사진 검색어, provider 세션 캐시)와
// P5-1/P5-2(페이지 보드 요약, 섹션 우선순위)의 데이터 계약이 처음으로 화면에 연결된다.
// 적용/참고만/제외 채택 액션 자체(P5 items 8-13)는 P5-4에서 CollectedReference와
// 함께 구현한다 — 이 탭은 아직 기존 ReferenceItem URL 수집만 다룬다.

const PROMPT_VERSION = "v1";

const PRIORITY_LABEL: Record<SectionReferencePriority, string> = {
  "high-impact": "고영향",
  inherited: "상속",
  optional: "선택",
};

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

const column: React.CSSProperties = {
  ...card,
  minWidth: 0,
  height: "100%",
  overflowY: "auto",
};

export default function SectionRefsTab({
  analysis,
  directives,
  references,
  onChange,
}: SectionRefsTabProps) {
  const selectedPages = analysis.pages.filter((p) => p.selected);

  const [focusedPageId, setFocusedPageId] = useState<string | undefined>(
    selectedPages[0]?.pageId,
  );
  const [focusedSectionId, setFocusedSectionId] = useState<string | undefined>();
  const [selectedAxisBySection, setSelectedAxisBySection] = useState<
    Record<string, SectionQueryAxis>
  >({});
  const [morePlatformsOpen, setMorePlatformsOpen] = useState<Record<string, boolean>>({});
  const [imagesBusy, setImagesBusy] = useState<Record<string, boolean>>({});
  const [refineBusyPageId, setRefineBusyPageId] = useState<string>();
  const [refineError, setRefineError] = useState<string>();
  const [copied, setCopied] = useState<string>();
  const [copiedMain, setCopiedMain] = useState<string>();

  const imageCacheRef = useRef(new SessionRequestCache<MoodImage[]>());
  const sectionQueriesCacheRef = useRef(
    new SessionRequestCache<
      { sectionId: string; searchQuery: string; queriesByPlatform?: Record<string, string> }[]
    >(),
  );

  const focusedPage = selectedPages.find((p) => p.pageId === focusedPageId);
  const bySectionId = references.bySectionId ?? {};

  const priorityOf = (page: Page, section: Section): SectionReferencePriority =>
    references.sectionDecisionsByKey?.[sectionKey(page.pageId, section.sectionId)]?.priority ??
    "inherited";

  // 페이지를 처음 열 때 로컬 규칙(§P5-2)으로 우선순위를 채운다 — 이미 사용자가
  // 정한 결정은 seedSectionPriorities가 절대 덮어쓰지 않는다(멱등).
  useEffect(() => {
    const page = selectedPages.find((p) => p.pageId === focusedPageId);
    if (!page) return;
    onChange((prev) => ({
      ...prev,
      sectionDecisionsByKey: seedSectionPriorities(page, prev.sectionDecisionsByKey ?? {}),
    }));
    const confirmed = page.sections.filter((s) => s.status === "confirmed");
    const seeded = seedSectionPriorities(page, references.sectionDecisionsByKey ?? {});
    const firstHighImpact = confirmed.find(
      (s) => seeded[sectionKey(page.pageId, s.sectionId)]?.priority === "high-impact",
    );
    setFocusedSectionId((firstHighImpact ?? confirmed[0])?.sectionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedPageId]);

  const setPriority = (page: Page, section: Section, priority: SectionReferencePriority) =>
    onChange((prev) => ({
      ...prev,
      sectionDecisionsByKey: {
        ...(prev.sectionDecisionsByKey ?? {}),
        [sectionKey(page.pageId, section.sectionId)]: { priority, source: "user" },
      },
    }));

  const selectedDirection = references.directionOptions?.find(
    (d) => d.directionId === references.selectedDirectionId,
  );

  const querySetFor = (section: Section) =>
    buildSectionQuerySet(section, analysis, selectedDirection);

  const activeIntentFor = (section: Section) => {
    const set = querySetFor(section);
    const axis = selectedAxisBySection[section.sectionId];
    return set.designIntents.find((i) => i.axis === axis) ?? set.designIntents[0];
  };

  // patch를 값 또는 (현재 ref) => 값 형태로 받는다 — 아직 아무 조작도 없었던
  // 섹션은 현재 선택된 축의 로컬 검색어로 기본값을 만들어 이어붙인다(§2.9/§6.5,
  // await 이후에도 flush 시점의 최신 상태를 기준으로 계산).
  const patchRef = (
    section: Section,
    patch:
      | Partial<SectionReference>
      | ((ref: SectionReference) => Partial<SectionReference>),
  ) =>
    onChange((prev) => {
      const intent = activeIntentFor(section);
      const base: SectionReference = (prev.bySectionId ?? {})[section.sectionId] ?? {
        sectionId: section.sectionId,
        layoutPattern: section.recommendedLayout,
        searchQuery: intent?.query ?? "",
        platformQueries: intent ? buildPlatformQueries(intent.query, analysis.domain) : [],
      };
      const resolved = typeof patch === "function" ? patch(base) : patch;
      return {
        ...prev,
        bySectionId: {
          ...(prev.bySectionId ?? {}),
          [section.sectionId]: { ...base, ...resolved },
        },
      };
    });

  const updateQuery = (section: Section, query: string) =>
    patchRef(section, { searchQuery: query, platformQueries: buildPlatformQueries(query, analysis.domain) });

  const setLayout = (section: Section, layout: string) =>
    patchRef(section, { layoutPattern: layout });

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

  // 이 섹션의 로컬 이미지 검색어(§P4, UI 용어 제거됨)로 사진을 가져온다. 같은
  // 검색어는 SessionRequestCache가 세션 안에서 provider를 한 번만 호출하게 한다.
  const fetchSectionImages = async (section: Section, query: string) => {
    if (!query.trim()) return;
    setImagesBusy((b) => ({ ...b, [section.sectionId]: true }));
    try {
      const key = buildImageQueryCacheKey({ query });
      const images = await imageCacheRef.current.get(key, async () => {
        const res = await fetch("/api/mood-images", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const body = await res.json().catch(() => null);
        return Array.isArray(body?.images) ? (body.images as MoodImage[]) : [];
      });
      patchRef(section, { images });
    } finally {
      setImagesBusy((b) => ({ ...b, [section.sectionId]: false }));
    }
  };

  // 고영향 섹션 전체를 한 번에 배치로 Gemini에 보내 플랫폼별 표현을 다듬는다
  // (개선 지시서 P4) — 로컬 축 검색어를 대체하는 게 아니라 그 위에 얹는 선택
  // 단계. 같은 방향(directionHash)+섹션 목록이면 세션 안에서 재호출하지 않는다.
  const refinePage = async (page: Page) => {
    const confirmed = page.sections.filter((s) => s.status === "confirmed");
    const highImpact = confirmed.filter((s) => priorityOf(page, s) === "high-impact");
    if (highImpact.length === 0) return;
    setRefineBusyPageId(page.pageId);
    setRefineError(undefined);
    try {
      const key = buildSectionQueriesCacheKey({
        directionHash: selectedDirection ? hashValue(selectedDirection) : undefined,
        sectionIds: highImpact.map((s) => s.sectionId),
        promptVersion: PROMPT_VERSION,
      });
      const queries = await sectionQueriesCacheRef.current.get(key, async () => {
        const res = await fetch("/api/section-queries", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            domain: analysis.domain,
            directives,
            parentSiteNote: analysis.parentSiteRelation?.relationNote,
            sections: highImpact.map((s) => ({
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
          throw new Error(body?.error ?? "검색어 다듬기에 실패했습니다.");
        }
        return body.queries;
      });
      const next: Record<string, SectionReference> = {};
      for (const q of queries) {
        const section = highImpact.find((s) => s.sectionId === q.sectionId);
        if (!section) continue;
        next[q.sectionId] = {
          sectionId: q.sectionId,
          layoutPattern: section.recommendedLayout,
          searchQuery: q.searchQuery,
          platformQueries: buildProfiledPlatformQueries(
            q.queriesByPlatform ?? {},
            analysis.domain,
            q.searchQuery,
          ),
        };
      }
      onChange((prev) => ({ ...prev, bySectionId: { ...(prev.bySectionId ?? {}), ...next } }));
    } catch (e) {
      setRefineError(e instanceof Error ? e.message : "검색어 다듬기에 실패했습니다.");
    } finally {
      setRefineBusyPageId(undefined);
    }
  };

  const addReferenceItem = (section: Section, item: ReferenceItem) =>
    patchRef(section, (ref) => ({ references: [...(ref.references ?? []), item] }));

  const removeReferenceItem = (section: Section, index: number) =>
    patchRef(section, (ref) => ({
      references: (ref.references ?? []).filter((_, i) => i !== index),
    }));

  const updateReferenceItem = (
    section: Section,
    index: number,
    patch: Partial<ReferenceItem>,
  ) =>
    patchRef(section, (ref) => ({
      references: (ref.references ?? []).map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }));

  const totalConfirmed = selectedPages.reduce(
    (n, p) => n + p.sections.filter((s) => s.status === "confirmed").length,
    0,
  );

  if (totalConfirmed === 0) {
    return (
      <div style={card}>
        <p style={{ color: "var(--text-muted)" }}>
          확정된 섹션이 없습니다. 분석 결과에서 섹션을 확정하세요.
        </p>
      </div>
    );
  }

  const focusedSection = focusedPage?.sections.find(
    (s) => s.sectionId === focusedSectionId && s.status === "confirmed",
  );
  const pageSummary = focusedPage
    ? resolvePageBoardSummary(focusedPage, analysis, references.pageMetaById?.[focusedPage.pageId])
    : undefined;
  const highImpactCount = focusedPage
    ? focusedPage.sections.filter(
        (s) => s.status === "confirmed" && priorityOf(focusedPage, s) === "high-impact",
      ).length
    : 0;

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
          페이지를 선택하고, 고영향 섹션 위주로 레퍼런스를 정리하세요
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px minmax(280px, 1fr) minmax(320px, 1.2fr)",
          gap: "var(--space-md)",
          overflowX: "auto",
        }}
      >
        {/* 왼쪽: 페이지 내비게이션 */}
        <div style={{ ...column, padding: "var(--space-md)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)" }}>페이지</h3>
          {selectedPages.map((p) => {
            const confirmedCount = p.sections.filter((s) => s.status === "confirmed").length;
            const active = p.pageId === focusedPageId;
            return (
              <button
                key={p.pageId}
                onClick={() => setFocusedPageId(p.pageId)}
                className="btn-tertiary"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 2,
                  width: "100%",
                  padding: "var(--space-sm) var(--space-md)",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  textAlign: "left",
                  background: active ? "var(--primary-weak-bg)" : "transparent",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: active ? "var(--primary-hover)" : "var(--foreground)",
                  }}
                >
                  {p.pageTitle}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  확정 섹션 {confirmedCount}개
                </span>
              </button>
            );
          })}
        </div>

        {/* 중앙: 선택 페이지 집중 + 섹션 우선순위 */}
        <div style={{ ...column, padding: "var(--space-md)" }}>
          {focusedPage && pageSummary && (
            <>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{focusedPage.pageTitle}</h3>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {pageSummary.purposeSummary} · {pageSummary.audienceSummary}
                </p>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                확정 섹션 {pageSummary.confirmedSectionCount}개 — {pageSummary.contentSummary}
              </p>
              <button
                onClick={() => refinePage(focusedPage)}
                disabled={highImpactCount === 0 || refineBusyPageId === focusedPage.pageId}
                className="btn-weak-primary"
                style={{
                  alignSelf: "flex-start",
                  padding: "6px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {refineBusyPageId === focusedPage.pageId
                  ? "AI로 다듬는 중…"
                  : `고영향 섹션 검색어 AI로 다듬기 (${highImpactCount}개)`}
              </button>
              {refineError && (
                <ErrorState
                  title="검색어 다듬기에 실패했어요"
                  detail={refineError}
                  onRetry={() => refinePage(focusedPage)}
                />
              )}

              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                {focusedPage.sections
                  .filter((s) => s.status === "confirmed")
                  .map((s) => {
                    const priority = priorityOf(focusedPage, s);
                    const active = s.sectionId === focusedSectionId;
                    return (
                      <li
                        key={s.sectionId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-sm)",
                          padding: "var(--space-xs) var(--space-sm)",
                          borderRadius: "var(--radius-md)",
                          background: active ? "var(--primary-weak-bg)" : "var(--surface-alt)",
                        }}
                      >
                        <button
                          onClick={() => setFocusedSectionId(s.sectionId)}
                          className="btn-tertiary"
                          style={{
                            flex: 1,
                            textAlign: "left",
                            border: "none",
                            padding: 0,
                            fontWeight: 600,
                            fontSize: 14,
                            color: active ? "var(--primary-hover)" : "var(--foreground)",
                          }}
                        >
                          {s.sectionTitle}
                        </button>
                        <select
                          value={priority}
                          onChange={(e) =>
                            setPriority(focusedPage, s, e.target.value as SectionReferencePriority)
                          }
                          className="select-box"
                          style={{ fontSize: 12, fontWeight: 600 }}
                        >
                          <option value="high-impact">고영향</option>
                          <option value="inherited">상속</option>
                          <option value="optional">선택</option>
                        </select>
                      </li>
                    );
                  })}
              </ul>
            </>
          )}
        </div>

        {/* 오른쪽: 선택 섹션 결정 패널 */}
        <div style={{ ...column, padding: "var(--space-md)" }}>
          {focusedPage && focusedSection ? (
            <SectionDecisionPanel
              page={focusedPage}
              section={focusedSection}
              priority={priorityOf(focusedPage, focusedSection)}
              onPromote={() => setPriority(focusedPage, focusedSection, "high-impact")}
              domain={analysis.domain}
              intent={activeIntentFor(focusedSection)}
              querySet={querySetFor(focusedSection)}
              selectedAxis={
                selectedAxisBySection[focusedSection.sectionId] ??
                querySetFor(focusedSection).designIntents[0]?.axis
              }
              onSelectAxis={(axis) =>
                setSelectedAxisBySection((m) => ({ ...m, [focusedSection.sectionId]: axis }))
              }
              sectionRef={bySectionId[focusedSection.sectionId]}
              morePlatformsOpen={Boolean(morePlatformsOpen[focusedSection.sectionId])}
              onToggleMorePlatforms={() =>
                setMorePlatformsOpen((o) => ({
                  ...o,
                  [focusedSection.sectionId]: !o[focusedSection.sectionId],
                }))
              }
              imagesBusy={Boolean(imagesBusy[focusedSection.sectionId])}
              copied={copied}
              copiedMain={copiedMain}
              onCopy={copy}
              onCopyMain={copyMain}
              onUpdateQuery={(q) => updateQuery(focusedSection, q)}
              onSetLayout={(l) => setLayout(focusedSection, l)}
              onFetchImages={(q) => fetchSectionImages(focusedSection, q)}
              onAddReferenceItem={(item) => addReferenceItem(focusedSection, item)}
              onRemoveReferenceItem={(i) => removeReferenceItem(focusedSection, i)}
              onUpdateReferenceItem={(i, patch) => updateReferenceItem(focusedSection, i, patch)}
            />
          ) : (
            <p style={{ color: "var(--text-muted)" }}>왼쪽에서 섹션을 선택하세요.</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface SectionDecisionPanelProps {
  page: Page;
  section: Section;
  priority: SectionReferencePriority;
  onPromote: () => void;
  domain: ProjectAnalysis["domain"];
  intent: ReturnType<typeof buildSectionQuerySet>["designIntents"][number] | undefined;
  querySet: ReturnType<typeof buildSectionQuerySet>;
  selectedAxis: SectionQueryAxis | undefined;
  onSelectAxis: (axis: SectionQueryAxis) => void;
  sectionRef: SectionReference | undefined;
  morePlatformsOpen: boolean;
  onToggleMorePlatforms: () => void;
  imagesBusy: boolean;
  copied: string | undefined;
  copiedMain: string | undefined;
  onCopy: (sectionId: string, platform: string, query: string) => void;
  onCopyMain: (sectionId: string, query: string) => void;
  onUpdateQuery: (query: string) => void;
  onSetLayout: (layout: string) => void;
  onFetchImages: (query: string) => void;
  onAddReferenceItem: (item: ReferenceItem) => void;
  onRemoveReferenceItem: (index: number) => void;
  onUpdateReferenceItem: (index: number, patch: Partial<ReferenceItem>) => void;
}

// 섹션 결정 패널 — 고영향이 아니면 상속 안내+승격 버튼만 보여준다(개선 지시서
// P5 item 7: "고영향 섹션에서만 심층 탐색 CTA를 기본 노출").
function SectionDecisionPanel({
  page,
  section,
  priority,
  onPromote,
  domain,
  intent,
  querySet,
  selectedAxis,
  onSelectAxis,
  sectionRef,
  morePlatformsOpen,
  onToggleMorePlatforms,
  imagesBusy,
  copied,
  copiedMain,
  onCopy,
  onCopyMain,
  onUpdateQuery,
  onSetLayout,
  onFetchImages,
  onAddReferenceItem,
  onRemoveReferenceItem,
  onUpdateReferenceItem,
}: SectionDecisionPanelProps) {
  if (priority !== "high-impact") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{section.sectionTitle}</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{page.pageTitle}</p>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          {PRIORITY_LABEL[priority]}: 글로벌 방향과 기본 레이아웃(
          <strong>{section.recommendedLayoutLabel || section.recommendedLayout}</strong>)을
          자동 적용합니다. 필요하면 심층 탐색으로 전환하세요.
        </p>
        <button
          onClick={onPromote}
          className="btn-weak-primary"
          style={{
            alignSelf: "flex-start",
            padding: "6px 14px",
            borderRadius: "var(--radius-md)",
            border: "none",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          심층 탐색 시작 (고영향으로 전환)
        </button>
      </div>
    );
  }

  const searchQuery = sectionRef?.searchQuery ?? intent?.query ?? "";
  const platformQueries =
    sectionRef?.platformQueries ?? (intent ? buildPlatformQueries(intent.query, domain) : []);
  const topPlatforms = platformQueries.slice(0, 5);
  const morePlatforms = platformQueries.slice(5);
  const imageQuery = querySet.imageQueries[0] ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{section.sectionTitle}</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {page.pageTitle} · {section.contentType}
        </p>
      </div>

      <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
        {querySet.designIntents.map((i) => (
          <button
            key={i.axis}
            onClick={() => onSelectAxis(i.axis)}
            style={{
              padding: "var(--space-xs) var(--space-md)",
              borderRadius: "var(--radius-full)",
              border: "none",
              background: selectedAxis === i.axis ? "var(--primary-weak-bg)" : "var(--surface-alt)",
              color: selectedAxis === i.axis ? "var(--primary-hover)" : "var(--text-muted)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {i.label}
          </button>
        ))}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>검색어</span>
        <input
          value={searchQuery}
          onChange={(e) => onUpdateQuery(e.target.value)}
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
          onClick={() => onCopyMain(section.sectionId, searchQuery)}
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
          {copiedMain === section.sectionId ? (
            <Check size={14} color="var(--text-muted)" />
          ) : (
            <Copy size={14} color="var(--text-muted)" />
          )}
          {copiedMain === section.sectionId ? "복사됨" : "키워드 복사"}
        </button>
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>표현 방식</span>
        <input
          value={sectionRef?.layoutPattern ?? section.recommendedLayout}
          onChange={(e) => onSetLayout(e.target.value)}
          className="input-box"
          style={{
            flex: 1,
            padding: "6px var(--space-md)",
            borderRadius: "var(--radius-md)",
            font: "inherit",
            fontSize: 14,
          }}
        />
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        <button
          onClick={() => onFetchImages(imageQuery)}
          disabled={imagesBusy || !imageQuery}
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
          {imagesBusy
            ? "이미지 불러오는 중…"
            : sectionRef?.images
              ? "🖼 이미지 다시 불러오기"
              : "🖼 이 섹션 이미지 미리보기"}
        </button>
        {sectionRef?.images && (
          sectionRef.images.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                gap: "var(--space-sm)",
              }}
            >
              {sectionRef.images.map((img, i) => (
                <figure key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.attribution}
                    style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: "var(--radius-md)" }}
                  />
                  <figcaption style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {img.attribution}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              이 검색어로 이미지를 찾지 못했습니다.
            </p>
          )
        )}
      </div>

      <div>
        <span style={{ fontSize: 14, fontWeight: 600 }}>플랫폼별 검색 경로</span>
        <ul
          style={{
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-xs)",
            marginTop: "var(--space-xs)",
          }}
        >
          {topPlatforms.map((pq) => (
            <PlatformRow
              key={pq.platform}
              sectionId={section.sectionId}
              pq={pq}
              copied={copied}
              onCopy={onCopy}
            />
          ))}
        </ul>
        {morePlatforms.length > 0 && (
          <>
            <button
              onClick={onToggleMorePlatforms}
              className="btn-tertiary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-xs)",
                border: "none",
                padding: "4px var(--space-sm)",
                fontSize: 13,
                fontWeight: 600,
                marginTop: "var(--space-xs)",
              }}
            >
              {morePlatformsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              더 보기 ({morePlatforms.length})
            </button>
            {morePlatformsOpen && (
              <ul
                style={{
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-xs)",
                  marginTop: "var(--space-xs)",
                }}
              >
                {morePlatforms.map((pq) => (
                  <PlatformRow
                    key={pq.platform}
                    sectionId={section.sectionId}
                    pq={pq}
                    copied={copied}
                    onCopy={onCopy}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <CollectedReferences
        items={sectionRef?.references ?? []}
        onAdd={onAddReferenceItem}
        onRemove={onRemoveReferenceItem}
        onUpdate={onUpdateReferenceItem}
      />
    </div>
  );
}

function PlatformRow({
  sectionId,
  pq,
  copied,
  onCopy,
}: {
  sectionId: string;
  pq: { platform: string; query: string; mode: "auto-search" | "copy-keyword"; url?: string };
  copied: string | undefined;
  onCopy: (sectionId: string, platform: string, query: string) => void;
}) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-sm)",
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 14 }}>{pq.platform}</span>
      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
        <span style={{ color: "var(--text-muted)", fontSize: 14 }}>&ldquo;{pq.query}&rdquo;</span>
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
            onClick={() => onCopy(sectionId, pq.platform, pq.query)}
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
            {copied === `${sectionId}:${pq.platform}` ? (
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
