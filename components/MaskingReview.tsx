"use client";

import { useMemo, useState } from "react";
import TokenText from "./TokenText";
import { createDraft } from "@/lib/masking/apply";
import {
  ENTITY_KIND_LABELS,
  isPublicEntityKind,
} from "@/lib/masking/entity";
import { detectWordOccurrences } from "@/lib/masking/manual";
import { classifyUrl } from "@/lib/masking/urlRules";
import type {
  AnalysisTargetKind,
  Detection,
  DictionaryEntry,
  NumericDetection,
  NumericMaskingMode,
  SensitiveKind,
} from "@/lib/masking/types";

// 마스킹 검수 화면 (phase1-masking-spec §8.3)
// 탐지 리스트(종류별 그룹) + 켜기/끄기 + 회사명 가림/유지 토글(Step 4 = 2분) +
// 단어 직접 추가 + "항상 가리기"(사전 등록) + 실시간 미리보기 + 원문 토글

const KIND_LABELS: Partial<Record<SensitiveKind, string>> = {
  email: "이메일",
  phone: "전화",
  url: "URL",
  ip: "IP",
  apikey: "API키",
  rrn: "주민번호",
  businessRegNo: "사업자번호",
  certificationNo: "인증번호",
  address: "주소",
  company: "회사명",
  client: "고객사",
  product: "제품",
  personName: "인명",
};

// 엔티티 등급 태깅 대상 — 회사·기관명 계열 (Step 6: 6종 드롭다운)
const ENTITY_KINDS: SensitiveKind[] = ["company", "client"];

const NUMERIC_KIND_LABELS: Record<NumericDetection["kind"], string> = {
  financialMetric: "재무 수치",
  businessMetric: "비즈니스 지표",
  internalKpi: "내부 KPI",
};

const MANUAL_KIND_OPTIONS: {
  value: DictionaryEntry["kind"];
  label: string;
}[] = [
  { value: "company", label: "회사명" },
  { value: "client", label: "고객사" },
  { value: "product", label: "제품" },
  { value: "person", label: "인명" },
];

const DICT_TO_SENSITIVE: Record<DictionaryEntry["kind"], SensitiveKind> = {
  company: "company",
  client: "client",
  product: "product",
  person: "personName",
};

interface MaskingReviewProps {
  parsedText: string; // ⚠️ 원문 — 이 컴포넌트(검수) 밖으로 내보내지 않는다
  detections: Detection[];
  numericDetections: NumericDetection[];
  onUpdateDetections: (next: Detection[]) => void;
  onUpdateNumeric: (next: NumericDetection[]) => void;
  onAddToDictionary: (value: string, kind: DictionaryEntry["kind"]) => void;
  onConfirm: () => void;
}

export default function MaskingReview({
  parsedText,
  detections,
  numericDetections,
  onUpdateDetections,
  onUpdateNumeric,
  onAddToDictionary,
  onConfirm,
}: MaskingReviewProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [manualWord, setManualWord] = useState("");
  const [manualKind, setManualKind] =
    useState<DictionaryEntry["kind"]>("company");
  const [manualToDict, setManualToDict] = useState(false);
  const [notice, setNotice] = useState<string>();

  const preview = useMemo(
    () =>
      createDraft(parsedText, detections, numericDetections).previewMaskedText,
    [parsedText, detections, numericDetections],
  );

  const enabledCount = detections.filter(
    (d) => d.enabled && !d.keepPlaintext,
  ).length;

  // "유지"로 태깅된 공개 엔티티 이름 → URL 도메인 대조에 사용 (실사용#1/#6)
  const keptBrandNames = useMemo(
    () =>
      detections
        .filter((d) => d.keepPlaintext && ENTITY_KINDS.includes(d.kind))
        .map((d) => d.raw),
    [detections],
  );

  const grouped = useMemo(() => {
    const map = new Map<SensitiveKind, Detection[]>();
    for (const d of detections) {
      map.set(d.kind, [...(map.get(d.kind) ?? []), d]);
    }
    return [...map.entries()];
  }, [detections]);

  const patch = (id: string, p: Partial<Detection>) =>
    onUpdateDetections(
      detections.map((d) => (d.id === id ? { ...d, ...p } : d)),
    );

  const handleManualAdd = () => {
    const word = manualWord.trim();
    if (!word) return;
    const found = detectWordOccurrences(
      parsedText,
      word,
      DICT_TO_SENSITIVE[manualKind],
      detections,
    );
    if (found.length === 0) {
      setNotice(`"${word}" — 문서에서 (추가로) 찾은 위치가 없습니다.`);
    } else {
      onUpdateDetections(
        [...detections, ...found].sort((a, b) => a.start - b.start),
      );
      setNotice(`"${word}" ${found.length}건 추가됨.`);
    }
    if (manualToDict) {
      onAddToDictionary(word, manualKind);
      if (manualKind === "person") {
        setNotice(
          `"${word}" 등록됨 — 이 이름은 앞으로 모든 프로젝트에서 자동 탐지됩니다.`,
        );
      }
    }
    setManualWord("");
  };

  const card: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>
      <div
        style={{
          ...card,
          padding: "16px 20px",
          background: "var(--primary-soft)",
          border: "1px solid var(--primary)",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--primary)" }}>
          👉 탐지된 항목을 확인하고 가릴지/유지할지 정한 뒤, 하단에서
          마스킹을 확정하세요
        </span>
        <span
          style={{
            fontWeight: 700,
            color: "var(--primary)",
            background: "var(--surface)",
            borderRadius: 999,
            padding: "4px 14px",
          }}
        >
          {enabledCount}건 적용 예정
        </span>
      </div>

      <div style={card}>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>마스킹 검수</h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          민감정보 {detections.length}건 탐지됨
        </p>
        <p style={{ color: "var(--text-muted)" }}>
          외부 AI로는 마스킹된 텍스트만 전송됩니다. 회사명은 기본 가림이며,
          경쟁사·벤치마킹 브랜드처럼 분석에 필요한 공개 엔티티만
          &ldquo;유지&rdquo;로 바꾸세요. <b>더미 추정</b> 항목은 기본
          미적용으로 표시됩니다 — 실제 정보라면 직접 켜주세요.
        </p>
      </div>

      {grouped.map(([kind, items]) => (
        <div key={kind} style={card}>
          <h3 style={{ fontSize: 15 }}>
            {KIND_LABELS[kind] ?? kind}{" "}
            <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
              {items.length}건
            </span>
          </h3>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((d) => (
              <li
                key={d.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  opacity: d.enabled || d.keepPlaintext ? 1 : 0.55,
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={d.enabled}
                    onChange={(e) => patch(d.id, { enabled: e.target.checked })}
                  />
                  <span style={{ wordBreak: "break-all", fontWeight: 600 }}>{d.raw}</span>
                </label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {d.dummyConfidence === "likely-dummy" && (
                  <span style={badge("#b45309", "#fef3c7")}>더미 추정</span>
                )}
                {d.dummyConfidence === "uncertain" && (
                  <span style={badge("#6b7280", "#f3f4f6")}>더미?</span>
                )}
                {d.source === "dictionary" && (
                  <span style={badge("#2563eb", "var(--primary-soft)")}>사전</span>
                )}
                {d.source === "manual" && (
                  <span style={badge("#16a34a", "#dcfce7")}>직접 추가</span>
                )}
                {d.isLegallyRequiredDisclosure && (
                  <span style={badge("#7c3aed", "#f3e8ff")}>
                    법정 고지 — 최종본 직접 입력
                  </span>
                )}
                {ENTITY_KINDS.includes(d.kind) && d.enabled && (
                  <>
                    <select
                      value={d.entityKind ?? "customer"}
                      onChange={(e) => {
                        const entityKind = e.target
                          .value as AnalysisTargetKind;
                        // 공개 등급 선택 = 유지 의사로 보고 기본 체크, 기밀은 강제 가림
                        patch(d.id, {
                          entityKind,
                          keepPlaintext: isPublicEntityKind(entityKind)
                            ? true
                            : false,
                        });
                      }}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        font: "inherit",
                        fontSize: 14,
                      }}
                    >
                      {(
                        Object.keys(ENTITY_KIND_LABELS) as AnalysisTargetKind[]
                      ).map((k) => (
                        <option key={k} value={k}>
                          {ENTITY_KIND_LABELS[k]}
                        </option>
                      ))}
                    </select>
                    {isPublicEntityKind(d.entityKind ?? "customer") && (
                      <label
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <input
                          type="checkbox"
                          checked={d.keepPlaintext ?? false}
                          onChange={(e) =>
                            patch(d.id, { keepPlaintext: e.target.checked })
                          }
                        />
                        <span style={{ color: "var(--text-muted)" }}>
                          실명 유지
                        </span>
                      </label>
                    )}
                  </>
                )}
                {d.kind === "url" &&
                  (() => {
                    const rule = classifyUrl(d.raw, keptBrandNames);
                    if (rule.reason === "internal-tool") {
                      return (
                        <span style={badge("#dc2626", "#fee2e2")}>
                          사내 협업툴 — 가림 확정
                        </span>
                      );
                    }
                    return (
                      <>
                        {rule.reason === "benchmark-source" && (
                          <span style={badge("#16a34a", "#dcfce7")}>
                            유지 후보 — 사례분석 출처
                          </span>
                        )}
                        {d.enabled && (
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={d.keepPlaintext ?? false}
                              onChange={(e) =>
                                patch(d.id, { keepPlaintext: e.target.checked })
                              }
                            />
                            <span style={{ color: "var(--text-muted)" }}>
                              유지 (공개 출처)
                            </span>
                          </label>
                        )}
                      </>
                    );
                  })()}
                {d.source !== "dictionary" &&
                  (["company", "client", "product", "personName"] as SensitiveKind[]).includes(d.kind) && (
                    <button
                      onClick={() =>
                        onAddToDictionary(
                          d.raw,
                          d.kind === "personName"
                            ? "person"
                            : (d.kind as DictionaryEntry["kind"]),
                        )
                      }
                      style={{
                        border: "1px solid var(--border)",
                        background: "transparent",
                        borderRadius: 6,
                        padding: "2px 8px",
                        color: "var(--text-muted)",
                      }}
                    >
                      항상 가리기
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {numericDetections.length > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: 15 }}>
            민감 수치{" "}
            <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
              {numericDetections.length}건 — 후보 탐지이며 최종 판단은
              검수로 확정합니다
            </span>
          </h3>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {numericDetections.map((n) => (
              <li
                key={n.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                <span style={{ flex: 1, minWidth: 200 }}>
                  {n.label && <b>{n.label} </b>}
                  {n.raw}
                </span>
                <span style={badge("#0e7490", "#cffafe")}>
                  {NUMERIC_KIND_LABELS[n.kind]}
                </span>
                <select
                  value={n.mode}
                  onChange={(e) =>
                    onUpdateNumeric(
                      numericDetections.map((x) =>
                        x.id === n.id
                          ? { ...x, mode: e.target.value as NumericMaskingMode }
                          : x,
                      ),
                    )
                  }
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    font: "inherit",
                    fontSize: 14,
                  }}
                >
                  <option value="exact-mask">정확 마스킹 (토큰)</option>
                  <option value="range-generalize">
                    범위 일반화 — {n.generalized ?? "규모 유지"}
                  </option>
                  <option value="keep">유지 (공개 확정)</option>
                </select>
              </li>
            ))}
          </ul>
          <p style={{ color: "var(--text-muted)" }}>
            범위 일반화는 &ldquo;수십억 원대&rdquo;처럼 규모감만 남깁니다 —
            기밀을 지키면서 AI가 맥락을 읽을 수 있습니다.
          </p>
        </div>
      )}

      <div style={card}>
        <h3 style={{ fontSize: 15 }}>단어 직접 추가</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={manualWord}
            onChange={(e) => setManualWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
            placeholder="가릴 단어 입력 (예: 회사명)"
            style={{
              flex: 1,
              minWidth: 200,
              padding: "8px 12px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              font: "inherit",
            }}
          />
          <select
            value={manualKind}
            onChange={(e) =>
              setManualKind(e.target.value as DictionaryEntry["kind"])
            }
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", font: "inherit" }}
          >
            {MANUAL_KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={manualToDict}
              onChange={(e) => setManualToDict(e.target.checked)}
            />
            사전에도 등록
          </label>
          <button
            onClick={handleManualAdd}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            추가
          </button>
        </div>
        {manualKind === "person" && manualToDict && (
          <p style={{ color: "var(--text-muted)" }}>
            인명은 전역 사전에 등록되어 앞으로 모든 프로젝트에서 자동 탐지됩니다.
          </p>
        )}
        {notice && <p style={{ color: "var(--primary)" }}>{notice}</p>}
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 15 }}>미리보기</h3>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={showOriginal}
              onChange={(e) => setShowOriginal(e.target.checked)}
            />
            원문 보기 (확정 시 원문은 즉시 폐기됩니다)
          </label>
        </div>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "inherit",
            background: "var(--bg)",
            borderRadius: 8,
            padding: 16,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {showOriginal ? parsedText : <TokenText text={preview} />}
        </pre>
      </div>

      <button
        onClick={onConfirm}
        style={{
          alignSelf: "flex-start",
          padding: "12px 24px",
          borderRadius: 10,
          border: "none",
          background: "var(--primary)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        다음
      </button>
    </div>
  );
}

function badge(color: string, bg: string): React.CSSProperties {
  return {
    fontSize: 14,
    fontWeight: 600,
    color,
    background: bg,
    borderRadius: 6,
    padding: "1px 8px",
  };
}
