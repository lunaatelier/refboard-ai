"use client";

import { useRef, useState } from "react";
import { isAnalysisJsonFile } from "@/lib/state/recycle";
import { InlineErrorText } from "./shell/PageLayout";

interface AnalysisJsonUploadProps {
  onFile: (file: File) => void;
  /** JSON 파싱/형식 오류 (page.tsx에서 판정) — 이 행 바로 아래에 표시한다. */
  error?: string;
}

// 타이틀 없이 한 행(안내문구 좌 / 버튼 우 — 마스킹 확정 행과 동일 패턴).
// 버튼은 업로드 페이지 2순위 위계(링크 "가져오기"와 동급, btn-weak-primary).
export default function AnalysisJsonUpload({ onFile, error }: AnalysisJsonUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string>();

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!isAnalysisJsonFile(file.name)) {
      setLocalError("분석 결과 JSON 파일(.json)만 올릴 수 있습니다.");
      return;
    }
    setLocalError(undefined);
    onFile(file);
  };

  const shownError = localError ?? error;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-md)",
        }}
      >
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          분석 결과 화면에서 저장한 JSON을 업로드하면 레퍼런스 단계부터
          시작합니다.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn-weak-primary"
          style={{
            padding: "10px var(--space-base)",
            borderRadius: "var(--radius-md)",
            border: "none",
            fontWeight: 600,
            fontSize: 14,
            whiteSpace: "nowrap",
          }}
        >
          불러오기
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          hidden
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {shownError && <InlineErrorText>{shownError}</InlineErrorText>}
    </div>
  );
}
