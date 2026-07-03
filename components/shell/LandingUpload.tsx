"use client";

// 랜딩 모드 — LNB 없이 중앙 업로드 UI만 (phase1-masking-spec §8.1).
// Step 2에서는 더미 업로드만 동작한다. 실제 파일 파싱은 Step 4(txt/md)·Step 5(pdf/pptx).

interface LandingUploadProps {
  onUpload: () => void;
}

export default function LandingUpload({ onUpload }: LandingUploadProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 32,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 26, marginBottom: 8 }}>
          Design Reference Generator
        </h1>
        <p style={{ color: "var(--text-muted)" }}>
          기획서를 업로드하면 분석 → 레퍼런스·무드보드 → 컨셉서까지 도출합니다.
        </p>
      </div>

      <div
        style={{
          width: "min(560px, 90vw)",
          background: "var(--surface)",
          border: "2px dashed var(--border)",
          borderRadius: 16,
          padding: "48px 32px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          alignItems: "center",
        }}
      >
        <p style={{ fontWeight: 600 }}>기획서 파일을 업로드하세요</p>
        <p style={{ color: "var(--text-muted)" }}>
          지원 형식: txt · md · pdf · pptx (텍스트만)
        </p>
        <button
          onClick={onUpload}
          style={{
            padding: "12px 24px",
            borderRadius: 10,
            border: "none",
            background: "var(--primary)",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          샘플 문서로 시작 (더미)
        </button>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          실제 파일 업로드·파싱은 Step 4에서 연결됩니다.
        </p>
      </div>

      <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 560 }}>
        업로드된 문서의 민감정보는 외부 AI로 전송되기 전에 전량 마스킹됩니다.
        마스킹을 거치지 않은 텍스트는 다음 단계로 넘어갈 수 없습니다.
      </p>
    </main>
  );
}
