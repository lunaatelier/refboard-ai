import { NextResponse } from "next/server";
import { extractOgMeta, isBlockedLinkTarget } from "@/lib/parse/html";
import {
  BlockedTargetError,
  fetchChecked,
  readLimitedText,
  TooLargeError,
  TooManyRedirectsError,
} from "@/lib/parse/link";

// URL 붙여넣기 OG 미리보기 (P5-5, 개선 지시서 P5 item 14) — 사용자가 수집한
// 레퍼런스 URL 자체의 공개 메타데이터(제목/썸네일)만 가져온다. 프로젝트 원문이
// 아니라 상대방 공개 페이지의 메타데이터라 마스킹 대상이 아니다(§4.1).
// fetch-link route와 같은 SSRF 방어(fetchChecked)를 재사용 — 실패는 클라이언트가
// 텍스트 링크로 그대로 두면 되므로 항상 명확한 에러 메시지만 반환한다.

export const runtime = "nodejs";

const TIMEOUT_MS = 8_000;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  if (!rawUrl) {
    return NextResponse.json({ error: "url이 필요합니다." }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "올바른 URL 형식이 아닙니다." }, { status: 400 });
  }
  if (isBlockedLinkTarget(url)) {
    return NextResponse.json(
      { error: "http(s) 공개 링크만 지원합니다. (내부망 주소 불가)" },
      { status: 400 },
    );
  }

  try {
    const { response: res, finalUrl } = await fetchChecked(url, AbortSignal.timeout(TIMEOUT_MS), fetch);
    if (!res.ok) {
      return NextResponse.json(
        { error: `페이지를 가져오지 못했습니다. (HTTP ${res.status})` },
        { status: 502 },
      );
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      return NextResponse.json({ error: "HTML 페이지가 아닙니다." }, { status: 415 });
    }
    const html = await readLimitedText(res);
    // 상대경로 이미지가 있으면 리다이렉트 이전이 아니라 실제 도착 URL 기준으로 풀어야 한다.
    const meta = extractOgMeta(html, finalUrl.toString());
    return NextResponse.json(meta);
  } catch (e) {
    if (e instanceof BlockedTargetError) {
      return NextResponse.json(
        { error: "리다이렉트 대상이 내부망 주소입니다." },
        { status: 400 },
      );
    }
    if (e instanceof TooLargeError) {
      return NextResponse.json({ error: "페이지가 너무 큽니다. (2MB 제한)" }, { status: 413 });
    }
    if (e instanceof TooManyRedirectsError) {
      return NextResponse.json({ error: "리다이렉트가 너무 많습니다." }, { status: 400 });
    }
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return NextResponse.json(
      {
        error: timedOut
          ? "페이지 응답이 너무 느립니다. (8초 제한)"
          : "링크에 접속하지 못했습니다.",
      },
      { status: 502 },
    );
  }
}
