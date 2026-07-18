import { openAppDb, WORKFLOW_STORE } from "./db";
import type { WorkflowState } from "./workflow";

// 안전한 워크플로 상태를 IndexedDB에 자동 저장/복구한다 (§6.6).
// - maskedText, maskingSummary는 저장하지 않는다: 재분석·마스킹 재편집이 필요하면
//   원본을 다시 업로드한다는 것이 제품 방침이다(§6.6 결정 — maskedText 미저장).
// - parsedText, mappings(SecureClientMemory), Detection.raw는 애초에 WorkflowState/
//   ReferenceResult 타입에 없으므로 이 함수가 따로 걸러낼 필요가 없다.
// - ImageHint.generatedImageAssetId는 Blob store(lib/state/imageAssetStore.ts)를
//   가리키는 id 문자열일 뿐이라(P1 item 11 마이그레이션 완료) 그대로 저장해도 된다 —
//   data URL 자체는 여기 들어오지 않는다.

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
    references: state.references,
    conceptJson: state.conceptJson,
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    savedAt: new Date().toISOString(),
  };
}

const SNAPSHOT_KEY = "current";

export async function saveWorkflowSnapshot(state: WorkflowState): Promise<void> {
  const db = await openAppDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WORKFLOW_STORE, "readwrite");
      tx.objectStore(WORKFLOW_STORE).put(toSafeSnapshot(state), SNAPSHOT_KEY);
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
  const db = await openAppDb();
  try {
    return await new Promise<SafeWorkflowSnapshot | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(WORKFLOW_STORE, "readonly");
        const req = tx.objectStore(WORKFLOW_STORE).get(SNAPSHOT_KEY);
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
  const db = await openAppDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WORKFLOW_STORE, "readwrite");
      tx.objectStore(WORKFLOW_STORE).delete(SNAPSHOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
