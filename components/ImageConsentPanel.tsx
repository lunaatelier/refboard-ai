"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { listDictionary } from "@/lib/dictionary/store";
import type { SensitiveKind } from "@/lib/masking/types";
import {
  scanImagesForSensitiveText,
  type OcrScanResult,
} from "@/lib/ocr/scan";
import TokenText from "./TokenText";

// 이미지 opt-in 동의 (Step 9, flow-spec ①)
// 기본값 = 텍스트만. 체크(동의)한 이미지만 Gemini 멀티모달로 전송된다.
// Step 18: 전송 전 로컬 OCR 검사 — 민감어 감지 이미지는 자동 체크 해제 + 경고 배지.
// 버튼은 하나: "선택한 N장 분석"을 누르면 선택된 이미지만 먼저 로컬 OCR을
// 통과시키고, 문제 없으면 그대로 이어서 분석(Gemini 전송)까지 한 번에 진행한다
// — OCR과 분석을 별개 버튼으로 나누지 않는다(사용자 혼란 방지).

const OCR_KIND_LABELS: Partial<Record<SensitiveKind, string>> = {
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

export interface ConsentImage {
  assetId: string;
  dataUrl: string;
  sourceSlide?: number;
  sensitivityHint: "none" | "possible" | "high";
}

export interface ImageInsight {
  assetId: string;
  maskedDescription: string;
}

interface ImageConsentPanelProps {
  images: ConsentImage[];
  insights: ImageInsight[];
  busy: boolean;
  error?: string;
  onAnalyze: (assetIds: string[]) => void;
}

const badge = (bg: string, color: string): React.CSSProperties => ({
  fontSize: 14,
  fontWeight: 600,
  color,
  background: bg,
  borderRadius: "var(--radius-full)",
  padding: "4px 10px",
  alignSelf: "flex-start",
});

export default function ImageConsentPanel({
  images,
  insights,
  busy,
  error,
  onAnalyze,
}: ImageConsentPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // OCR 선마스킹 (Step 18) — 결과는 비민감 요약(findings)만 보관.
  // "분석" 버튼 한 번으로 선택한 이미지만 OCR → 문제 없으면 바로 분석까지 이어간다.
  const [ocrResults, setOcrResults] = useState<Map<string, OcrScanResult>>(
    new Map(),
  );
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<[number, number]>();
  const [ocrError, setOcrError] = useState<string>();
  const [excludedNotice, setExcludedNotice] = useState<string>();

  const toggle = (id: string, on: boolean) => {
    setExcludedNotice(undefined);
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const insightFor = (id: string) =>
    insights.find((i) => i.assetId === id)?.maskedDescription;

  const describeFindings = (r: OcrScanResult) =>
    r.findings
      .map((f) => `${OCR_KIND_LABELS[f.kind] ?? f.kind} ${f.count}`)
      .join(" · ");

  const handleAnalyze = async () => {
    const targets = images.filter((i) => selected.has(i.assetId));
    if (targets.length === 0) return;
    setExcludedNotice(undefined);
    setOcrError(undefined);
    setOcrBusy(true);
    setOcrProgress([0, targets.length]);
    try {
      const results = await scanImagesForSensitiveText(
        targets.map((i) => ({ assetId: i.assetId, dataUrl: i.dataUrl })),
        listDictionary(),
        (done, total) => setOcrProgress([done, total]),
      );
      setOcrResults((prev) => {
        const next = new Map(prev);
        for (const r of results) next.set(r.assetId, r);
        return next;
      });

      const blocked = results.filter((r) => r.failed || r.findings.length > 0);
      if (blocked.length > 0) {
        setSelected((prev) => {
          const next = new Set(prev);
          for (const r of blocked) next.delete(r.assetId);
          return next;
        });
        const flaggedCount = blocked.filter((r) => !r.failed).length;
        const failedCount = blocked.filter((r) => r.failed).length;
        const remaining = targets.length - blocked.length;
        const reasons = [
          flaggedCount > 0 ? `민감어 감지 ${flaggedCount}장` : null,
          failedCount > 0 ? `OCR 실패 ${failedCount}장` : null,
        ].filter(Boolean);
        setExcludedNotice(
          `${reasons.join(" · ")} — 선택에서 제외했습니다.` +
            (remaining > 0
              ? ` 나머지 ${remaining}장을 분석하려면 다시 눌러주세요.`
              : ""),
        );
        return;
      }

      onAnalyze(targets.map((i) => i.assetId));
    } catch {
      setOcrError(
        "OCR 검사에 실패했습니다. (최초 실행은 엔진 다운로드로 오래 걸릴 수 있음)",
      );
    } finally {
      setOcrBusy(false);
      setOcrProgress(undefined);
    }
  };

  const analyzeDisabled = busy || ocrBusy || selected.size === 0;
  const analyzeLabel = busy
    ? "분석 중…"
    : ocrBusy
      ? `OCR 검사 중…${ocrProgress ? ` (${ocrProgress[0]}/${ocrProgress[1]})` : ""}`
      : selected.size > 0
        ? `선택한 ${selected.size}장 분석`
        : "선택한 이미지 분석";

  const renderStatus = (ocr?: OcrScanResult) => {
    if (ocr) {
      if (ocr.failed) {
        return (
          <span
            title="이 이미지는 OCR 인식에 실패했습니다 — 다시 검사해주세요"
            style={badge("var(--warning-weak-bg)", "var(--warning-weak-text)")}
          >
            OCR 실패
          </span>
        );
      }
      if (ocr.findings.length > 0) {
        return (
          <span
            title={`OCR 민감어: ${describeFindings(ocr)} — 기본 제외`}
            style={badge("var(--error-weak-bg)", "var(--error-weak-text)")}
          >
            민감어 감지
          </span>
        );
      }
      return (
        <span
          title={ocr.textLength === 0 ? "OCR: 글자 없음" : "OCR: 민감어 미감지"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            borderRadius: "var(--radius-full)",
            background: "rgba(16, 185, 129, 0.12)",
            flexShrink: 0,
          }}
        >
          <Check size={12} color="var(--success)" />
        </span>
      );
    }
    return (
      <span style={badge("var(--surface-alt)", "var(--text-muted)")}>
        OCR 필요
      </span>
    );
  };

  return (
    <div
      style={{
        background: "var(--canvas)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "inherit",
          font: "inherit",
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)" }}>
          이미지 분석{" "}
          <span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)" }}>
            (선택 사항)
          </span>
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--primary)",
            flexShrink: 0,
          }}
        >
          {expanded ? "접기" : "펼치기"}
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {expanded && (
        <>
          <p
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--space-sm)",
              color: "var(--warning-weak-text)",
              background: "var(--warning-weak-bg)",
              border: "1px solid var(--warning)",
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
              fontSize: 14,
            }}
          >
            <AlertTriangle
              size={18}
              color="var(--warning-weak-text)"
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <span>
              이미지 분석은 선택한 이미지만 Gemini로 전송됩니다. 민감한
              이미지는 선택하지 마세요.
            </span>
          </p>
          <details>
            <summary
              style={{
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-muted)",
              }}
            >
              자세히 보기
            </summary>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                paddingTop: "var(--space-xs)",
              }}
            >
              무료 Gemini는 데이터를 학습에 쓸 수 있습니다. 기본값은
              &ldquo;텍스트만 분석&rdquo;이며 체크한 이미지만 전송되고, 분석
              결과는 저장 전에 마스킹 엔진을 한 번 더 통과합니다.
            </p>
          </details>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "var(--space-md)",
            }}
          >
            {images.map((img) => {
              const insight = insightFor(img.assetId);
              const ocr = ocrResults.get(img.assetId);
              const isSelected = selected.has(img.assetId);
              return (
                <div
                  key={img.assetId}
                  style={{
                    border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                    background: isSelected
                      ? "var(--primary-weak-bg)"
                      : "var(--canvas)",
                    borderRadius: "var(--radius-lg)",
                    padding: "var(--space-sm)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-xs)",
                  }}
                >
                  <div style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.dataUrl}
                      alt={`이미지 ${img.assetId}`}
                      style={{
                        width: "100%",
                        height: 110,
                        objectFit: "contain",
                        background: "var(--surface)",
                        borderRadius: "var(--radius-md)",
                        display: "block",
                      }}
                    />
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={busy || ocrBusy || !!insight}
                      onChange={(e) => toggle(img.assetId, e.target.checked)}
                      style={{
                        position: "absolute",
                        top: 6,
                        left: 6,
                        width: 18,
                        height: 18,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "var(--space-xs)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: "var(--text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {img.sourceSlide != null
                        ? `슬라이드 ${img.sourceSlide}`
                        : img.assetId}
                    </span>
                    {!insight && renderStatus(ocr)}
                  </div>
                  {insight && (
                    <p
                      title={insight}
                      style={{
                        fontSize: 13,
                        color: "var(--text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <TokenText text={insight} />
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>
            {selected.size}장 선택됨
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-md)",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={handleAnalyze}
              disabled={analyzeDisabled}
              className={analyzeDisabled ? undefined : "btn-weak-primary"}
              style={{
                padding: "10px var(--space-base)",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: analyzeDisabled ? "var(--locked)" : undefined,
                color: analyzeDisabled ? "var(--on-primary)" : undefined,
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {analyzeLabel}
            </button>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {selected.size === 0
              ? "이미지를 선택하면 분석할 수 있습니다."
              : "선택한 이미지를 브라우저에서 먼저 검사한 뒤, 문제가 없으면 그대로 Gemini로 전송해 분석합니다."}
          </p>
          {excludedNotice && (
            <p
              role="alert"
              style={{ color: "var(--warning-weak-text)", fontWeight: 600, fontSize: 14 }}
            >
              {excludedNotice}
            </p>
          )}
          {ocrError && (
            <p role="alert" style={{ color: "var(--error-weak-text)", fontWeight: 600, fontSize: 14 }}>
              {ocrError}
            </p>
          )}
          {error && (
            <p role="alert" style={{ color: "var(--error-weak-text)", fontWeight: 600, fontSize: 14 }}>
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
