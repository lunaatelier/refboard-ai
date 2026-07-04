"use client";

import { useRef, useState } from "react";
import { isAnalysisJsonFile } from "@/lib/state/recycle";

interface AnalysisJsonUploadProps {
  onFile: (file: File) => void;
}

export default function AnalysisJsonUpload({ onFile }: AnalysisJsonUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!isAnalysisJsonFile(file.name)) {
      setError("분석 결과 JSON 파일(.json)만 올릴 수 있습니다.");
      return;
    }
    setError(undefined);
    onFile(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        style={{
          border: `1px dashed var(--border)`,
          background: dragging ? "var(--primary-soft)" : "transparent",
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          cursor: "pointer",
        }}
      >
        <div>
          <p style={{ fontWeight: 600, fontSize: 14 }}>분석 결과 JSON 업로드</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            이전에 저장한 분석 결과 JSON을 다시 불러옵니다
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
          style={{
            padding: "6px 16px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          파일 선택
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
      {error && (
        <p role="alert" style={{ color: "#dc2626", fontWeight: 600, fontSize: 13 }}>
          {error}
        </p>
      )}
    </div>
  );
}
