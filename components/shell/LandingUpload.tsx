"use client";

import AnalysisJsonUpload from "../AnalysisJsonUpload";
import FileUpload from "../FileUpload";

// 랜딩 모드 — LNB 없이 중앙 업로드 UI만 (phase1-masking-spec §8.1).
// txt/md는 브라우저에서 직접 파싱되어 원문이 PC를 떠나지 않는다.

interface LandingUploadProps {
  onFile: (file: File) => void;
  error?: string;
  parsing?: boolean;
}

const TIPS = [
  {
    icon: "🔒",
    title: "TXT / MD",
    body: "브라우저에서 처리되어 원문이 외부로 전송되지 않습니다.",
  },
  {
    icon: "⚡",
    title: "PDF / PPTX",
    body: "서버에서 분석 후 즉시 삭제됩니다.",
  },
  {
    icon: "🔄",
    title: "분석 결과 JSON",
    body: "업로드하면 레퍼런스 단계부터 다시 시작합니다.",
  },
];

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
        <h1 style={{ fontSize: 26, marginBottom: 8 }}>RefBoard AI</h1>
        <p style={{ color: "var(--text-muted)" }}>
          기획서를 업로드하면 AI가 프로젝트를 분석하여 레퍼런스 · 무드보드 ·
          컨셉을 생성합니다.
        </p>
      </div>

      <div
        style={{
          width: "min(560px, 90vw)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
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

        <AnalysisJsonUpload onFile={onFile} />

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
            TIP
          </p>
          {TIPS.map((tip) => (
            <div key={tip.title} style={{ display: "flex", gap: 8, fontSize: 14 }}>
              <span>{tip.icon}</span>
              <span>
                <strong>{tip.title}</strong>
                <br />
                <span style={{ color: "var(--text-muted)" }}>{tip.body}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
