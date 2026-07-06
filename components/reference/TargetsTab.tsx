"use client";

import { AlertTriangle, Info, MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  DetectedCaseStudy,
  ProjectAnalysis,
  ProjectDirective,
} from "@/lib/analysis/types";
import type { ExtractedAnalysisTarget } from "@/lib/masking/types";
import {
  daysAgo,
  getCachedTargetAnalysis,
  setCachedTargetAnalysis,
} from "@/lib/reference/targetCache";
import type {
  AnalysisTargetAnalysis,
  AnalysisTargetListItem,
  ReferenceResult,
} from "@/lib/reference/types";

// [분석 대상 브랜드] 탭 (Step 10-c, flow-spec ④)
// 2단계 구조: 1단계 넓은 목록(spec/manual/gemini 3소스, 누적) → 2단계 깊은 분석(7축).
// 분석됨 ≠ 채택. 캐시로 프로젝트 넘어 재활용. 모든 결과 "추정 포함, 확인 필요".

interface TargetsTabProps {
  analysis: ProjectAnalysis;
  directives: ProjectDirective[];
  extractedTargets: ExtractedAnalysisTarget[];
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

const AXIS_LABELS: [keyof AnalysisTargetAnalysis, string][] = [
  ["layoutStrategy", "1. 레이아웃 전략"],
  ["colorVisualStrategy", "2. 컬러·비주얼 전략"],
  ["componentPattern", "3. 컴포넌트 패턴"],
  ["painPoints", "4. 페인포인트"],
  ["wowPoints", "5. 와우포인트"],
  ["estimatedIntent", "6. 추정 의도"],
  ["implications", "7. 우리 프로젝트 시사점"],
];

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export default function TargetsTab({
  analysis,
  directives,
  extractedTargets,
  references,
  onChange,
}: TargetsTabProps) {
  const [listBusy, setListBusy] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();
  const [openId, setOpenId] = useState<string>();
  const [menuOpenId, setMenuOpenId] = useState<string>();
  const [manualName, setManualName] = useState("");
  const [manualUrl, setManualUrl] = useState("");

  const list = references.analysisTargetList ?? [];
  const analyses = references.targetAnalyses ?? {};

  // 소스 1: 마스킹에서 "유지"된 공개 엔티티 + 문서 내 기존 사례분석 자동 선반영 (실사용#2)
  useEffect(() => {
    if (references.analysisTargetList) return;
    const seeded: AnalysisTargetListItem[] = [];
    for (const t of extractedTargets) {
      seeded.push({
        id: `spec-${seeded.length + 1}`,
        name: t.name,
        url: "",
        source: "spec",
        oneLineSummary: "마스킹 검수에서 유지된 공개 엔티티",
        analysisStatus: "listed",
        adopted: false,
      });
    }
    for (const c of analysis.detectedCaseStudies ?? []) {
      if (seeded.some((s) => s.name === c.name)) continue;
      seeded.push({
        id: `spec-${seeded.length + 1}`,
        name: c.name,
        url: c.sourceUrls?.[0] ?? "",
        source: "spec",
        oneLineSummary: `문서 내 기존 사례분석: ${c.extractedNote}`,
        analysisStatus: "listed",
        adopted: false,
      });
    }
    if (seeded.length > 0) {
      onChange({ ...references, analysisTargetList: seeded });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchItem = (id: string, patch: Partial<AnalysisTargetListItem>) =>
    onChange({
      ...references,
      analysisTargetList: list.map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      ),
    });

  const fetchMore = async () => {
    setListBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/targets-list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: analysis.title,
          description: analysis.description,
          domain: analysis.domain,
          projectType: analysis.projectType,
          tags: analysis.tags,
          directives,
          excludeNames: list.map((t) => t.name),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.targets)) {
        throw new Error(body?.error ?? "목록 생성에 실패했습니다.");
      }
      const added: AnalysisTargetListItem[] = (
        body.targets as { name: string; url: string; oneLineSummary: string }[]
      )
        .filter((t) => !list.some((x) => x.name === t.name))
        .map((t, i) => ({
          id: `gem-${Date.now()}-${i}`,
          name: t.name,
          url: t.url,
          source: "gemini" as const,
          oneLineSummary: t.oneLineSummary,
          analysisStatus: "listed" as const,
          adopted: false,
        }));
      onChange({ ...references, analysisTargetList: [...list, ...added] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "목록 생성에 실패했습니다.");
    } finally {
      setListBusy(false);
    }
  };

  const addManual = () => {
    const name = manualName.trim();
    if (!name) return;
    onChange({
      ...references,
      analysisTargetList: [
        ...list,
        {
          id: `man-${Date.now()}`,
          name,
          url: manualUrl.trim(),
          source: "manual",
          oneLineSummary: "직접 입력",
          analysisStatus: "listed",
          adopted: false,
        },
      ],
    });
    setManualName("");
    setManualUrl("");
  };

  const analyze = async (item: AnalysisTargetListItem, force = false) => {
    // 캐시 확인 — 프로젝트 넘어 재활용
    if (!force) {
      const cached = getCachedTargetAnalysis(item.name);
      if (cached) {
        onChange({
          ...references,
          analysisTargetList: list.map((t) =>
            t.id === item.id ? { ...t, analysisStatus: "analyzed" } : t,
          ),
          targetAnalyses: { ...analyses, [item.id]: { ...cached, id: item.id } },
        });
        setOpenId(item.id);
        return;
      }
    }
    setBusyIds((prev) => new Set(prev).add(item.id));
    patchItem(item.id, { analysisStatus: "analyzing" });
    try {
      const res = await fetch("/api/target-analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          url: item.url,
          projectSummary: `${analysis.title} — ${analysis.description} (${analysis.domain})`,
          directives,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.analysis) {
        throw new Error(body?.error ?? "분석에 실패했습니다.");
      }
      const full: AnalysisTargetAnalysis = {
        ...body.analysis,
        id: item.id,
        name: item.name,
        depth: "deep",
        confidence: "추천",
        analyzedAt: new Date().toISOString(),
      };
      setCachedTargetAnalysis(item.name, full);
      onChange({
        ...references,
        analysisTargetList: list.map((t) =>
          t.id === item.id ? { ...t, analysisStatus: "analyzed" } : t,
        ),
        targetAnalyses: { ...analyses, [item.id]: full },
      });
      setOpenId(item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석에 실패했습니다.");
      patchItem(item.id, { analysisStatus: "listed" });
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          ...card,
          padding: "var(--space-base) var(--space-md)",
          background: "var(--info-weak-bg)",
          border: "none",
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
            fontWeight: 600,
            fontSize: 14,
            color: "var(--info)",
          }}
        >
          <Info size={18} color="var(--info)" />
          분석 대상 브랜드를 넓게 훑고, 깊게 볼 것만 선택해 분석하세요
        </span>
        <span
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: "var(--info)",
            background: "var(--surface)",
            borderRadius: "var(--radius-full)",
            padding: "var(--space-xs) var(--space-md)",
          }}
        >
          {list.length}개 목록
        </span>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>분석 대상 브랜드</h3>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          넓게 훑고, 고른 것만 깊게. 모든 결과는 추정 포함이며 확인이
          필요합니다
        </p>
        <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={fetchMore}
            disabled={listBusy}
            className="btn-weak-primary"
            style={{
              padding: "10px var(--space-base)",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: listBusy ? "var(--locked)" : undefined,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {listBusy ? "검색 중…" : list.length === 0 ? "Gemini로 목록 찾기" : "+ 더 찾기"}
          </button>
          <input
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="직접 추가: 이름"
            className="input-box"
            style={{
              padding: "var(--space-sm) var(--space-md)",
              borderRadius: "var(--radius-md)",
              font: "inherit",
              fontSize: 14,
              width: 140,
            }}
          />
          <input
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManual()}
            placeholder="URL (선택)"
            className="input-box"
            style={{
              padding: "var(--space-sm) var(--space-md)",
              borderRadius: "var(--radius-md)",
              font: "inherit",
              fontSize: 14,
              width: 200,
            }}
          />
          <button
            onClick={addManual}
            className="btn-weak-primary"
            style={{
              padding: "10px var(--space-base)",
              borderRadius: "var(--radius-md)",
              border: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            추가
          </button>
        </div>
        {error && (
          <p role="alert" style={{ color: "var(--error-weak-text)", fontWeight: 600, fontSize: 14 }}>
            {error}
          </p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-md)" }}>
        {list.map((item) => {
          const a = analyses[item.id];
          const host = hostnameOf(item.url);
          const busy = busyIds.has(item.id);
          const open = openId === item.id;
          return (
            <div
              key={item.id}
              style={{
                ...card,
                padding: "var(--space-base)",
                gridColumn: open ? "1 / -1" : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                {host && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
                    alt=""
                    width={18}
                    height={18}
                    loading="lazy"
                    style={{ borderRadius: "var(--radius-sm)" }}
                  />
                )}
                <b style={{ fontSize: 16 }}>{item.name}</b>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                <span
                  style={pill(
                    item.source === "spec"
                      ? "var(--surface-alt)"
                      : item.source === "manual"
                        ? "var(--info-weak-bg)"
                        : "var(--primary-weak-bg)",
                    item.source === "spec"
                      ? "var(--text-muted)"
                      : item.source === "manual"
                        ? "var(--info)"
                        : "var(--primary-hover)",
                  )}
                >
                  {item.source === "spec" ? "설계서" : item.source === "manual" ? "직접" : "Gemini"}
                </span>
                {item.analysisStatus === "analyzed" && (
                  <span style={pill("var(--success)", "var(--on-primary)")}>분석됨</span>
                )}
                {a && (
                  <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                    · {daysAgo(a.analyzedAt) === 0 ? "오늘 분석" : `${daysAgo(a.analyzedAt)}일 전`}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                {item.oneLineSummary}
                {item.url && (
                  <>
                    {" · "}
                    <a href={item.url} target="_blank" rel="noreferrer noopener" style={{ color: "var(--primary)" }}>
                      방문
                    </a>
                  </>
                )}
              </p>
              <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {item.analysisStatus !== "analyzed" ? (
                  <button
                    onClick={() => analyze(item)}
                    disabled={busy}
                    className="btn-weak-primary"
                    style={{
                      padding: "8px var(--space-base)",
                      borderRadius: "var(--radius-md)",
                      border: "none",
                      background: busy ? "var(--locked)" : undefined,
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {busy ? "분석 중…" : "깊게 분석 (7축)"}
                  </button>
                ) : (
                  <>
                    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={item.adopted}
                        onChange={(e) =>
                          patchItem(item.id, { adopted: e.target.checked })
                        }
                      />
                      채택
                    </label>
                    <button
                      onClick={() => setOpenId(open ? undefined : item.id)}
                      className="btn-tertiary"
                      style={{
                        padding: "8px var(--space-base)",
                        borderRadius: "var(--radius-md)",
                        border: "none",
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      {open ? "접기" : "결과 보기"}
                    </button>
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() =>
                          setMenuOpenId(menuOpenId === item.id ? undefined : item.id)
                        }
                        aria-label="더보기"
                        title="더보기"
                        className="btn-tertiary"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "8px var(--space-sm)",
                          borderRadius: "var(--radius-md)",
                          border: "none",
                        }}
                      >
                        <MoreHorizontal size={16} color="var(--text-muted)" />
                      </button>
                      {menuOpenId === item.id && (
                        <div
                          style={{
                            position: "absolute",
                            right: 0,
                            top: "calc(100% + 4px)",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            boxShadow: "var(--shadow-elevated)",
                            zIndex: 10,
                            minWidth: 120,
                          }}
                        >
                          <button
                            onClick={() => {
                              setMenuOpenId(undefined);
                              analyze(item, true);
                            }}
                            disabled={busy}
                            className="btn-weak-primary"
                            style={{
                              display: "block",
                              width: "100%",
                              padding: "var(--space-sm) var(--space-md)",
                              border: "none",
                              fontSize: 14,
                              textAlign: "left",
                              whiteSpace: "nowrap",
                            }}
                          >
                            새로 분석
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              {open && a && (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", borderTop: "1px solid var(--border)", paddingTop: "var(--space-md)" }}>
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
                    추정 포함, 확인 필요 · 출처:{" "}
                    <a href={a.sourceUrl} target="_blank" rel="noreferrer noopener" style={{ color: "var(--primary)" }}>
                      {a.sourceUrl}
                    </a>
                  </p>
                  {AXIS_LABELS.map(([key, label]) => {
                    const v = a[key];
                    return (
                      <div key={key}>
                        <b style={{ fontSize: 14 }}>{label}</b>
                        {Array.isArray(v) ? (
                          <ul style={{ paddingLeft: 20, fontSize: 14, color: "var(--text-muted)" }}>
                            {v.map((x, i) => (
                              <li key={i}>{x}</li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                            {String(v)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pill(background: string, color: string): React.CSSProperties {
  return {
    fontSize: 14,
    fontWeight: 600,
    color,
    background,
    borderRadius: "var(--radius-full)",
    padding: "var(--space-xs) var(--space-md)",
  };
}
