"use client";

import { useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
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
  canAnalyze: boolean; // 마스킹 확정 후에만 true (재마스킹 시드 필요)
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
  canAnalyze,
  busy,
  error,
  onAnalyze,
}: ImageConsentPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // OCR 선마스킹 (Step 18) — 결과는 비민감 요약(findings)만 보관
  const [ocrResults, setOcrResults] = useState<Map<string, OcrScanResult>>(
    new Map(),
  );
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<[number, number]>();
  const [ocrError, setOcrError] = useState<string>();

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const insightFor = (id: string) =>
    insights.find((i) => i.assetId === id)?.maskedDescription;

  const runOcrScan = async () => {
    setOcrBusy(true);
    setOcrError(undefined);
    setOcrProgress([0, images.length]);
    try {
      const results = await scanImagesForSensitiveText(
        images.map((i) => ({ assetId: i.assetId, dataUrl: i.dataUrl })),
        listDictionary(),
        (done, total) => setOcrProgress([done, total]),
      );
      setOcrResults(new Map(results.map((r) => [r.assetId, r])));
      // 민감어가 감지된 이미지는 동의 체크를 자동 해제 (기본 제외)
      const flagged = new Set(
        results.filter((r) => r.findings.length > 0).map((r) => r.assetId),
      );
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of flagged) next.delete(id);
        return next;
      });
    } catch {
      setOcrError(
        "OCR 검사에 실패했습니다. (최초 실행은 엔진 다운로드로 오래 걸릴 수 있음)",
      );
    } finally {
      setOcrBusy(false);
      setOcrProgress(undefined);
    }
  };

  const describeFindings = (r: OcrScanResult) =>
    r.findings
      .map((f) => `${OCR_KIND_LABELS[f.kind] ?? f.kind} ${f.count}`)
      .join(" · ");

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        maxWidth: 860,
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
      }}
    >
      <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text)" }}>
        문서 속 이미지 {images.length}장 — 분석은 선택 사항입니다
      </h3>
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
          이미지 분석을 선택하면 해당 이미지가 Gemini로 전송됩니다. 무료
          Gemini는 데이터를 학습에 쓸 수 있으니,{" "}
          <b>민감한 이미지는 체크하지 마세요.</b> 기본값은 &ldquo;텍스트만
          분석&rdquo;이며 체크한 이미지만 전송됩니다. 분석 결과는 저장 전에
          마스킹 엔진을 한 번 더 통과합니다.
        </span>
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "var(--space-md)",
        }}
      >
        {images.map((img) => {
          const insight = insightFor(img.assetId);
          return (
            <div
              key={img.assetId}
              style={{
                border: `1px solid ${selected.has(img.assetId) ? "var(--primary)" : "var(--border)"}`,
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-sm)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-sm)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.dataUrl}
                alt={`이미지 ${img.assetId}`}
                style={{
                  width: "100%",
                  height: 110,
                  objectFit: "contain",
                  background: "var(--bg)",
                  borderRadius: "var(--radius-md)",
                }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                <input
                  type="checkbox"
                  checked={selected.has(img.assetId)}
                  disabled={busy || !!insight}
                  onChange={(e) => toggle(img.assetId, e.target.checked)}
                />
                <span style={{ fontSize: 14 }}>
                  분석 동의
                  {img.sourceSlide != null && ` · 슬라이드 ${img.sourceSlide}`}
                </span>
              </label>
              {(() => {
                const ocr = ocrResults.get(img.assetId);
                if (ocr && ocr.findings.length > 0) {
                  return (
                    <span style={badge("var(--error-weak-bg)", "var(--error-weak-text)")}>
                      OCR 민감어: {describeFindings(ocr)} — 기본 제외
                    </span>
                  );
                }
                if (ocr) {
                  return (
                    <span style={badge("rgba(16, 185, 129, 0.12)", "var(--success)")}>
                      {ocr.textLength === 0
                        ? "OCR: 글자 없음"
                        : "OCR: 민감어 미감지"}
                    </span>
                  );
                }
                return img.sensitivityHint === "possible" && !insight ? (
                  <span style={badge("var(--warning-weak-bg)", "var(--warning-weak-text)")}>
                    민감 가능성 — 확인 필요
                  </span>
                ) : null;
              })()}
              {insight && (
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  <TokenText text={insight} />
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-md)",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={runOcrScan}
          disabled={ocrBusy || busy || images.length === 0}
          className="btn-weak-primary"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-xs)",
            padding: "10px var(--space-base)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          <Search size={18} color="var(--text-body)" />
          {ocrBusy
            ? `OCR 검사 중… ${ocrProgress ? `(${ocrProgress[0]}/${ocrProgress[1]})` : ""}`
            : "전송 전 로컬 OCR 검사 — 이미지 속 민감어 확인 (브라우저에서만 실행)"}
        </button>
        <button
          onClick={() => onAnalyze([...selected])}
          disabled={busy || selected.size === 0 || !canAnalyze}
          className={
            busy || selected.size === 0 || !canAnalyze
              ? undefined
              : "btn-weak-primary"
          }
          style={{
            padding: "10px var(--space-base)",
            borderRadius: "var(--radius-md)",
            border: "none",
            background:
              busy || selected.size === 0 || !canAnalyze
                ? "var(--locked)"
                : undefined,
            color:
              busy || selected.size === 0 || !canAnalyze
                ? "var(--on-primary)"
                : undefined,
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {busy
            ? "이미지 분석 중…"
            : `동의한 ${selected.size}장 분석 (나머지는 전송 안 함)`}
        </button>
        {!canAnalyze && (
          <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
            마스킹 확정 후 분석할 수 있습니다.
          </span>
        )}
      </div>
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
    </div>
  );
}
