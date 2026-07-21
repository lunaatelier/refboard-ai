// 링크 fetch 로직 (Step 17 후속 보강) — 네트워크 호출을 주입 가능하게 분리해
// SSRF 재검증·바이트 제한 스트리밍을 실제 요청 없이 유닛 테스트할 수 있게 한다.
// app/api/fetch-link/route.ts는 이 모듈을 얇게 감싸기만 한다.

import { isBlockedLinkTarget } from "./html";

export const MAX_LINK_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_REDIRECTS = 5;

export class BlockedTargetError extends Error {}
export class TooLargeError extends Error {}
export class TooManyRedirectsError extends Error {}

// 응답 타입을 fetch Response의 필요한 부분집합으로만 좁혀서 테스트 더블을 쉽게 만든다.
export interface MinimalResponse {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
}

export type FetchLike = (
  url: URL,
  init: {
    signal: AbortSignal;
    redirect: "manual";
    headers: Record<string, string>;
  },
) => Promise<MinimalResponse>;

export interface CheckedResponse {
  response: MinimalResponse;
  // 리다이렉트를 실제로 따라간 최종 URL — 상대경로 해석(OG 이미지 등)이나
  // 실제 도착 도메인 검증(P6 브랜드 출처 검증)에 원본 url 대신 이걸 써야 한다.
  finalUrl: URL;
}

// 리다이렉트를 fetch에 맡기면(redirect:"follow") 최종 목적지가 SSRF 검사를 안 거친다.
// 공개 URL이 302로 내부망을 가리켜도 통과해버리므로, 매 홉마다 직접 재검사한다.
export async function fetchChecked(
  url: URL,
  signal: AbortSignal,
  fetchImpl: FetchLike,
): Promise<CheckedResponse> {
  let current = url;
  for (let hop = 0; ; hop++) {
    if (isBlockedLinkTarget(current)) {
      throw new BlockedTargetError();
    }
    const res = await fetchImpl(current, {
      signal,
      redirect: "manual",
      headers: { accept: "text/html,text/plain;q=0.9,*/*;q=0.1" },
    });
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) {
      return { response: res, finalUrl: current };
    }
    if (hop >= MAX_REDIRECTS) {
      throw new TooManyRedirectsError();
    }
    current = new URL(location, current);
  }
}

// 본문 전체를 메모리에 올린 뒤 길이를 재는 대신, 스트림을 바이트 단위로 누적하며
// 제한을 넘는 즉시 중단한다. content-length는 신뢰할 수 없어(누락·거짓 가능)
// 사전 검사만 하고, 실제 강제는 스트리밍 누적으로 한다.
export async function readLimitedText(res: MinimalResponse): Promise<string> {
  const declaredLength = Number(res.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_LINK_BYTES) {
    throw new TooLargeError();
  }
  if (!res.body) return res.text();

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_LINK_BYTES) {
      await reader.cancel();
      throw new TooLargeError();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
}
