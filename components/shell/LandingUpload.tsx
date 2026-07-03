"use client";

import FileUpload from "../FileUpload";

// 랜딩 모드 — LNB 없이 중앙 업로드 UI만 (phase1-masking-spec §8.1).
// txt/md는 브라우저에서 직접 파싱되어 원문이 PC를 떠나지 않는다.

interface LandingUploadProps {
  onFile: (file: File) => void;
  error?: string;
  parsing?: boolean;
}

export default function LandingUpload({
  onFile,
  error,
  parsing,
}: LandingUploadProps) {
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

      <div style={{ width: "min(560px, 90vw)", display: "flex", flexDirection: "column", gap: 8 }}>
        <FileUpload onFile={onFile} />
        {parsing && (
          <p style={{ color: "var(--primary)", fontWeight: 600, textAlign: "center" }}>
            텍스트 추출 중…
          </p>
        )}
        {error && (
          <p role="alert" style={{ color: "#dc2626", fontWeight: 600, textAlign: "center" }}>
            {error}
          </p>
        )}
      </div>

      <p
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          maxWidth: 560,
          textAlign: "center",
        }}
      >
        txt/md는 브라우저에서 직접 처리되어 원문이 PC를 떠나지 않습니다.
        민감정보는 외부 AI로 전송되기 전에 전량 마스킹되며, 마스킹을 거치지
        않은 텍스트는 다음 단계로 넘어갈 수 없습니다.
      </p>
    </main>
  );
}
