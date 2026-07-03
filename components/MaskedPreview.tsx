"use client";

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
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h2>② 마스킹 완료</h2>
        {stats && (
          <p style={{ fontWeight: 600 }}>
            탐지 {stats.detected}건 중 {stats.applied}건 마스킹 적용
            {stats.keptPlaintext > 0 && ` · ${stats.keptPlaintext}건 실명 유지(공개 엔티티)`}
          </p>
        )}
        {skipped > 0 && (
          <p
            role="alert"
            style={{
              color: "#b45309",
              background: "#fef3c7",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 600,
            }}
          >
            ⚠ 미적용 항목 {skipped}건이 있습니다 (해제했거나 더미로 남긴 항목).
            원문 그대로 외부에 전송됩니다.
          </p>
        )}
        <p style={{ color: "var(--text-muted)" }}>
          원문은 폐기되었습니다. 복원 매핑은 이 세션의 메모리에만 있으므로{" "}
          <b>새로고침하면 실명 복원이 불가능</b>합니다 — 산출물은 세션을 벗어나기
          전에 다운로드하세요.
        </p>
      </div>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>마스킹된 텍스트 (외부로 나가는 유일한 텍스트)</h3>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "inherit",
            background: "var(--bg)",
            borderRadius: 8,
            padding: 16,
            maxHeight: 400,
            overflowY: "auto",
          }}
        >
          <TokenText text={maskedText} />
        </pre>
      </div>

      <button
        onClick={onNext}
        style={{
          alignSelf: "flex-start",
          padding: "12px 24px",
          borderRadius: 10,
          border: "none",
          background: "var(--primary)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        다음 단계 — ③ 분석 결과
      </button>
    </div>
  );
}
