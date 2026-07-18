import type { WorkflowState } from "./workflow";

// 안전한 워크플로 상태를 IndexedDB에 자동 저장/복구한다 (§6.6).
// - maskedText, maskingSummary는 저장하지 않는다: 재분석·마스킹 재편집이 필요하면
//   원본을 다시 업로드한다는 것이 제품 방침이다(§6.6 결정 — maskedText 미저장).
// - parsedText, mappings(SecureClientMemory), Detection.raw는 애초에 WorkflowState/
//   ReferenceResult 타입에 없으므로 이 함수가 따로 걸러낼 필요가 없다.
// - ImageHint.generatedImageUrl(data URL)은 §6.6 "data URL을 워크플로 JSON에 직접
//   넣지 않는다" 규칙에 따라 제거한다 — Blob store 마이그레이션(P1 item 11) 전까지는
//   새로고침 시 이미지 힌트 프롬프트만 복구되고 생성된 미리보기 이미지는 사라진다.

export interface SafeWorkflowSnapshot {
  sourceType?: WorkflowState["sourceType"];
  documentPurpose?: WorkflowState["documentPurpose"];
  projectDirective?: WorkflowState["projectDirective"];
  extractedAnalysisTargets?: WorkflowState["extractedAnalysisTargets"];
  analysis?: WorkflowState["analysis"];
  references?: WorkflowState["references"];
  conceptJson?: WorkflowState["conceptJson"];
  currentStep: WorkflowState["currentStep"];
  completedSteps: WorkflowState["completedSteps"];
  savedAt: string;
}

export function toSafeSnapshot(state: WorkflowState): SafeWorkflowSnapshot {
  return {
    sourceType: state.sourceType,
    documentPurpose: state.documentPurpose,
    projectDirective: state.projectDirective,
    extractedAnalysisTargets: state.extractedAnalysisTargets,
    analysis: state.analysis,
    references: state.references
      ? {
          ...state.references,
          ...(state.references.imageHints
            ? {
                imageHints: state.references.imageHints.map((hint) => {
                  const { generatedImageUrl: _generatedImageUrl, ...rest } = hint;
                  return rest;
                }),
              }
            : {}),
        }
      : undefined,
    conceptJson: state.conceptJson,
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    savedAt: new Date().toISOString(),
  };
}

const DB_NAME = "refboard-ai";
const STORE_NAME = "workflow";
const DB_VERSION = 1;
const SNAPSHOT_KEY = "current";

function assertClient(): void {
  if (typeof indexedDB === "undefined") {
    throw new Error("lib/state/persistence.ts는 브라우저 전용입니다.");
  }
}

function openDb(): Promise<IDBDatabase> {
  assertClient();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveWorkflowSnapshot(state: WorkflowState): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(toSafeSnapshot(state), SNAPSHOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadWorkflowSnapshot(): Promise<
  SafeWorkflowSnapshot | undefined
> {
  const db = await openDb();
  try {
    return await new Promise<SafeWorkflowSnapshot | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(SNAPSHOT_KEY);
        req.onsuccess = () =>
          resolve(req.result as SafeWorkflowSnapshot | undefined);
        req.onerror = () => reject(req.error);
      },
    );
  } finally {
    db.close();
  }
}

export async function clearWorkflowSnapshot(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(SNAPSHOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
