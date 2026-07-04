"use client";

import { useState } from "react";
import {
  addDictionaryEntry,
  listDictionary,
  removeDictionaryEntry,
} from "@/lib/dictionary/store";
import type { DictionaryEntry } from "@/lib/masking/types";

// 내 사전 관리 (phase1-masking-spec §6)
// 여기 저장되는 건 "사용자가 직접 등록한 가릴 단어"뿐 — 문서 원문 아님.

const KIND_LABELS: Record<DictionaryEntry["kind"], string> = {
  company: "회사명",
  client: "고객사",
  product: "제품",
  person: "인명(전역)",
};

export default function DictionaryManager() {
  const [entries, setEntries] = useState<DictionaryEntry[]>(() =>
    listDictionary(),
  );
  const [value, setValue] = useState("");
  const [kind, setKind] = useState<DictionaryEntry["kind"]>("company");

  const refresh = () => setEntries(listDictionary());

  const handleAdd = () => {
    if (addDictionaryEntry(value, kind)) {
      setValue("");
      refresh();
    }
  };

  return (
    <details
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 24px",
        maxWidth: 860,
      }}
    >
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        내 사전 관리 ({entries.length}개 단어)
      </summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 16 }}>
        <p style={{ color: "var(--text-muted)" }}>
          등록한 단어는 업로드할 때마다 자동으로 탐지 후보에 올라갑니다.
          인명은 전역 — 모든 프로젝트에서 유지됩니다.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="항상 가릴 단어"
            style={{
              flex: 1,
              minWidth: 180,
              padding: "8px 12px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              font: "inherit",
            }}
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as DictionaryEntry["kind"])}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", font: "inherit" }}
          >
            {(Object.keys(KIND_LABELS) as DictionaryEntry["kind"][]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            등록
          </button>
        </div>
        {entries.length > 0 && (
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {entries.map((e) => (
              <li
                key={e.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                <span style={{ flex: 1 }}>{e.value}</span>
                <span style={{ color: "var(--text-muted)" }}>
                  {KIND_LABELS[e.kind]}
                </span>
                <button
                  onClick={() => {
                    removeDictionaryEntry(e.id);
                    refresh();
                  }}
                  style={{
                    border: "1px solid var(--border)",
                    background: "transparent",
                    borderRadius: 6,
                    padding: "2px 10px",
                    color: "var(--text-muted)",
                  }}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
