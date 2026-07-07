"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import DictionaryManager from "./DictionaryManager";
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
  MaskingGroupSummary,
  NumericDetection,
  NumericMaskingMode,
  SensitiveKind,
} from "@/lib/masking/types";

// 마스킹 검수 화면 (phase1-masking-spec §8.3)
// 검수 중 ↔ 검수 완료를 같은 화면, 같은 카드 골격 안에서 confirmed로 전환한다.
// confirmed=true가 되는 시점에 상위(page.tsx)가 원문·Detection[](raw 포함)을
// 즉시 폐기하므로(CLAUDE.md §4.4), kind별 그룹 카드는 편집 UI 대신 상위가 미리
// 계산해 둔 maskingSummary(raw 없는 kind/개수/토큰)로 "적용/유지/제외" 요약만
// 접어서 보여준다 — 카드 자체(제목·순서·위치)는 사라지지 않는다.

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

const NUMERIC_KIND_SET = new Set<string>(Object.keys(NUMERIC_KIND_LABELS));

function summaryLine(g: MaskingGroupSummary): string {
  const parts: string[] = [];
  if (g.appliedCount > 0) parts.push(`${g.appliedCount}건 적용됨`);
  if (g.keptCount > 0) parts.push(`${g.keptCount}건 실명 유지`);
  if (g.skippedCount > 0) parts.push(`${g.skippedCount}건 제외됨`);
  return parts.length > 0 ? parts.join(" · ") : "처리된 항목 없음";
}

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
  parsedText: string; // ⚠️ 원문 — confirmed=false일 때만 쓰인다
  detections: Detection[];
  numericDetections: NumericDetection[];
  onUpdateDetections: (next: Detection[]) => void;
  onUpdateNumeric: (next: NumericDetection[]) => void;
  onAddToDictionary: (value: string, kind: DictionaryEntry["kind"]) => void;
  onConfirm: () => void;
  confirmed: boolean;
  maskedText?: string;
  maskingSummary?: MaskingGroupSummary[];
  onNext: () => void;
  recoveryKeyAction?: React.ReactNode;
  imageConsentPanel?: React.ReactNode;
}

export default function MaskingReview({
  parsedText,
  detections,
  numericDetections,
  onUpdateDetections,
  onUpdateNumeric,
  onAddToDictionary,
  onConfirm,
  confirmed,
  maskedText,
  maskingSummary,
  onNext,
  recoveryKeyAction,
  imageConsentPanel,
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

  const entitySummaryGroups = (maskingSummary ?? []).filter(
    (g) => !NUMERIC_KIND_SET.has(g.kind),
  );
  const numericSummaryGroups = (maskingSummary ?? []).filter((g) =>
    NUMERIC_KIND_SET.has(g.kind),
  );
  const totalApplied = (maskingSummary ?? []).reduce(
    (sum, g) => sum + g.appliedCount,
    0,
  );
  const totalSkipped = (maskingSummary ?? []).reduce(
    (sum, g) => sum + g.skippedCount,
    0,
  );

  const card: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-lg)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-md)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-base)" }}>
      {/* 상태 배너 — 검수 중 ↔ 완료 전환은 이 배너의 톤·문구만 바뀐다 (화면 구조는 유지) */}
      <div
        style={{
          ...card,
          padding: "var(--space-base) var(--space-lg)",
          background: confirmed ? "var(--success-weak-bg)" : "var(--primary-soft)",
          border: confirmed ? "1px solid var(--success)" : "1px solid var(--primary)",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-md)",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-xs)",
            fontSize: 14,
            fontWeight: 600,
            color: confirmed ? "var(--success)" : "var(--primary)",
          }}
        >
          {confirmed ? (
            <Check size={16} color="var(--success)" style={{ flexShrink: 0 }} />
          ) : (
            <ArrowRight size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
          )}
          {confirmed
            ? "마스킹 검수 완료 — 확정된 텍스트만 다음 단계로 전달됩니다"
            : "탐지된 항목을 확인하고 가릴지/유지할지 정한 뒤, 하단에서 마스킹을 확정하세요"}
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: confirmed ? "var(--success)" : "var(--primary)",
            background: "var(--surface)",
            borderRadius: "var(--radius-full)",
            padding: "4px 14px",
          }}
        >
          {confirmed ? `${totalApplied}건 적용됨` : `${enabledCount}건 적용 예정`}
        </span>
      </div>

      {!confirmed && (
        <div style={card}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>마스킹 검수</h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            민감정보 {detections.length}건 탐지됨 — 외부로는 마스킹된 텍스트만 전송됩니다.
          </p>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            <b>더미 추정</b> 항목은 기본 미적용입니다 — 실제 정보라면 직접 켜주세요.
          </p>
          <details>
            <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>
              보안 처리 방식 자세히
            </summary>
            <p style={{ fontSize: 14, color: "var(--text-muted)", paddingTop: "var(--space-sm)" }}>
              회사명은 기본 가림이며, 경쟁사·벤치마킹 브랜드처럼 분석에 필요한
              공개 엔티티만 &ldquo;유지&rdquo;로 바꾼 것만 실명으로 전송됩니다.
              확정 즉시 원문은 폐기되며, 이후에는 마스킹된 텍스트만 남습니다.
            </p>
          </details>
        </div>
      )}

      {!confirmed &&
        grouped.map(([kind, items]) => (
          <div key={kind} style={card}>
            <h3 style={{ fontSize: 16 }}>
              {KIND_LABELS[kind] ?? kind}{" "}
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                {items.length}건
              </span>
            </h3>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {items.map((d) => (
                <li
                  key={d.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-sm)",
                    padding: "10px var(--space-md)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    opacity: d.enabled || d.keepPlaintext ? 1 : 0.55,
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={(e) => patch(d.id, { enabled: e.target.checked })}
                    />
                    <span style={{ wordBreak: "break-all", fontWeight: 600 }}>{d.raw}</span>
                  </label>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                  {d.dummyConfidence === "likely-dummy" && (
                    <span style={badge("var(--warning-weak-text)", "var(--warning-weak-bg)")}>더미 추정</span>
                  )}
                  {d.dummyConfidence === "uncertain" && (
                    <span style={badge("var(--text-muted)", "var(--surface-alt)")}>더미?</span>
                  )}
                  {d.source === "dictionary" && (
                    <span style={badge("var(--primary-hover)", "var(--primary-weak-bg)")}>사전</span>
                  )}
                  {d.source === "manual" && (
                    <span style={badge("var(--on-primary)", "var(--success)")}>직접 추가</span>
                  )}
                  {d.isLegallyRequiredDisclosure && (
                    <span style={badge("var(--info)", "var(--info-weak-bg)")}>
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
                        className="select-box"
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
                          style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}
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
                          <span style={badge("var(--error-weak-text)", "var(--error-weak-bg)")}>
                            사내 협업툴 — 가림 확정
                          </span>
                        );
                      }
                      return (
                        <>
                          {rule.reason === "benchmark-source" && (
                            <span style={badge("var(--on-primary)", "var(--success)")}>
                              유지 후보 — 사례분석 출처
                            </span>
                          )}
                          {d.enabled && (
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--space-sm)",
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
                        className="btn-weak-primary"
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-md)",
                          padding: "4px 10px",
                          fontSize: 14,
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

      {confirmed &&
        entitySummaryGroups.map((g) => (
          <div key={g.kind} style={card}>
            <h3 style={{ fontSize: 16 }}>
              {KIND_LABELS[g.kind] ?? g.kind}{" "}
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                {g.totalCount}건
              </span>
            </h3>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              {summaryLine(g)}
            </p>
            {g.tokens.length > 0 && (
              <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                {g.tokens.map((t, i) => (
                  <span key={i} style={badge("var(--primary-hover)", "var(--primary-weak-bg)")}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

      {!confirmed && numericDetections.length > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: 16 }}>
            민감 수치{" "}
            <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
              {numericDetections.length}건 — 후보 탐지이며 최종 판단은
              검수로 확정합니다
            </span>
          </h3>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {numericDetections.map((n) => (
              <li
                key={n.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-md)",
                  flexWrap: "wrap",
                  padding: "10px var(--space-md)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <span style={{ flex: 1, minWidth: 200 }}>
                  {n.label && <b>{n.label} </b>}
                  {n.raw}
                </span>
                <span style={badge("var(--info)", "var(--info-weak-bg)")}>
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
                  className="select-box"
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
          <p style={{ fontSize: 16, color: "var(--text-muted)" }}>
            범위 일반화는 &ldquo;수십억 원대&rdquo;처럼 규모감만 남깁니다 —
            기밀을 지키면서 AI가 맥락을 읽을 수 있습니다.
          </p>
        </div>
      )}

      {confirmed && numericSummaryGroups.length > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: 16 }}>민감 수치</h3>
          {numericSummaryGroups.map((g) => (
            <div key={g.kind} style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              <p style={{ fontSize: 14, fontWeight: 600 }}>
                {NUMERIC_KIND_LABELS[g.kind as NumericDetection["kind"]] ?? g.kind}{" "}
                <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                  {g.totalCount}건
                </span>
              </p>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{summaryLine(g)}</p>
              {g.tokens.length > 0 && (
                <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                  {g.tokens.map((t, i) => (
                    <span key={i} style={badge("var(--info)", "var(--info-weak-bg)")}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!confirmed && (
        <div style={card}>
          <h3 style={{ fontSize: 16 }}>단어 직접 추가</h3>
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={manualKind}
              onChange={(e) =>
                setManualKind(e.target.value as DictionaryEntry["kind"])
              }
              className="select-box"
              style={{ width: 120, paddingTop: 10, paddingBottom: 10 }}
            >
              {MANUAL_KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              value={manualWord}
              onChange={(e) => setManualWord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
              placeholder="가릴 단어 입력 (예: 회사명)"
              className="input-box"
              style={{
                flex: 1,
                minWidth: 200,
                padding: "10px var(--space-md)",
                borderRadius: "var(--radius-md)",
                fontSize: 14,
                font: "inherit",
              }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <input
                type="checkbox"
                checked={manualToDict}
                onChange={(e) => setManualToDict(e.target.checked)}
              />
              사전에도 등록
            </label>
            <button
              onClick={handleManualAdd}
              className="btn-weak-primary"
              style={{
                padding: "10px var(--space-base)",
                borderRadius: "var(--radius-md)",
                border: "none",
                fontSize: 14,
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
          <DictionaryManager />
        </div>
      )}

      {confirmed && totalSkipped > 0 && (
        <p
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-xs)",
            color: "var(--warning-weak-text)",
            background: "var(--warning-weak-bg)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-sm) var(--space-md)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <AlertTriangle size={16} color="var(--warning-weak-text)" style={{ flexShrink: 0 }} />
          미적용 항목 {totalSkipped}건이 있습니다 (해제했거나 더미로 남긴 항목).
          원문 그대로 외부에 전송됩니다.
        </p>
      )}

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-sm)" }}>
          <h3 style={{ fontSize: 16 }}>
            {confirmed ? "마스킹된 텍스트 (외부로 나가는 유일한 텍스트)" : "미리보기"}
          </h3>
          {!confirmed && (
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <input
                type="checkbox"
                checked={showOriginal}
                onChange={(e) => setShowOriginal(e.target.checked)}
              />
              원문 임시 확인 (확정 시 즉시 폐기)
            </label>
          )}
        </div>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "inherit",
            background: "var(--bg)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-base)",
            maxHeight: confirmed ? 400 : 320,
            overflowY: "auto",
          }}
        >
          {confirmed ? (
            <TokenText text={maskedText ?? ""} />
          ) : showOriginal ? (
            parsedText
          ) : (
            <TokenText text={preview} />
          )}
        </pre>
        {confirmed && (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            원문은 폐기되었습니다. 복원 매핑은 세션 메모리에만 있으므로
            새로고침하면 실명 복원이 불가합니다 — 산출물은 먼저 다운로드하세요.
          </p>
        )}
      </div>

      {recoveryKeyAction}
      {imageConsentPanel}

      <button
        onClick={confirmed ? onNext : onConfirm}
        className="btn-primary"
        style={{
          alignSelf: "flex-start",
          padding: "12px var(--space-lg)",
          borderRadius: "var(--radius-md)",
          border: "none",
          fontWeight: 600,
          fontSize: 14,
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
    borderRadius: "var(--radius-full)",
    padding: "4px 10px",
  };
}
