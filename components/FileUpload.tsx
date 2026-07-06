"use client";

import { useRef, useState } from "react";
import { isImageFile } from "@/lib/parse/image";
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
    if (
      !isBrowserParsable(file.name) &&
      !isServerParsable(file.name) &&
      !isImageFile(file.name)
    ) {
      setError(
        "지원하지 않는 형식입니다. TXT · MD · PDF · PPTX · PNG · JPG · GIF 파일을 올려주세요.",
      );
      return;
    }
    setError(undefined);
    onFile(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", width: "100%" }}>
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
        className="dropzone"
        style={{
          border: dragging ? "2px dashed var(--primary)" : undefined,
          background: dragging ? "var(--primary-soft)" : undefined,
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-xxl) var(--space-xl)",
          textAlign: "center",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
          alignItems: "center",
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 600 }}>파일을 드래그하거나 클릭하여 업로드</p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
          className="btn-primary"
          style={{
            padding: "10px var(--space-base)",
            borderRadius: "var(--radius-md)",
            border: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          파일 선택
        </button>
        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
          <p style={{ marginBottom: "var(--space-xs)" }}>지원 파일</p>
          <p>TXT · MD · PDF · PPTX · PNG · JPG · GIF</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.pdf,.pptx,.png,.jpg,.jpeg,.gif"
          hidden
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p role="alert" style={{ color: "var(--error-weak-text)", fontSize: 14, fontWeight: 600 }}>
          {error}
        </p>
      )}
    </div>
  );
}
