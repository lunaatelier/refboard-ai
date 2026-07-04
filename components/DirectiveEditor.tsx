"use client";

import type { DirectiveScope, ProjectDirective } from "@/lib/analysis/types";

// 지시별 세밀 scope UI (Step 15) — 지시 여러 개 + 각 지시의 적용 단계·중요도 편집.
// scope 미선택 = 전체 단계 적용 (기존 동작과 동일, 저장된 분석 JSON과도 호환).

const SCOPE_LABELS: Record<DirectiveScope, string> = {
  analysis: "분석",
  reference: "레퍼런스",
  mood: "무드·이미지",
  concept: "컨셉",
  output: "출력",
};

const ALL_SCOPES = Object.keys(SCOPE_LABELS) as DirectiveScope[];

export function describeScope(d: ProjectDirective): string {
  if (!d.scope || d.scope.length === 0) return "전체";
  return d.scope.map((s) => SCOPE_LABELS[s]).join("·");
}

export default function DirectiveEditor({
  directives,
  onChange,
}: {
  directives: ProjectDirective[];
  onChange: (next: ProjectDirective[]) => void;
}) {
  const update = (index: number, patch: Partial<ProjectDirective>) => {
    onChange(
      directives.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
  };

  const toggleScope = (index: number, scope: DirectiveScope) => {
    const current = directives[index].scope ?? [];
    const next = current.includes(scope)
      ? current.filter((s) => s !== scope)
      : [...current, scope];
    // 빈 배열은 "전체 적용"과 같으므로 undefined로 정규화
    update(index, { scope: next.length > 0 ? next : undefined });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontWeight: 600 }}>추가 요청사항 (선택)</span>
      {directives.map((d, i) => (
        <div
          key={i}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={d.text}
              onChange={(e) => update(i, { text: e.target.value })}
              placeholder='예: "ESG 강조" — 실명·기밀 정보는 넣지 마세요.'
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                font: "inherit",
              }}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              <input
                type="checkbox"
                checked={d.priority === "high"}
                onChange={(e) =>
                  update(i, {
                    priority: e.target.checked ? "high" : undefined,
                  })
                }
              />
              중요
            </label>
            <button
              onClick={() => onChange(directives.filter((_, j) => j !== i))}
              aria-label="지시 삭제"
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "transparent",
                padding: "6px 10px",
              }}
            >
              ✕
            </button>
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexWrap: "wrap",
              fontSize: 13,
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>적용 단계:</span>
            {ALL_SCOPES.map((s) => {
              const active = d.scope?.includes(s) ?? false;
              return (
                <button
                  key={s}
                  onClick={() => toggleScope(i, s)}
                  aria-pressed={active}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: active
                      ? "1px solid var(--primary)"
                      : "1px solid var(--border)",
                    background: active ? "var(--primary)" : "transparent",
                    color: active ? "#fff" : "inherit",
                    fontSize: 13,
                  }}
                >
                  {SCOPE_LABELS[s]}
                </button>
              );
            })}
            <span style={{ color: "var(--text-muted)" }}>
              {!d.scope || d.scope.length === 0
                ? "(미선택 = 전 단계 적용)"
                : ""}
            </span>
          </div>
        </div>
      ))}
      <button
        onClick={() => onChange([...directives, { text: "" }])}
        style={{
          alignSelf: "flex-start",
          padding: "8px 16px",
          borderRadius: 8,
          border: "1px dashed var(--border)",
          background: "transparent",
          fontWeight: 600,
        }}
      >
        ＋ 지시 추가
      </button>
    </div>
  );
}
