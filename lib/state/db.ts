// 이 프로젝트의 모든 IndexedDB object store는 여기서 한 번에 만든다. 모듈마다
// 따로 `indexedDB.open(DB_NAME, 1)`을 호출하면, 먼저 실행된 쪽이 DB를 만들면서
// 자기 store만 만들고 나면 버전이 이미 1이 되어 다른 모듈의 onupgradeneeded가
// 다시는 실행되지 않는다(그 모듈의 store가 영영 생성되지 않는 버그로 이어짐).
// 새 store가 필요하면 여기 목록에 추가하고 DB_VERSION을 올린다.

const DB_NAME = "refboard-ai";
const DB_VERSION = 2;

export const WORKFLOW_STORE = "workflow";
export const IMAGE_ASSET_STORE = "image-assets";

const ALL_STORES = [WORKFLOW_STORE, IMAGE_ASSET_STORE];

function assertClient(): void {
  if (typeof indexedDB === "undefined") {
    throw new Error("lib/state/db.ts는 브라우저 전용입니다.");
  }
}

export function openAppDb(): Promise<IDBDatabase> {
  assertClient();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of ALL_STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store);
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
