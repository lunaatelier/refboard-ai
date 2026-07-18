// 생성 이미지 Blob store (IndexedDB) — §6.6 "생성 이미지의 data URL을 워크플로
// JSON에 직접 넣지 않는다"를 지키기 위해, 실제 바이너리는 여기 별도 object store에
// 두고 워크플로 상태(ReferenceResult.imageHints)에는 assetId 문자열만 보관한다.

import { IMAGE_ASSET_STORE, openAppDb } from "./db";

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = /data:(.*?);base64/.exec(header);
  const mimeType = mimeMatch?.[1] || "image/png";
  const binary = atob(base64 ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

// data URL(예: /api/generate-image 응답)을 받아 Blob으로 저장하고 assetId를 반환한다.
export async function saveImageAssetFromDataUrl(dataUrl: string): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  const assetId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const db = await openAppDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IMAGE_ASSET_STORE, "readwrite");
      tx.objectStore(IMAGE_ASSET_STORE).put(blob, assetId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
  return assetId;
}

export async function loadImageAssetBlob(
  assetId: string,
): Promise<Blob | undefined> {
  const db = await openAppDb();
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(IMAGE_ASSET_STORE, "readonly");
      const req = tx.objectStore(IMAGE_ASSET_STORE).get(assetId);
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function deleteImageAsset(assetId: string): Promise<void> {
  const db = await openAppDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IMAGE_ASSET_STORE, "readwrite");
      tx.objectStore(IMAGE_ASSET_STORE).delete(assetId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
