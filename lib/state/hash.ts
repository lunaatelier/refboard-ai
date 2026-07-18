// 변경 감지 전용 해시 — 암호학적 강도는 필요 없다(민감정보 안전화 수단으로 쓰지 않는다, §6.5).
// 브라우저/Node 양쪽에서 동일하게 동작해야 하므로 Web Crypto/Node crypto에 의존하지 않는다.

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

// cyrb128 계열 — 짧고 빠르고 충돌이 드문 32bit×2 해시. 순서를 바꾸면 기존 저장된
// hash와 어긋나므로(재확인 유발 정도의 부작용) 임의로 바꾸지 않는다.
export function hashString(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, "0") +
    (h1 >>> 0).toString(16).padStart(8, "0")
  );
}

export function hashValue(value: unknown): string {
  return hashString(canonicalStringify(value));
}
