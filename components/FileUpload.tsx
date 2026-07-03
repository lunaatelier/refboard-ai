"use client";

import { useRef, useState } from "react";
import { isBrowserParsable, isServerParsable } from "@/lib/parse/txt";

interface FileUploadProps {
  onFile: (file: File) => void;
}

export default function FileUpload({ onFile }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!isBrowserParsable(file.name) && !isServerParsable(file.name)) {
      setError("지원하지 않는 형식입니다. txt/md/pdf/pptx 파일을 올려주세요.");
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
          border: `2px dashed ${dragging ? "var(--primary)" : "var(--border)"}`,
          background: dragging ? "var(--primary-soft)" : "var(--surface)",
          borderRadius: 16,
          padding: "48px 32px",
          textAlign: "center",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "center",
        }}
      >
        <p style={{ fontWeight: 600 }}>
          파일을 끌어다 놓거나 클릭해서 선택하세요
        </p>
        <p style={{ color: "var(--text-muted)" }}>
          지원 형식: txt · md · pdf · pptx — 텍스트만 (URL·이미지·캡처는 이후 확장)
        </p>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          txt/md는 브라우저에서 처리(원문이 PC를 떠나지 않음) ·
          pdf/pptx는 자사 서버에서 파싱(메모리 처리, 저장 안 함)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.pdf,.pptx"
          hidden
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p role="alert" style={{ color: "#dc2626", fontWeight: 600 }}>
          {error}
        </p>
      )}
    </div>
  );
}
