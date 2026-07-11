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

  // 구획 라벨은 다른 카드("분석 요약" 등)와 동일 위계(16/700), 아이콘 없음.
  // 하단은 좌측 helper(반영 안내·보안 주의) + 우측 적용 단계 토글로 분리.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
      <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text-strong)" }}>
        추가 요청사항 (선택)
      </span>
      <textarea
        value={text}
        onChange={(e) => applyText(e.target.value)}
        placeholder="예: 홈 화면은 카드 정보 중심, 주행 화면은 지도 기반으로 구성해주세요. 여러 요청은 줄바꿈으로 구분하세요."
        className="textarea-box"
        rows={3}
      />
      <div
        style={{
          display: "flex",
          gap: "var(--space-sm)",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          fontSize: 14,
        }}
      >
        <span style={{ color: "var(--text-muted)" }}>
          입력한 요청은 다음 단계의 레퍼런스 검색·컨셉 생성 기준에 반영됩니다.
          실명·기밀 정보는 넣지 마세요.
        </span>
        <div
          style={{
            display: "flex",
            gap: "var(--space-xs)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>
            적용 단계{!scope || scope.length === 0 ? " (미선택 = 전체)" : ""}:
          </span>
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
        </div>
      </div>
    </div>
  );
}
