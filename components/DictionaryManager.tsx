"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
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
  const [open, setOpen] = useState(false);

  const refresh = () => setEntries(listDictionary());

  const handleAdd = () => {
    if (addDictionaryEntry(value, kind)) {
      setValue("");
      refresh();
    }
  };

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="accordion-row"
      style={{
        borderTop: "1px solid var(--border)",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-muted)",
          listStyle: "none",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-xs)",
          height: 40,
          padding: "0 var(--space-xs)",
        }}
      >
        <ChevronRight
          size={14}
          style={{
            flexShrink: 0,
            transition: "transform 150ms ease",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
        내 사전 관리 {entries.length}개 단어
      </summary>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
          padding: "var(--space-sm) var(--space-xs) var(--space-base)",
        }}
      >
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          등록한 단어는 업로드할 때마다 자동으로 탐지 후보에 올라갑니다.
          인명은 전역 — 모든 프로젝트에서 유지됩니다.
        </p>
        <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as DictionaryEntry["kind"])}
            className="select-box"
            style={{ width: 120 }}
          >
            {(Object.keys(KIND_LABELS) as DictionaryEntry["kind"][]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="항상 가릴 단어"
            className="input-box"
            style={{
              flex: 1,
              minWidth: 180,
              padding: "10px var(--space-md)",
              borderRadius: "var(--radius-md)",
              fontSize: 14,
              font: "inherit",
            }}
          />
          <button
            onClick={handleAdd}
            className="btn-weak-primary"
            style={{
              padding: "10px var(--space-base)",
              borderRadius: "var(--radius-md)",
              border: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            등록
          </button>
        </div>
        {entries.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-sm)",
            }}
          >
            {entries.map((e) => (
              <li
                key={e.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-sm)",
                  padding: "6px var(--space-md)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <span style={{ flex: 1, fontSize: 14 }}>{e.value}</span>
                <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
                  {KIND_LABELS[e.kind]}
                </span>
                <button
                  onClick={() => {
                    removeDictionaryEntry(e.id);
                    refresh();
                  }}
                  className="btn-weak-danger"
                  style={{
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    padding: "4px var(--space-md)",
                    fontSize: 14,
                    fontWeight: 600,
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
