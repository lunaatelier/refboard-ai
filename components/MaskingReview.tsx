"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Info } from "lucide-react";
import DictionaryManager from "./DictionaryManager";
import PageLayout, { PageCta } from "./shell/PageLayout";
import TokenText from "./TokenText";
import { createDraft } from "@/lib/masking/apply";
import {
  ENTITY_KIND_LABELS,
  ENTITY_KIND_SHORT_LABELS,
  isPublicEntityKind,
} from "@/lib/masking/entity";
import { detectWordOccurrences } from "@/lib/masking/manual";
import { classifyUrl } from "@/lib/masking/urlRules";
import type {
  AnalysisTargetKind,
  Detection,
  DictionaryEntry,
  MaskingGroupSummary,
  MaskingTokenContext,
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

// 종류보다 "가릴지 유지할지"가 중요하므로, 인명/회사명/고객사/제품은 카드 하나
// ("민감정보")로 통합해서 보여준다. 나머지(이메일/전화/URL 등)는 kind별 유지.
const MERGED_ENTITY_KINDS: SensitiveKind[] = [
  "personName",
  "company",
  "client",
  "product",
];
const MERGED_GROUP_TITLE = "민감정보";
const MERGED_BUCKET = "merged";

function bucketFor(kind: SensitiveKind): string {
  return MERGED_ENTITY_KINDS.includes(kind) ? MERGED_BUCKET : kind;
}

function bucketTitle(bucket: string): string {
  if (bucket === MERGED_BUCKET) return MERGED_GROUP_TITLE;
  return KIND_LABELS[bucket as SensitiveKind] ?? bucket;
}

const NUMERIC_KIND_LABELS: Record<NumericDetection["kind"], string> = {
  financialMetric: "재무 수치",
  businessMetric: "비즈니스 지표",
  internalKpi: "내부 KPI",
};

const NUMERIC_KIND_SET = new Set<string>(Object.keys(NUMERIC_KIND_LABELS));

function summaryLine(
  g: Pick<MaskingGroupSummary, "appliedCount" | "keptCount" | "skippedCount">,
): string {
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
  hasImages?: boolean;
  imageOnlyAnalysisBlocked?: boolean;
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
  hasImages = false,
  imageOnlyAnalysisBlocked = false,
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

  // kind별로 묶은 뒤, 같은 kind 안에서도 같은 raw 값끼리 한 번 더 묶는다 —
  // "AI 인터렉션팀"이 3곳에서 발견돼도 검수 목록엔 한 줄("AI 인터렉션팀 3건")만
  // 보여주고, 그 줄에서의 조작(체크/유지 등)은 같은 값의 항목 전체에 적용한다.
  const grouped = useMemo(() => {
    const byBucket = new Map<string, Detection[]>();
    for (const d of detections) {
      const bucket = bucketFor(d.kind);
      byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), d]);
    }
    return [...byBucket.entries()].map(([bucket, items]) => {
      const byRaw = new Map<string, Detection[]>();
      for (const d of items) {
        byRaw.set(d.raw, [...(byRaw.get(d.raw) ?? []), d]);
      }
      return {
        bucket,
        title: bucketTitle(bucket),
        items,
        rawGroups: [...byRaw.values()],
      };
    });
  }, [detections]);

  const patchGroup = (ids: string[], p: Partial<Detection>) =>
    onUpdateDetections(
      detections.map((d) => (ids.includes(d.id) ? { ...d, ...p } : d)),
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

  // 확정 후 요약 카드도 검수 중과 동일하게 인명/회사명/고객사/제품을 "민감정보"
  // 하나로 합쳐서 보여준다 (bucketFor/bucketTitle — 검수 중 그룹핑과 동일 기준).
  const entitySummaryGroups = (() => {
    const raw = (maskingSummary ?? []).filter((g) => !NUMERIC_KIND_SET.has(g.kind));
    const byBucket = new Map<string, MaskingGroupSummary[]>();
    for (const g of raw) {
      const bucket = bucketFor(g.kind);
      byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), g]);
    }
    return [...byBucket.entries()].map(([bucket, groups]) => ({
      bucket,
      title: bucketTitle(bucket),
      totalCount: groups.reduce((sum, g) => sum + g.totalCount, 0),
      appliedCount: groups.reduce((sum, g) => sum + g.appliedCount, 0),
      keptCount: groups.reduce((sum, g) => sum + g.keptCount, 0),
      skippedCount: groups.reduce((sum, g) => sum + g.skippedCount, 0),
      tokens: groups.flatMap((g) => g.tokens),
      uncertainCount: groups.reduce((sum, g) => sum + g.uncertainCount, 0),
      uncertainKeptCount: groups.reduce((sum, g) => sum + g.uncertainKeptCount, 0),
      tokenContexts: groups.flatMap((g) => g.tokenContexts),
    }));
  })();
  const numericSummaryGroups = (maskingSummary ?? []).filter((g) =>
    NUMERIC_KIND_SET.has(g.kind),
  );
  const totalDetected = (maskingSummary ?? []).reduce(
    (sum, g) => sum + g.totalCount,
    0,
  );
  const totalApplied = (maskingSummary ?? []).reduce(
    (sum, g) => sum + g.appliedCount,
    0,
  );
  const totalKept = (maskingSummary ?? []).reduce(
    (sum, g) => sum + g.keptCount,
    0,
  );
  const totalSkipped = (maskingSummary ?? []).reduce(
    (sum, g) => sum + g.skippedCount,
    0,
  );
  // 경고는 무조건 뜨지 않는다 — "공개 유지"·"제외" 자체는 정상 상태다.
  // 아래 두 케이스(불확실+실명유지 / 미검토 불확실 항목)만 검토를 촉구한다.
  const uncertainKeptTotal = (maskingSummary ?? []).reduce(
    (sum, g) => sum + g.uncertainKeptCount,
    0,
  );
  const uncertainTotal = (maskingSummary ?? []).reduce(
    (sum, g) => sum + g.uncertainCount,
    0,
  );

  const card: React.CSSProperties = {
    background: "var(--canvas)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-lg)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-md)",
  };

  const warningLine: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-xs)",
    color: "var(--warning-weak-text)",
    background: "var(--warning-weak-bg)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-sm) var(--space-md)",
    fontSize: 14,
    fontWeight: 600,
  };

  const handleDownloadMaskedTxt = () => {
    if (!maskedText) return;
    const blob = new Blob([maskedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "마스킹본.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  // 상태 배너 — 검수 중 ↔ 완료 전환은 이 배너의 톤·문구만 바뀐다 (화면 구조는 유지)
  const statusBanner = (
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
          : "탐지 항목을 확인한 뒤 마스킹을 확정하세요."}
      </span>
      {confirmed ? (
        <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
          {[
            ["탐지됨", totalDetected],
            ["마스킹 적용", totalApplied],
            ["공개 유지", totalKept],
            ["제외", totalSkipped],
          ].map(([label, count]) => (
            <span
              key={label}
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--success)",
                background: "var(--canvas)",
                borderRadius: "var(--radius-full)",
                padding: "4px 12px",
                whiteSpace: "nowrap",
              }}
            >
              {label} {count}
            </span>
          ))}
        </div>
      ) : (
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--primary)",
            background: "var(--canvas)",
            borderRadius: "var(--radius-full)",
            padding: "4px 14px",
          }}
        >
          {`${enabledCount}건 적용 예정`}
        </span>
      )}
    </div>
  );

  return (
    <PageLayout title="마스킹 검수" banner={statusBanner}>
      {!confirmed && (
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          외부로는 마스킹된 텍스트만 전송됩니다.
        </p>
      )}

      {!confirmed &&
        grouped.map(({ bucket, title, items, rawGroups }) => (
          <div key={bucket} style={card}>
            <h3 style={{ fontSize: 18, fontWeight: 600 }}>
              {title}{" "}
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                {items.length}건
              </span>
            </h3>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {rawGroups.map((group) => {
                const d = group[0];
                const ids = group.map((g) => g.id);
                const count = group.length;
                const allEnabled = group.every((g) => g.enabled);
                return (
                <li
                  key={d.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-sm)",
                    padding: "10px var(--space-md)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    opacity: allEnabled || d.keepPlaintext ? 1 : 0.55,
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                    <input
                      type="checkbox"
                      checked={allEnabled}
                      onChange={(e) => patchGroup(ids, { enabled: e.target.checked })}
                    />
                    <span style={{ wordBreak: "break-all", fontWeight: 600 }}>
                      {d.raw}{" "}
                      <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                        {count}건
                      </span>
                    </span>
                  </label>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                  {d.dummyConfidence === "likely-dummy" && (
                    <span
                      title="더미 추정 항목은 기본 미적용입니다 — 실제 정보라면 체크해서 켜주세요"
                      style={badge("var(--warning-weak-text)", "var(--warning-weak-bg)")}
                    >
                      더미 추정
                    </span>
                  )}
                  {d.dummyConfidence === "uncertain" && (
                    <span
                      title="더미인지 확실하지 않은 항목입니다 — 실제 정보인지 확인해주세요"
                      style={badge("var(--text-muted)", "var(--surface-alt)")}
                    >
                      더미?
                    </span>
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
                  {ENTITY_KINDS.includes(d.kind) && allEnabled && (
                    <>
                      <select
                        value={d.entityKind ?? "customer"}
                        onChange={(e) => {
                          const entityKind = e.target
                            .value as AnalysisTargetKind;
                          // 공개 등급 선택 = 유지 의사로 보고 기본 체크, 기밀은 강제 가림
                          patchGroup(ids, {
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
                            {ENTITY_KIND_SHORT_LABELS[k]}
                          </option>
                        ))}
                      </select>
                      <span title={ENTITY_KIND_LABELS[d.entityKind ?? "customer"]}>
                        <Info size={16} color="var(--text-muted)" />
                      </span>
                      {isPublicEntityKind(d.entityKind ?? "customer") && (
                        <label
                          style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}
                        >
                          <input
                            type="checkbox"
                            checked={d.keepPlaintext ?? false}
                            onChange={(e) =>
                              patchGroup(ids, { keepPlaintext: e.target.checked })
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
                          {allEnabled && (
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
                                  patchGroup(ids, { keepPlaintext: e.target.checked })
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
                );
              })}
            </ul>
          </div>
        ))}

      {confirmed &&
        entitySummaryGroups.map((g) => (
          <div key={g.bucket} style={card}>
            <h3 style={{ fontSize: 18, fontWeight: 600, display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
              {g.title}{" "}
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                {g.totalCount}건
              </span>
              {g.uncertainKeptCount > 0 && (
                <span
                  title="더미인지 확실하지 않은데 실명 유지로 확정됐습니다"
                  style={badge("var(--error-weak-text)", "var(--error-weak-bg)")}
                >
                  불확실+실명유지 {g.uncertainKeptCount}
                </span>
              )}
              {g.uncertainCount - g.uncertainKeptCount > 0 && (
                <span style={badge("var(--warning-weak-text)", "var(--warning-weak-bg)")}>
                  검토 필요 {g.uncertainCount - g.uncertainKeptCount}
                </span>
              )}
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
            {tokenContextAccordion(g.tokenContexts)}
          </div>
        ))}

      {!confirmed && numericDetections.length > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>
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
                  <option value="exact-mask">마스킹</option>
                  <option value="range-generalize">일반화</option>
                  <option value="keep">유지</option>
                </select>
                <span
                  title={
                    "마스킹: 수치를 통째로 가림(예: [투자금])\n" +
                    "일반화: 정확한 수치 대신 규모감만 표시" +
                    (n.mode === "range-generalize" && n.generalized
                      ? ` (예: ${n.generalized})`
                      : "") +
                    "\n유지: 이미 공개된 수치로 확정한 경우만 원문 그대로 전송"
                  }
                >
                  <Info size={16} color="var(--text-muted)" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {confirmed && numericSummaryGroups.length > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>민감 수치</h3>
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
              {tokenContextAccordion(g.tokenContexts)}
            </div>
          ))}
        </div>
      )}

      {/* 순서: 민감정보 → 민감 수치(위) → 단어 추가 → 이미지 분석 → 미리보기.
          미리보기는 항상 실시간 반영이라 어디에 있든 최신 상태를 보여준다 —
          여기서는 "지금까지 정리한 걸 최종 확인"하는 위치로 맨 끝에 둔다. */}
      {!confirmed && (
        <div style={card}>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>단어 추가</h3>
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

      {imageConsentPanel}

      {/* 경고는 "공개 유지"·"제외"가 있다고 무조건 뜨지 않는다 — 그 개수는 위
          상태 배너에 이미 나온다. 여기선 실제로 재확인이 필요한 두 경우만 뜬다. */}
      {confirmed && uncertainKeptTotal > 0 && (
        <p role="alert" style={warningLine}>
          <AlertTriangle size={16} color="var(--warning-weak-text)" style={{ flexShrink: 0 }} />
          더미인지 확실하지 않은 항목 {uncertainKeptTotal}건이 실명 유지로 확정됐습니다.
          아래 그룹에서 다시 확인하세요.
        </p>
      )}
      {confirmed && uncertainTotal - uncertainKeptTotal > 0 && (
        <p role="alert" style={warningLine}>
          <AlertTriangle size={16} color="var(--warning-weak-text)" style={{ flexShrink: 0 }} />
          더미인지 확실하지 않아 검토가 필요한 항목이 {uncertainTotal - uncertainKeptTotal}건
          있습니다.
        </p>
      )}

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-sm)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>
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
          {confirmed && (
            <button
              onClick={handleDownloadMaskedTxt}
              className="btn-tertiary"
              style={{
                padding: "6px var(--space-md)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              마스킹본 TXT 다운로드
            </button>
          )}
        </div>
        {confirmed ? (
          <details className="accordion-row">
            <summary style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}>
              전체 텍스트 펼쳐보기
            </summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "inherit",
                background: "var(--surface)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-base)",
                marginTop: "var(--space-sm)",
                maxHeight: 400,
                overflowY: "auto",
              }}
            >
              <TokenText text={maskedText ?? ""} />
            </pre>
          </details>
        ) : (
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "inherit",
              background: "var(--surface)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-base)",
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {showOriginal ? parsedText : <TokenText text={preview} />}
          </pre>
        )}
        {confirmed && (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            원문은 폐기되었습니다. 복원 매핑은 세션 메모리에만 있으므로
            새로고침하면 실명 복원이 불가합니다 — 산출물은 먼저 다운로드하세요.
          </p>
        )}
      </div>

      {recoveryKeyAction}

      {/* 분석 실행 CTA (실사용#9, 2026-07-11 레이아웃 확정) — 별도 섹션 타이틀·박스
          없이 한 행에 좌(안내문구)/우(버튼)로 배치한다. */}
      {hasImages && !imageOnlyAnalysisBlocked && (
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          이미지 분석은 선택 사항입니다. 선택하지 않으면 텍스트만 분석합니다.
        </p>
      )}
      {imageOnlyAnalysisBlocked && (
        <p
          role="alert"
          style={{
            color: "var(--warning-weak-text)",
            background: "var(--warning-weak-bg)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-sm) var(--space-md)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          이미지 전용 입력은 본문 텍스트가 없어 이미지 분석 요약이 필요합니다.
          위의 이미지 분석에서 이미지를 선택해 먼저 분석하세요.
        </p>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-base)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
          <Info size={16} color="var(--text-muted)" />
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
            외부로는 마스킹본과 &ldquo;유지&rdquo;로 확정한 공개 엔티티 실명만
            전송됩니다. 확정 후 분석이 시작됩니다.
          </span>
        </div>
        <PageCta
          onClick={confirmed ? onNext : onConfirm}
          disabled={imageOnlyAnalysisBlocked}
          locked={imageOnlyAnalysisBlocked}
        >
          {confirmed
            ? "분석 결과로 이동"
            : imageOnlyAnalysisBlocked
              ? "이미지 분석 후 진행"
              : "마스킹 확정하고 분석"}
        </PageCta>
      </div>
    </PageLayout>
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

function tokenKindLabel(kind: SensitiveKind): string {
  return (
    KIND_LABELS[kind] ??
    NUMERIC_KIND_LABELS[kind as NumericDetection["kind"]] ??
    kind
  );
}

// 토큰별 컨텍스트(정보 종류·슬라이드·발생횟수·마스킹된 문장) — 기본 닫힘 아코디언.
function tokenContextAccordion(tokenContexts: MaskingTokenContext[]) {
  if (tokenContexts.length === 0) return null;
  return (
    <details className="accordion-row">
      <summary
        style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}
      >
        토큰별 상세 ({tokenContexts.length}개)
      </summary>
      <ul
        style={{
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-xs)",
          marginTop: "var(--space-sm)",
        }}
      >
        {tokenContexts.map((tc, i) => (
          <li
            key={`${tc.token}-${i}`}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "8px var(--space-md)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
              <span style={badge("var(--primary-hover)", "var(--primary-weak-bg)")}>{tc.token}</span>
              <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
                {tokenKindLabel(tc.kind)}
                {tc.slide != null && ` · 슬라이드 ${tc.slide}`}
                {` · ${tc.occurrenceCount}회 등장`}
              </span>
            </div>
            <p style={{ fontSize: 14, color: "var(--text-muted)", wordBreak: "break-word" }}>
              {tc.maskedExcerpt}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}
