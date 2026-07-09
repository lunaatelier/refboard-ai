"use client";

import type { DirectiveScope, ProjectDirective } from "@/lib/analysis/types";

// 지시 입력 (Step 15) — 한 텍스트에어리어에 줄바꿈으로 여러 지시를 적는다.
// 적용 단계(scope)는 이 블록 전체에 공통 적용 — 미선택 = 전 단계 적용.

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
  const text = directives.map((d) => d.text).join("\n");
  const scope = directives[0]?.scope;

  const applyText = (nextText: string) => {
    onChange(nextText.split("\n").map((line) => ({ text: line, scope })));
  };

  const toggleScope = (s: DirectiveScope) => {
    const current = scope ?? [];
    const next = current.includes(s)
      ? current.filter((x) => x !== s)
      : [...current, s];
    const nextScope = next.length > 0 ? next : undefined;
    onChange(directives.map((d) => ({ ...d, scope: nextScope })));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
      <span style={{ fontWeight: 600, fontSize: 16 }}>추가 요청사항 (선택)</span>
      <textarea
        value={text}
        onChange={(e) => applyText(e.target.value)}
        placeholder='예: "ESG 강조" — 실명·기밀 정보는 넣지 마세요. 여러 요청은 줄바꿈으로 구분하세요.'
        className="textarea-box"
        rows={3}
      />
      <div
        style={{
          display: "flex",
          gap: "var(--space-xs)",
          alignItems: "center",
          flexWrap: "wrap",
          fontSize: 14,
        }}
      >
        <span style={{ color: "var(--text-muted)" }}>적용 단계:</span>
        {ALL_SCOPES.map((s) => {
          const active = scope?.includes(s) ?? false;
          return (
            <button
              key={s}
              onClick={() => toggleScope(s)}
              aria-pressed={active}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-full)",
                border: "none",
                background: active ? "var(--primary)" : "var(--surface-alt)",
                color: active ? "var(--on-primary)" : "var(--text-muted)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {SCOPE_LABELS[s]}
            </button>
          );
        })}
        <span style={{ color: "var(--text-muted)" }}>
          {!scope || scope.length === 0 ? "(미선택 = 전체 적용)" : ""}
        </span>
      </div>
    </div>
  );
}
