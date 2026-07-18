"use client";

import { useEffect, useRef, useState } from "react";
import { Key, Save } from "lucide-react";
import AnalysisResult from "@/components/AnalysisResult";
import { describeScope } from "@/components/DirectiveEditor";
import ImageConsentPanel, {
  type ConsentImage,
  type ImageInsight,
} from "@/components/ImageConsentPanel";
import ConceptWorkspace from "@/components/concept/ConceptWorkspace";
import ReferenceWorkspace from "@/components/reference/ReferenceWorkspace";
import MaskingReview from "@/components/MaskingReview";
import LandingUpload from "@/components/shell/LandingUpload";
import PageLayout, {
  ErrorState,
  LoadingState,
  pageCardStyle,
} from "@/components/shell/PageLayout";
import Workspace from "@/components/shell/Workspace";
import { classifyDocumentPurpose } from "@/lib/analysis/documentPurpose";
import { addDictionaryEntry, listDictionary } from "@/lib/dictionary/store";
import { buildConfirmedBrief } from "@/lib/reference/confirmBrief";
import {
  loadWorkflowSnapshot,
  saveWorkflowSnapshot,
} from "@/lib/state/persistence";
import { finalizeMask, summarizeMasking } from "@/lib/masking/apply";
import { detect } from "@/lib/masking/detect";
import { maskFileName } from "@/lib/masking/filename";
import { detectNumeric } from "@/lib/masking/numeric";
import { remaskText } from "@/lib/masking/remask";
import { restore } from "@/lib/masking/restore";
import type {
  Detection,
  LabeledEntityCandidate,
  MaskMapping,
  NumericDetection,
} from "@/lib/masking/types";
import {
  fileToBase64,
  IMAGE_ONLY_PLACEHOLDER,
  imageMimeType,
  isImageFile,
} from "@/lib/parse/image";
import type { PptxImage } from "@/lib/parse/pptx";
import { parseViaServer } from "@/lib/parse/server";
import { isBrowserParsable, parseTextFile } from "@/lib/parse/txt";
import { canAccessStep } from "@/lib/state/guards";
import {
  buildAnalysisExport,
  isAnalysisJsonFile,
  parseAnalysisImport,
} from "@/lib/state/recycle";
import { confirmSelectedSections } from "@/lib/analysis/confirm";
import {
  buildRecoveryKeyExport,
  parseRecoveryKeyImport,
} from "@/lib/state/recoveryKey";
import {
  initialWorkflowState,
  STEP_LABELS,
  type Step,
  type WorkflowState,
} from "@/lib/state/workflow";

// 검수 중 임시 상태 — 원문(parsedText)과 raw 포함 Detection[].
// ⚠️ 민감 등급: 이 상태는 확정 즉시 통째로 폐기된다. 영속화·전송 절대 금지.
interface DraftState {
  parsedText: string;
  detections: Detection[];
  numericDetections: NumericDetection[];
}

export default function Home() {
  const [workflow, setWorkflow] = useState<WorkflowState>(initialWorkflowState);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [fileDisplayName, setFileDisplayName] = useState<string>();

  // SecureClientMemory — 복원키. 메모리에만 존재, 새로고침 시 소멸 (CLAUDE.md §4.4).
  // React 상태가 아닌 ref: 렌더 데이터로 흘러들어가는 것을 구조적으로 차단.
  const secureMappingsRef = useRef<MaskMapping[]>([]);
  // secureMappingsRef가 어느 문서(exportId)의 복원키인지 추적 — 다른 프로젝트의 분석
  // JSON을 올렸을 때 이전 문서의 복원키가 잘못 재사용되는 것을 막기 위한 비민감 식별자.
  const lastMaskedExportIdRef = useRef<string | undefined>(undefined);
  // 재활용 모드에서 현재 불러온 분석 JSON의 exportId — 복원키 파일 가져오기 시 짝 검증용.
  const importedExportIdRef = useRef<string | undefined>(undefined);
  // 복원키 가져오기 결과 안내 (비민감 텍스트만) — 상태 변경으로 재렌더도 유발.
  const [recoveryNotice, setRecoveryNotice] = useState<{
    tone: "info" | "warn";
    text: string;
  }>();

  // 안전한 워크플로 상태 자동 저장/복구 (§6.6) — maskedText는 대상이 아니라 재분석·
  // 마스킹 재편집이 필요하면 원본을 다시 업로드해야 한다. 마운트 시 한 번만 복구를
  // 시도하고, 그 시도가 끝나기 전까지는 자동 저장을 보류해 초기 빈 상태로 기존
  // 저장분을 덮어쓰지 않는다.
  const hasAttemptedRestoreRef = useRef(false);
  const [restoreNotice, setRestoreNotice] = useState<string>();

  // 문서 속 이미지 원본 (Step 9) — 원문급 민감. 메모리에만, opt-in 동의분만 외부 전송.
  const imagesRef = useRef<(PptxImage & { sensitivityHint: "none" | "possible" })[]>([]);
  const [imageInsights, setImageInsights] = useState<ImageInsight[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string>();

  const [uploadError, setUploadError] = useState<string>();
  // 분석 JSON 재활용 경로 오류 — 문서 업로드 오류와 표시 위치가 다르다(JSON 행 아래).
  const [jsonImportError, setJsonImportError] = useState<string>();
  const [parsing, setParsing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>();
  // 레퍼런스 확정 시 ConfirmedReferenceBrief 스냅샷 생성 실패 안내 (P9-A 배선)
  const [confirmBriefError, setConfirmBriefError] = useState<string>();

  // 편집 중 빈 행은 상태에 남되, 프롬프트·하위 컴포넌트로는 내용 있는 지시만 전달
  const activeDirectives = (workflow.projectDirective ?? []).filter((d) =>
    d.text.trim(),
  );

  const handleFile = async (file: File) => {
    setUploadError(undefined);
    setJsonImportError(undefined);

    // ── 재활용 모드 (Step 13): 분석 JSON → 마스킹·분석 건너뛰고 ④ 직행 ──
    if (isAnalysisJsonFile(file.name)) {
      try {
        const data = parseAnalysisImport(await file.text());
        // secureMappingsRef는 "이 세션에서 방금 저장한 바로 그 JSON"으로 exportId가
        // 정확히 일치할 때만 유지한다(같은세션 재활용 = 실명본 가능). 그 외에는
        // 다른 문서의 복원키가 새 문서에 잘못 적용되는 것을 막기 위해 항상 초기화한다.
        if (!data.exportId || data.exportId !== lastMaskedExportIdRef.current) {
          secureMappingsRef.current = [];
        }
        // 복원키 파일 가져오기(Step 14) 시 이 값과 exportId가 일치해야 복구 허용
        importedExportIdRef.current = data.exportId;
        setRecoveryNotice(undefined);
        imagesRef.current = [];
        setImageInsights([]);
        setDraft(null);
        setWorkflow({
          currentStep: "reference",
          completedSteps: ["upload", "masking", "analysis"],
          sourceType: "analysis-json",
          analysis: data.analysis,
          extractedAnalysisTargets: data.extractedAnalysisTargets,
          projectDirective:
            data.projectDirective.length > 0
              ? data.projectDirective
              : undefined,
          documentPurpose: data.documentPurpose,
        });
      } catch (e) {
        setJsonImportError(
          e instanceof Error ? e.message : "분석 JSON을 읽지 못했습니다.",
        );
      }
      return;
    }

    // ── 단일 이미지/클립보드 캡처 (Step 16): 텍스트 없음 → 플레이스홀더로 마스킹
    // 게이트 통과, 이미지는 기존 opt-in 동의·재마스킹 경로(Step 9)를 그대로 탄다.
    // 이미지 바이트는 브라우저 메모리에만 — 자사 서버에도 안 올라간다.
    if (isImageFile(file.name)) {
      try {
        imagesRef.current = [
          {
            assetId: "img-1",
            mimeType: imageMimeType(file.name),
            base64: await fileToBase64(file),
            // 단독 이미지는 내용을 모르니 항상 "민감 가능성 있음"으로 표시 (보수적 기본값)
            sensitivityHint: "possible",
          },
        ];
      } catch {
        setUploadError("이미지를 읽지 못했습니다.");
        return;
      }
      setImageInsights([]);
      setImageError(undefined);
      setDraft({
        parsedText: IMAGE_ONLY_PLACEHOLDER,
        detections: [],
        numericDetections: [],
      });
      setFileDisplayName(maskFileName(file.name, listDictionary()).displayName);
      setWorkflow({
        currentStep: "masking",
        completedSteps: ["upload"],
        sourceType: "raw-document",
      });
      secureMappingsRef.current = [];
      lastMaskedExportIdRef.current = undefined;
      importedExportIdRef.current = undefined;
      setRecoveryNotice(undefined);
      return;
    }

    setParsing(true);
    let text: string;
    let labeledEntities: LabeledEntityCandidate[] = [];
    try {
      // txt/md = 브라우저 파싱(원문이 PC를 안 떠남) / pdf·pptx = 자사 서버(메모리·무저장)
      if (isBrowserParsable(file.name)) {
        text = await parseTextFile(file);
        imagesRef.current = [];
      } else {
        const parsed = await parseViaServer(file);
        text = parsed.text;
        labeledEntities = parsed.labeledEntities;
        // 민감 가능성 힌트: 해당 슬라이드 텍스트에 개인정보성 키워드가 있으면 표시
        imagesRef.current = parsed.images.map((img) => ({
          ...img,
          sensitivityHint: slideHasSensitiveHint(text, img.sourceSlide)
            ? "possible"
            : "none",
        }));
      }
      setImageInsights([]);
      setImageError(undefined);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "파싱에 실패했습니다.");
      setParsing(false);
      return;
    }
    setParsing(false);
    if (!text.trim()) {
      setUploadError("추출된 텍스트가 없습니다. 텍스트가 포함된 문서인지 확인하세요.");
      return;
    }
    // 원본 파일명도 마스킹 (실사용#32) — 화면에는 displayName만
    beginMaskingDraft(
      text,
      maskFileName(file.name, listDictionary()).displayName,
      labeledEntities,
    );
  };

  // 텍스트 원문으로 마스킹 검수를 시작하는 공통 경로 (파일 업로드·링크 입력 공용).
  // 재시작 = 새 워크플로 (이전 분석·레퍼런스·컨셉·복원키 전부 무효화)
  // labeledEntities = 표 헤더 라벨(작성자/소속 등) 기반 자동 탐지 후보 (pptx 전용, Step 5 확장)
  const beginMaskingDraft = (
    text: string,
    displayName: string,
    labeledEntities: LabeledEntityCandidate[] = [],
  ) => {
    const dictionary = listDictionary();
    const detections = detect(text, dictionary, labeledEntities);
    setDraft({
      parsedText: text,
      detections,
      numericDetections: detectNumeric(text, detections),
    });
    setFileDisplayName(displayName);
    // 문서 성격 판정 (Step 8, 실사용#14) — 마스킹 전 원문이므로 로컬 휴리스틱만 사용
    const { purpose } = classifyDocumentPurpose(text);
    setWorkflow({
      currentStep: "masking",
      completedSteps: ["upload"],
      sourceType: "raw-document",
      documentPurpose: purpose,
    });
    secureMappingsRef.current = [];
    lastMaskedExportIdRef.current = undefined;
    importedExportIdRef.current = undefined;
    setRecoveryNotice(undefined);
  };

  // 링크 입력 (Step 17) — 공개 링크의 정적 텍스트를 서버에서 추출해 온다.
  // 추출 텍스트는 파일 업로드와 똑같이 원문 취급 → 마스킹 게이트 통과 필수.
  const handleLink = async (url: string) => {
    setUploadError(undefined);
    setParsing(true);
    try {
      const res = await fetch("/api/fetch-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || typeof body?.text !== "string") {
        throw new Error(body?.error ?? "링크에서 텍스트를 가져오지 못했습니다.");
      }
      if (!body.text.trim()) {
        setUploadError(
          "링크에서 추출된 텍스트가 없습니다. 스크립트로 그려지는 페이지(V0 미리보기 등)라면 화면을 캡처해 붙여넣어 주세요.",
        );
        return;
      }
      imagesRef.current = [];
      setImageInsights([]);
      setImageError(undefined);
      beginMaskingDraft(body.text, `링크: ${new URL(url).hostname}`);
    } catch (e) {
      setUploadError(
        e instanceof Error ? e.message : "링크 처리에 실패했습니다.",
      );
    } finally {
      setParsing(false);
    }
  };

  const handleNavigate = (target: Step) => {
    // UI 잠금(버튼 disabled)과 별개로 로직에서도 가드 검증 (이중 방어)
    setWorkflow((prev) =>
      canAccessStep(target, prev) ? { ...prev, currentStep: target } : prev,
    );
  };

  const handleConfirmMasking = () => {
    if (!draft) return;
    // 이미지 분석이 텍스트 확정보다 먼저 실행됐다면(이제 순서 제약이 없어짐)
    // secureMappingsRef에 이미 매핑이 쌓여있을 수 있다 — 시드로 넘겨 덮어쓰지
    // 않고 이어받는다. 토큰 할당은 (kind, raw) 기준 결정적이라 같은 항목은
    // 항상 같은 토큰을 받으므로 순서가 바뀌어도 안전하다.
    const { maskedText, mappings } = finalizeMask(
      draft.parsedText,
      draft.detections,
      draft.numericDetections,
      secureMappingsRef.current,
    );

    // 복원키 → SecureClientMemory (WorkflowState 아님)
    secureMappingsRef.current = mappings;
    // 새로 마스킹된 문서이므로 이전에 저장했던 exportId와의 연결은 무효화
    lastMaskedExportIdRef.current = undefined;

    // raw를 폐기하기 전, kind별 비민감 요약(개수·토큰만)을 만들어 검수 카드
    // 골격을 그대로 유지한 채 완료 상태로 접을 수 있게 한다.
    const maskingSummary = summarizeMasking(
      draft.parsedText,
      draft.detections,
      draft.numericDetections,
      mappings,
    );

    setWorkflow((prev) => ({
      ...prev,
      maskedText,
      maskingSummary,
      // "유지"로 확정된 공개 엔티티 → ④ 분석 대상 브랜드 소스 (실명 = 공개 정보)
      // 엔티티 등급(6종)은 검수 드롭다운에서 사용자가 확정한 값을 계승.
      extractedAnalysisTargets: draft.detections
        .filter(
          (d) =>
            d.enabled &&
            d.keepPlaintext &&
            (d.kind === "company" || d.kind === "client"),
        )
        .map((d) => ({
          name: d.raw,
          entityKind: d.entityKind ?? ("publicReference" as const),
        })),
      completedSteps: prev.completedSteps.includes("masking")
        ? prev.completedSteps
        : [...prev.completedSteps, "masking"],
      // 확정과 동시에 다음 단계로 — 별도 "다음" 클릭을 기다리지 않는다.
      currentStep: "analysis",
    }));

    setDraft(null); // ← 원문·Detection[]·NumericDetection[](raw 포함) 즉시 폐기
  };

  const handleAnalyzeImages = async (assetIds: string[]) => {
    const consented = imagesRef.current.filter((img) =>
      assetIds.includes(img.assetId),
    );
    if (consented.length === 0) return;
    // 텍스트 마스킹이 아직 확정 전(draft 존재)이어도 이미지 분석을 먼저 실행할
    // 수 있다 — 그 순간의 draft 상태로 매핑을 미리 계산해 둔다. secureMappingsRef만
    // 믿으면 텍스트 확정 전엔 비어있어서, 이미지 설명 속 실명이 재마스킹을
    // 통과 못 하고 그대로 저장될 위험이 있다 (personName/company는 사전 매칭 전용).
    if (draft) {
      secureMappingsRef.current = finalizeMask(
        draft.parsedText,
        draft.detections,
        draft.numericDetections,
        secureMappingsRef.current,
      ).mappings;
    }
    setImageBusy(true);
    setImageError(undefined);
    try {
      // 동의한 이미지만 전송 — 나머지는 어떤 경우에도 외부로 나가지 않는다
      const res = await fetch("/api/analyze-images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          images: consented.map((i) => ({
            assetId: i.assetId,
            mimeType: i.mimeType,
            data: i.base64,
          })),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.insights)) {
        throw new Error(body?.error ?? "이미지 분석에 실패했습니다.");
      }
      // 응답 재마스킹 (필수) — 실명이 재등장해도 저장 전에 차단.
      // 기존 복원키를 시드로 넘겨 같은 실명 = 같은 토큰, 새 실명 = 이어지는 토큰.
      const dictionary = listDictionary();
      const masked: ImageInsight[] = [];
      for (const insight of body.insights as { assetId: string; description: string }[]) {
        const result = remaskText(
          insight.description,
          dictionary,
          secureMappingsRef.current,
        );
        secureMappingsRef.current = result.mappings; // 매핑 누적 (superset)
        masked.push({
          assetId: insight.assetId,
          maskedDescription: result.maskedText,
        });
      }
      setImageInsights((prev) => [
        ...prev.filter((p) => !masked.some((m) => m.assetId === p.assetId)),
        ...masked,
      ]);
    } catch (e) {
      setImageError(
        e instanceof Error ? e.message : "이미지 분석에 실패했습니다.",
      );
    } finally {
      setImageBusy(false);
    }
  };

  const handleSaveAnalysisJson = () => {
    // 저장 내용 = 마스킹된 분석 + 공개 엔티티 + 지시. 복원키는 절대 포함 안 됨 (Step 13).
    // exportId는 비민감 식별자 — 같은 문서의 분석 JSON과 복원키 파일이 같은 exportId를
    // 공유해야 나중에 짝 검증이 되므로, 세션 내에서는 한 번 만든 값을 재사용한다.
    const exportId = lastMaskedExportIdRef.current ?? crypto.randomUUID();
    const json = buildAnalysisExport(workflow, exportId);
    lastMaskedExportIdRef.current = exportId;
    downloadJson(json, `drg-analysis-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const handleSaveRecoveryKey = () => {
    // 복원키 파일 내보내기 (Step 14) — 실명이 포함되므로 생성부터 다운로드까지
    // 전부 브라우저에서만. 서버로는 어떤 바이트도 나가지 않는다.
    if (secureMappingsRef.current.length === 0) return;
    const exportId = lastMaskedExportIdRef.current ?? crypto.randomUUID();
    lastMaskedExportIdRef.current = exportId;
    const json = buildRecoveryKeyExport(secureMappingsRef.current, exportId);
    downloadJson(
      json,
      `drg-recovery-key-${new Date().toISOString().slice(0, 10)}.json`,
    );
  };

  const handleImportRecoveryKey = async (file: File) => {
    try {
      const data = parseRecoveryKeyImport(await file.text());
      const activeId = importedExportIdRef.current;
      if (!activeId) {
        throw new Error(
          "현재 불러온 분석 JSON에 문서 식별자가 없어 복원키를 검증할 수 없습니다. (구버전 저장본)",
        );
      }
      if (data.exportId !== activeId) {
        throw new Error(
          "이 복원키는 현재 불러온 분석 JSON과 짝이 맞지 않습니다. 같은 문서에서 함께 저장한 파일인지 확인하세요.",
        );
      }
      secureMappingsRef.current = data.mappings;
      lastMaskedExportIdRef.current = data.exportId;
      setRecoveryNotice({
        tone: "info",
        text: "복원키를 불러왔습니다. 이제 실명본 미리보기·다운로드가 가능합니다. (복원키는 메모리에만 유지 — 새로고침 시 다시 가져와야 합니다)",
      });
    } catch (e) {
      setRecoveryNotice({
        tone: "warn",
        text: e instanceof Error ? e.message : "복원키 파일을 읽지 못했습니다.",
      });
    }
  };

  const handleAnalyze = async () => {
    if (!workflow.maskedText) return;
    setAnalyzing(true);
    setAnalysisError(undefined);
    try {
      // 외부(Gemini)로는 maskedText + 유지 확정된 공개 엔티티 실명만 나간다
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          maskedText: workflow.maskedText,
          keptTargets: (workflow.extractedAnalysisTargets ?? []).map(
            (t) => t.name,
          ),
          directives: activeDirectives,
          // 이미지 분석 요약 — 이미 재마스킹된 텍스트만 (Step 9)
          imageNotes: imageInsights.map(
            (i) => `(${i.assetId}) ${i.maskedDescription}`,
          ),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.analysis) {
        throw new Error(body?.error ?? "분석에 실패했습니다.");
      }
      setWorkflow((prev) => ({ ...prev, analysis: body.analysis }));
    } catch (e) {
      setAnalysisError(
        e instanceof Error ? e.message : "분석에 실패했습니다.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  // 분석 자동 시작 (Step 9) — 마스킹 확정 후 이 단계에 들어오면 버튼 클릭 없이
  // 바로 호출한다. maskedText별로 한 번만 자동 시도하도록 기억해, 실패 후에도
  // 무한 재시도 루프를 만들지 않는다(실패 시엔 사용자가 "다시 시도"를 직접 누른다).
  const autoAnalyzedForRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (workflow.currentStep !== "analysis") return;
    if (workflow.analysis) return;
    if (!workflow.maskedText) return;
    const imageOnlyBlocked =
      workflow.maskedText === IMAGE_ONLY_PLACEHOLDER && imageInsights.length === 0;
    if (imageOnlyBlocked) return;
    if (analyzing) return;
    if (autoAnalyzedForRef.current === workflow.maskedText) return;
    autoAnalyzedForRef.current = workflow.maskedText;
    void handleAnalyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.currentStep, workflow.analysis, workflow.maskedText, imageInsights.length, analyzing]);

  // 마운트 시 1회 — 아직 아무것도 업로드하지 않은 상태일 때만 복구한다. 사용자가
  // 그 사이 새 파일을 올렸다면(같은 tick 경합) 복구로 덮어쓰지 않는다.
  useEffect(() => {
    let cancelled = false;
    loadWorkflowSnapshot()
      .then((snapshot) => {
        if (cancelled || !snapshot) return;
        setWorkflow((prev) => {
          if (prev.currentStep !== "upload" || prev.analysis) return prev;
          return {
            ...prev,
            sourceType: snapshot.sourceType,
            documentPurpose: snapshot.documentPurpose,
            projectDirective: snapshot.projectDirective,
            extractedAnalysisTargets: snapshot.extractedAnalysisTargets,
            analysis: snapshot.analysis,
            references: snapshot.references,
            conceptJson: snapshot.conceptJson,
            currentStep: snapshot.currentStep,
            completedSteps: snapshot.completedSteps,
          };
        });
        if (snapshot.analysis) {
          setRestoreNotice(
            `이전 세션(${new Date(snapshot.savedAt).toLocaleString("ko-KR")})의 프로젝트를 복구했습니다. 원문·마스킹 검수 단계는 복구되지 않습니다 — 재분석이나 마스킹 재편집이 필요하면 원본을 다시 업로드하세요.`,
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) hasAttemptedRestoreRef.current = true;
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 워크플로가 바뀔 때마다 안전한 상태만 자동 저장한다(디바운스). 복구 시도가
  // 끝나기 전이거나 아직 아무것도 시작하지 않았으면 저장하지 않는다.
  useEffect(() => {
    if (!hasAttemptedRestoreRef.current) return;
    if (workflow.currentStep === "upload" && !workflow.analysis) return;
    const timer = setTimeout(() => {
      void saveWorkflowSnapshot(workflow).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [workflow]);

  const handleConfirmAnalysis = () => {
    setWorkflow((prev) => {
      if (!prev.analysis) return prev;
      return {
        ...prev,
        // 확정 게이트: 남긴 후보 섹션을 confirmed로 전환 (Phase 3 입력 자격)
        analysis: confirmSelectedSections(prev.analysis),
        completedSteps: prev.completedSteps.includes("analysis")
          ? prev.completedSteps
          : [...prev.completedSteps, "analysis"],
        currentStep: "reference",
      };
    });
  };

  return (
    <Workspace state={workflow} onNavigate={handleNavigate}>
      {restoreNotice && <Alert tone="info">{restoreNotice}</Alert>}
      {workflow.currentStep === "upload" &&
        (workflow.completedSteps.includes("upload") ? (
          <Panel title="업로드 (완료)">
            <p style={{ color: "var(--text-muted)" }}>
              업로드된 파일: <b>{fileDisplayName ?? "(알 수 없음)"}</b>
            </p>
            <p style={{ color: "var(--text-muted)" }}>
              새로고침해도 분석·레퍼런스·컨셉 진행 상태는 복구됩니다. 다만
              원문·복원키는 메모리에서만 유지되므로 새로고침 시 소멸합니다 —
              실명 복원이 다시 필요하면 원본을 재업로드하세요.
            </p>
          </Panel>
        ) : (
          <LandingUpload
            onFile={handleFile}
            onLink={handleLink}
            error={uploadError}
            jsonError={jsonImportError}
            parsing={parsing}
          />
        ))}

      {workflow.currentStep === "masking" &&
        (() => {
          const maskingConfirmed = !draft && !!workflow.maskedText;
          return draft || workflow.maskedText ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {!maskingConfirmed && draft?.parsedText === IMAGE_ONLY_PLACEHOLDER && (
                <Alert tone="info">
                  <b>이미지 전용 입력</b> — 마스킹할 본문 텍스트가 없습니다. 아래
                  검수를 그대로 확정한 뒤, 이미지 전송 동의를 거쳐 분석을
                  진행하세요. (이미지는 동의 전까지 외부로 나가지 않습니다)
                </Alert>
              )}
              {!maskingConfirmed && workflow.documentPurpose === "company-profile" && (
                <Alert tone="warn">
                  이 문서는 <b>회사소개서</b>로 보입니다. 프로젝트 기획서와 함께
                  분석하면 도메인 판정이 왜곡될 수 있습니다. 별도 문서라면 그대로
                  진행해도 됩니다 (판정은 참고용).
                </Alert>
              )}
              {!maskingConfirmed && workflow.documentPurpose === "template-only" && (
                <Alert tone="info">
                  본문 없이 <b>표지·간지·목차 구조만</b> 감지됐습니다. 이런
                  템플릿 문서는 전체 분석 없이 표지·간지·목차만 빠르게 만드는
                  경량 경로가 적합합니다 (경량 경로는 이후 스텝에서 제공 —
                  지금은 일반 경로로 진행됩니다).
                </Alert>
              )}
              <MaskingReview
                parsedText={draft?.parsedText ?? ""}
                detections={draft?.detections ?? []}
                numericDetections={draft?.numericDetections ?? []}
                onUpdateDetections={(next) =>
                  setDraft((prev) => prev && { ...prev, detections: next })
                }
                onUpdateNumeric={(next) =>
                  setDraft(
                    (prev) => prev && { ...prev, numericDetections: next },
                  )
                }
                onAddToDictionary={(value, kind) => {
                  addDictionaryEntry(value, kind);
                }}
                onConfirm={handleConfirmMasking}
                confirmed={maskingConfirmed}
                maskedText={workflow.maskedText}
                maskingSummary={workflow.maskingSummary}
                onNext={() => handleNavigate("analysis")}
                recoveryKeyAction={
                  secureMappingsRef.current.length > 0 ? (
                    <button
                      onClick={handleSaveRecoveryKey}
                      className="btn-tertiary"
                      style={{
                        alignSelf: "flex-start",
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-sm)",
                        padding: "10px var(--space-base)",
                        borderRadius: "var(--radius-md)",
                        border: "none",
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      <Key size={18} />
                      복원키 파일 저장 — 실명 포함, 로컬 보관 전용 (서버 미전송)
                    </button>
                  ) : undefined
                }
                imageConsentPanel={
                  imagesRef.current.length > 0 ? (
                    <ImageConsentPanel
                      images={imagesRef.current.map(toConsentImage)}
                      insights={imageInsights}
                      busy={imageBusy}
                      error={imageError}
                      onAnalyze={handleAnalyzeImages}
                      onClearError={() => setImageError(undefined)}
                    />
                  ) : undefined
                }
                hasImages={imagesRef.current.length > 0}
                imageOnlyAnalysisBlocked={
                  (draft?.parsedText ?? workflow.maskedText) === IMAGE_ONLY_PLACEHOLDER &&
                  imageInsights.length === 0
                }
              />
            </div>
          ) : (
            <Panel title="마스킹 검수">
              <p style={{ color: "var(--text-muted)" }}>
                검수할 문서가 없습니다. 문서를 먼저 업로드하세요.
              </p>
            </Panel>
          );
        })()}

      {workflow.currentStep === "analysis" &&
        (workflow.analysis ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {activeDirectives.length > 0 && (
              <Alert tone="info">
                지시 적용 중:{" "}
                <b>
                  {activeDirectives
                    .map((d) => `${d.text} [${describeScope(d)}]`)
                    .join(" · ")}
                </b>{" "}
                — 각 지시는 선택한 단계의 프롬프트에만 주입됩니다.
              </Alert>
            )}
            <AnalysisResult
              analysis={workflow.analysis}
              onChange={(next) =>
                setWorkflow((prev) => ({ ...prev, analysis: next }))
              }
              onConfirm={handleConfirmAnalysis}
              directives={workflow.projectDirective ?? []}
              onDirectivesChange={(next) =>
                setWorkflow((prev) => ({
                  ...prev,
                  projectDirective: next.length > 0 ? next : undefined,
                }))
              }
            />
            {workflow.completedSteps.includes("analysis") && (
              <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
                <button
                  onClick={handleSaveAnalysisJson}
                  className="btn-tertiary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-sm)",
                    padding: "10px var(--space-base)",
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  <Save size={18} />
                  분석 결과 JSON 저장 — 나중에 레퍼런스·무드부터 재시작
                  (마스킹본이라 안전)
                </button>
                {secureMappingsRef.current.length > 0 && (
                  <button
                    onClick={handleSaveRecoveryKey}
                    className="btn-tertiary"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-sm)",
                      padding: "10px var(--space-base)",
                      borderRadius: "var(--radius-md)",
                      border: "none",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    <Key size={18} />
                    복원키 파일 저장 — 분석 JSON과 짝으로 보관하면 재활용
                    때도 실명본 복구 가능 (실명 포함, 로컬 전용)
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <Panel title="분석 결과">
            {workflow.extractedAnalysisTargets &&
              workflow.extractedAnalysisTargets.length > 0 && (
                <p style={{ color: "var(--text-muted)" }}>
                  유지된 분석 대상:{" "}
                  {workflow.extractedAnalysisTargets
                    .map((t) => t.name)
                    .join(", ")}
                </p>
              )}
            {analyzing && (
              <LoadingState
                securityNote={
                  '마스킹된 텍스트를 Gemini로 분석합니다. 외부로는 마스킹본과 "유지"로 확정한 공개 엔티티 실명만 전송됩니다.'
                }
                label="분석 중"
                caption="수십 초 정도 걸릴 수 있어요."
              />
            )}
            {analysisError && (
              <ErrorState
                title="분석에 실패했어요"
                detail={analysisError}
                onRetry={handleAnalyze}
              />
            )}
          </Panel>
        ))}

      {workflow.currentStep === "reference" &&
        (workflow.analysis ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {workflow.sourceType === "analysis-json" &&
              (secureMappingsRef.current.length > 0 ? (
                <Alert tone="info">
                  재활용 모드 — 복원키가 메모리에 있어{" "}
                  <b>실명본 다운로드가 가능</b>합니다.
                </Alert>
              ) : (
                <>
                  <Alert tone="warn">
                    재활용 모드 (분석 JSON 시작) — 복원키가 없으므로 이 모드의
                    산출물은 <b>마스킹본만</b> 출력됩니다. 이 분석 JSON과 함께
                    저장한 🔑 복원키 파일이 있으면 가져와 실명본을 복구할 수
                    있습니다.
                  </Alert>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-md)",
                      fontWeight: 600,
                      fontSize: 14,
                      maxWidth: 860,
                    }}
                  >
                    <Key size={18} />
                    복원키 파일 가져오기 (브라우저에서만 처리 — 서버
                    미전송)
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleImportRecoveryKey(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </>
              ))}
            {recoveryNotice && (
              <Alert tone={recoveryNotice.tone}>{recoveryNotice.text}</Alert>
            )}
            {confirmBriefError && (
              <Alert tone="warn">{confirmBriefError}</Alert>
            )}
            <ReferenceWorkspace
            analysis={workflow.analysis}
            directives={activeDirectives}
            extractedTargets={workflow.extractedAnalysisTargets ?? []}
            documentPurpose={workflow.documentPurpose}
            references={workflow.references ?? {}}
            onChange={(next) =>
              setWorkflow((prev) => ({
                ...prev,
                references:
                  typeof next === "function"
                    ? next(prev.references ?? {})
                    : next,
              }))
            }
            onConfirm={() => {
              if (!workflow.analysis) return;
              // ConfirmedReferenceBrief 스냅샷 생성 (P9-A) — 편집 중 상태에서 사용자가
              // 실제로 채택한 결정만 남긴 불변 스냅샷을 여기서 확정한다(§6.4).
              try {
                const confirmedBrief = buildConfirmedBrief(
                  workflow.analysis,
                  workflow.references ?? {},
                );
                setConfirmBriefError(undefined);
                setWorkflow((prev) => ({
                  ...prev,
                  references: {
                    ...prev.references,
                    referenceConfirmed: true,
                    confirmedBrief,
                  },
                  completedSteps: prev.completedSteps.includes("reference")
                    ? prev.completedSteps
                    : [...prev.completedSteps, "reference"],
                  currentStep: "concept",
                }));
              } catch (e) {
                setConfirmBriefError(
                  e instanceof Error
                    ? e.message
                    : "레퍼런스 결정을 확정하지 못했습니다.",
                );
              }
            }}
            />
          </div>
        ) : (
          <Panel title="레퍼런스·무드">
            <p style={{ color: "var(--text-muted)" }}>
              분석 결과가 없습니다. 분석을 먼저 완료하세요.
            </p>
          </Panel>
        ))}

      {workflow.currentStep === "concept" &&
        (workflow.analysis ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* 출력 scope 지시는 렌더링이 로컬 결정론적이라 프롬프트 주입이 없음 → 확인용 리마인더 */}
            {activeDirectives.some((d) => d.scope?.includes("output")) && (
              <Alert tone="info">
                출력 단계 지시 (산출물 다운로드 전 확인용):{" "}
                <b>
                  {activeDirectives
                    .filter((d) => d.scope?.includes("output"))
                    .map((d) => d.text)
                    .join(" · ")}
                </b>
              </Alert>
            )}
            <ConceptWorkspace
            analysis={workflow.analysis}
            directives={activeDirectives}
            references={workflow.references ?? {}}
            concept={workflow.conceptJson}
            onChange={(next) =>
              setWorkflow((prev) => ({ ...prev, conceptJson: next }))
            }
            canRestore={secureMappingsRef.current.length > 0}
            makeTransform={(restored) =>
              restored
                ? (text) => restore(text, secureMappingsRef.current)
                : (text) => text
            }
            confirmed={workflow.completedSteps.includes("concept")}
            onConfirm={() =>
              setWorkflow((prev) => ({
                ...prev,
                completedSteps: prev.completedSteps.includes("concept")
                  ? prev.completedSteps
                  : [...prev.completedSteps, "concept"],
              }))
            }
            />
          </div>
        ) : (
          <Panel title="컨셉 3안">
            <p style={{ color: "var(--text-muted)" }}>
              분석·레퍼런스를 먼저 완료하세요.
            </p>
          </Panel>
        ))}

      {workflow.currentStep === "design-md" && (
        <Panel title={STEP_LABELS[workflow.currentStep]}>
          <p style={{ color: "var(--text-muted)" }}>
            디자인 MD는 Phase 5 (제품 B 스키마 확정 후) 구현됩니다.
          </p>
        </Panel>
      )}
    </Workspace>
  );
}

// 해당 슬라이드 텍스트에 개인정보성 키워드가 있으면 민감 가능성 힌트 (Step 9, 실사용#10)
const SENSITIVE_SLIDE_KEYWORDS = [
  "로그인",
  "비밀번호",
  "신청",
  "개인정보",
  "연락처",
  "이력서",
  "계약",
  "회원",
  "결제",
];

function slideHasSensitiveHint(text: string, slideNo?: number): boolean {
  if (slideNo == null) {
    return SENSITIVE_SLIDE_KEYWORDS.some((k) => text.includes(k));
  }
  const marker = `--- 슬라이드 ${slideNo} ---`;
  const start = text.indexOf(marker);
  if (start < 0) return false;
  const nextMarker = text.indexOf("--- 슬라이드", start + marker.length);
  const slideText = text.slice(start, nextMarker < 0 ? undefined : nextMarker);
  return SENSITIVE_SLIDE_KEYWORDS.some((k) => slideText.includes(k));
}

function downloadJson(json: string, fileName: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function toConsentImage(
  img: PptxImage & { sensitivityHint: "none" | "possible" },
): ConsentImage {
  return {
    assetId: img.assetId,
    dataUrl: `data:${img.mimeType};base64,${img.base64}`,
    sourceSlide: img.sourceSlide,
    sensitivityHint: img.sensitivityHint,
  };
}

function Alert({
  tone,
  children,
}: {
  tone: "warn" | "info";
  children: React.ReactNode;
}) {
  const colors =
    tone === "warn"
      ? {
          border: "var(--warning)",
          background: "var(--warning-weak-bg)",
          color: "var(--warning-weak-text)",
        }
      : {
          border: "var(--info)",
          background: "var(--info-weak-bg)",
          color: "#075985",
        };
  return (
    <p
      role="alert"
      style={{
        ...colors,
        border: `1px solid ${colors.border}`,
        borderRadius: "var(--radius-md)",
        padding: "var(--space-md) var(--space-base)",
        fontSize: 14,
      }}
    >
      {children}
    </p>
  );
}

// 로딩·placeholder 화면(업로드 완료 요약, 디자인 MD 등)에서 쓰는 얇은 래퍼 —
// 타이틀 렌더링은 PageLayout에 위임하고, 내용은 표준 카드 하나로 감싼다.
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <PageLayout title={title}>
      <div style={pageCardStyle}>{children}</div>
    </PageLayout>
  );
}
