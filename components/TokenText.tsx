"use client";

// 마스킹 토큰([회사A] 등)을 시각적으로 구분해 렌더링 (UI 규칙: 토큰 배경색/배지)
export default function TokenText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\[\]\n]+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[^\[\]\n]+\]$/.test(p) ? (
          <mark
            key={i}
            style={{
              background: "var(--primary-soft)",
              color: "var(--primary)",
              borderRadius: 4,
              padding: "0 4px",
              fontWeight: 600,
            }}
          >
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
