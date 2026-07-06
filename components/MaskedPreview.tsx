"use client";

import { AlertTriangle } from "lucide-react";
import TokenText from "./TokenText";

// 마스킹 완료 화면 (phase1-masking-spec §8.3 - 3)
// 이 시점에 원문(parsedText)·Detection[]은 이미 폐기됐다. maskedText만 존재.

export interface MaskingStats {
  detected: number;
  applied: number;
  keptPlaintext: number; // "유지"로 확정된 공개 엔티티 수
}

interface MaskedPreviewProps {
  maskedText: string;
  stats?: MaskingStats;
  onNext: () => void;
}

export default function MaskedPreview({
  maskedText,
  stats,
  onNext,
}: MaskedPreviewProps) {
  const skipped = stats ? stats.detected - stats.applied - stats.keptPlaintext : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-base)", maxWidth: 860 }}>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
        }}
      >
        <h2 style={{ fontSize: 22 }}>마스킹 완료</h2>
        {stats && (
          <p style={{ fontSize: 14, fontWeight: 600 }}>
            탐지 {stats.detected}건 중 {stats.applied}건 마스킹 적용
            {stats.keptPlaintext > 0 && ` · ${stats.keptPlaintext}건 실명 유지(공개 엔티티)`}
          </p>
        )}
        {skipped > 0 && (
          <p
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-xs)",
              color: "var(--warning-weak-text)",
              background: "var(--warning-weak-bg)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-sm) var(--space-md)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={16} color="var(--warning-weak-text)" style={{ flexShrink: 0 }} />
            미적용 항목 {skipped}건이 있습니다 (해제했거나 더미로 남긴 항목).
            원문 그대로 외부에 전송됩니다.
          </p>
        )}
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          원문은 폐기되었습니다. 복원 매핑은 이 세션의 메모리에만 있으므로{" "}
          <b>새로고침하면 실명 복원이 불가능</b>합니다 — 산출물은 세션을 벗어나기
          전에 다운로드하세요.
        </p>
      </div>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
        }}
      >
        <h3 style={{ fontSize: 16, marginBottom: "var(--space-md)" }}>마스킹된 텍스트 (외부로 나가는 유일한 텍스트)</h3>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "inherit",
            background: "var(--bg)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-base)",
            maxHeight: 400,
            overflowY: "auto",
          }}
        >
          <TokenText text={maskedText} />
        </pre>
      </div>

      <button
        onClick={onNext}
        className="btn-primary"
        style={{
          alignSelf: "flex-start",
          padding: "12px var(--space-lg)",
          borderRadius: "var(--radius-md)",
          border: "none",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        다음
      </button>
    </div>
  );
}
