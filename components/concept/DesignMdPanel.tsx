"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import type { ProjectAnalysis } from "@/lib/analysis/types";
import type { ConceptJson } from "@/lib/concept/types";
import { renderDesignMd } from "@/lib/render/designMd";
import PageLayout, { InlineErrorText, pageCardStyle } from "../shell/PageLayout";

// ⑥ 디자인 MD (Phase 5) — Concept JSON → 외부 표준 스키마 MD 변환.
// 컨셉서 출력(OutputPanel)은 3안을 전부 내보내지만, 디자인 MD는 한 번에 한 안만
// 변환한다(스키마가 단일 디자인 시스템을 표현하도록 설계돼 있어 3안을 동시에 담을
// 수 없음). 그래서 "확정 컨셉"이 아니라 "디자인 MD로 변환할 안"을 고르는 셀렉터.
// 모든 렌더링은 클라이언트에서 수행한다(§4.5) — 서버 왕복 없음.

interface DesignMdPanelProps {
  analysis?: ProjectAnalysis;
  concept?: ConceptJson;
}

export default function DesignMdPanel({ analysis, concept }: DesignMdPanelProps) {
  const options = concept?.options ?? [];
  const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>(
    options[0]?.optionId,
  );
  const [copied, setCopied] = useState(false);

  const option = options.find((o) => o.optionId === selectedOptionId) ?? options[0];

  const { md, error } = useMemo(() => {
    if (!analysis || !option) return { md: undefined, error: undefined };
    try {
      return {
        md: renderDesignMd({
          projectTitle: concept?.projectTitle || analysis.title,
          option,
          domain: analysis.domain,
        }),
        error: undefined,
      };
    } catch (e) {
      // 렌더러는 팔레트 hex가 잘못되면 의도적으로 예외를 던진다(designMd.ts —
      // "실재 우선, 지어내지 않는다" 원칙) — 화면이 깨지지 않게 여기서 잡는다.
      return {
        md: undefined,
        error: e instanceof Error ? e.message : "디자인 MD 생성에 실패했습니다.",
      };
    }
  }, [analysis, concept?.projectTitle, option]);

  const copy = async () => {
    if (!md) return;
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    if (!md) return;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "design.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!analysis || options.length === 0) {
    return (
      <PageLayout title="디자인 MD">
        <div style={pageCardStyle}>
          <p style={{ color: "var(--text-muted)" }}>
            컨셉 3안을 먼저 생성해야 디자인 MD를 만들 수 있습니다.
          </p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="디자인 MD">
      <div style={pageCardStyle}>
        <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
          {options.map((o) => (
            <button
              key={o.optionId}
              onClick={() => setSelectedOptionId(o.optionId)}
              style={{
                flex: 1,
                minWidth: 160,
                textAlign: "left",
                padding: "var(--space-md)",
                borderRadius: "var(--radius-lg)",
                border:
                  o.optionId === option?.optionId
                    ? "2px solid var(--primary)"
                    : "1px solid var(--border)",
                background:
                  o.optionId === option?.optionId ? "var(--primary-soft)" : "transparent",
              }}
            >
              <b style={{ fontSize: 15, fontWeight: 600 }}>{o.label}</b>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          디자인 MD로 변환할 안을 고르세요. 컨셉서 출력과 달리 디자인 MD는 한 번에
          한 안만 변환됩니다.
        </p>

        {error && (
          <InlineErrorText>
            디자인 MD 생성에 실패했습니다: {error}
          </InlineErrorText>
        )}

        {md && (
          <>
            <div style={{ display: "flex", gap: "var(--space-sm)" }}>
              <button onClick={copy} className="btn-tertiary" style={btnStyle}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "복사됨" : "복사"}
              </button>
              <button onClick={download} className="btn-tertiary" style={btnStyle}>
                <Download size={16} />
                .md 다운로드
              </button>
            </div>
            <pre
              style={{
                maxHeight: 480,
                overflow: "auto",
                padding: "var(--space-md)",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {md}
            </pre>
          </>
        )}
      </div>
    </PageLayout>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px var(--space-base)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border)",
  fontWeight: 600,
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  gap: 6,
};
