"use client";

import { useEffect, useState } from "react";
import { Clipboard, Link, Lock, RefreshCw, Zap } from "lucide-react";
import { clipboardFileName } from "@/lib/parse/image";
import AnalysisJsonUpload from "../AnalysisJsonUpload";
import FileUpload from "../FileUpload";

// 랜딩 모드 — LNB 없이 중앙 업로드 UI만 (phase1-masking-spec §8.1).
// txt/md는 브라우저에서 직접 파싱되어 원문이 PC를 떠나지 않는다.
// Step 16: 클립보드 캡처 붙여넣기(Ctrl+V) — Figma/V0 화면 캡처를 바로 올리는 경로.

interface LandingUploadProps {
  onFile: (file: File) => void;
  onLink: (url: string) => void;
  error?: string;
  parsing?: boolean;
}

const TIPS = [
  {
    icon: Lock,
    title: "TXT / MD",
    body: "브라우저에서 처리되어 원문이 외부로 전송되지 않습니다.",
  },
  {
    icon: Zap,
    title: "PDF / PPTX",
    body: "서버에서 분석 후 즉시 삭제됩니다.",
  },
  {
    icon: Clipboard,
    title: "이미지 / 캡처 붙여넣기",
    body: "PNG·JPG·GIF 업로드 또는 화면 캡처를 Ctrl+V로 바로 붙여넣으세요. 전송 전 동의 단계를 거칩니다.",
  },
  {
    icon: Link,
    title: "공개 링크 (V0 등)",
    body: "정적 텍스트만 추출됩니다. 스크립트로 그려지는 화면은 캡처 붙여넣기를 사용하세요.",
  },
  {
    icon: RefreshCw,
    title: "분석 결과 JSON",
    body: "업로드하면 레퍼런스 단계부터 다시 시작합니다.",
  },
];

export default function LandingUpload({
  onFile,
  onLink,
  error,
  parsing,
}: LandingUploadProps) {
  const [linkInput, setLinkInput] = useState("");

  const submitLink = () => {
    const url = linkInput.trim();
    if (url) onLink(url);
  };

  // 클립보드 캡처 붙여넣기 — 이미지 항목만 받는다 (텍스트 붙여넣기는 무시).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      const blob = item?.getAsFile();
      if (!blob) return;
      e.preventDefault();
      onFile(
        new File([blob], clipboardFileName(item!.type), { type: item!.type }),
      );
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFile]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-lg)",
        padding: "var(--space-xl)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 28, marginBottom: "var(--space-sm)" }}>RefBoard AI</h1>
        <p style={{ fontSize: 16, color: "var(--text-muted)" }}>
          기획서를 업로드하면 AI가 프로젝트를 분석하여 레퍼런스 · 무드보드 ·
          컨셉을 생성합니다.
        </p>
      </div>

      <div
        style={{
          width: "min(560px, 90vw)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-base)",
        }}
      >
        <FileUpload onFile={onFile} />
        {parsing && (
          <p style={{ fontSize: 14, color: "var(--primary)", fontWeight: 600, textAlign: "center" }}>
            텍스트 추출 중…
          </p>
        )}
        {error && (
          <p role="alert" style={{ fontSize: 14, color: "var(--error-weak-text)", fontWeight: 600, textAlign: "center" }}>
            {error}
          </p>
        )}

        {/* 링크 입력 (Step 17) — 공개 링크의 정적 텍스트만. 렌더링형 페이지는 캡처 붙여넣기로. */}
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <input
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitLink();
            }}
            placeholder="또는 공개 링크 붙여넣기 (V0 공유 링크 등)"
            className="input-box"
            style={{
              flex: 1,
              padding: "10px var(--space-md)",
              borderRadius: "var(--radius-md)",
              fontSize: 14,
              font: "inherit",
            }}
          />
          <button
            onClick={submitLink}
            disabled={parsing || !linkInput.trim()}
            className={linkInput.trim() ? "btn-weak-primary" : undefined}
            style={{
              padding: "10px var(--space-base)",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: linkInput.trim() ? undefined : "var(--surface-alt)",
              color: linkInput.trim() ? undefined : "var(--text-body)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            가져오기
          </button>
        </div>

        <AnalysisJsonUpload onFile={onFile} />

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-base) var(--space-lg)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-sm)",
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>
            TIP
          </p>
          {TIPS.map((tip) => (
            <div key={tip.title} style={{ display: "flex", gap: "var(--space-sm)", fontSize: 14 }}>
              <tip.icon size={18} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} />
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
