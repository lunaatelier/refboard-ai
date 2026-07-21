import { NextResponse } from "next/server";
import { extractHtmlText, isBlockedLinkTarget } from "@/lib/parse/html";
import {
  BlockedTargetError,
  fetchChecked,
  readLimitedText,
  TooLargeError,
  TooManyRedirectsError,
} from "@/lib/parse/link";

// 링크 텍스트 추출 (Step 17, Phase 1.5) — 공개 링크(V0 공유 등) 전용.
// 보안 원칙: URL·본문을 로그·디스크에 남기지 않는다(메모리 처리만).
// 사설망·로컬 주소는 SSRF 방지를 위해 차단(리다이렉트 매 홉 재검사).
// 추출 텍스트는 클라이언트에서 원문(parsedText) 취급되어 마스킹 게이트를 반드시 통과한다.

export const runtime = "nodejs";

const TIMEOUT_MS = 10_000;

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
    return NextResponse.json(
      { error: "올바른 URL 형식이 아닙니다." },
      { status: 400 },
    );
  }
  if (isBlockedLinkTarget(url)) {
    return NextResponse.json(
      { error: "http(s) 공개 링크만 지원합니다. (내부망 주소 불가)" },
      { status: 400 },
    );
  }

  try {
    const { response: res } = await fetchChecked(url, AbortSignal.timeout(TIMEOUT_MS), fetch);
    if (!res.ok) {
      return NextResponse.json(
        { error: `페이지를 가져오지 못했습니다. (HTTP ${res.status})` },
        { status: 502 },
      );
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(contentType)) {
      return NextResponse.json(
        { error: "HTML/텍스트 페이지가 아닙니다." },
        { status: 415 },
      );
    }
    const raw = await readLimitedText(res);
    const text = contentType.includes("text/plain")
      ? raw
      : extractHtmlText(raw);
    return NextResponse.json({ text });
  } catch (e) {
    // URL·원문을 에러에 싣지 않는다 (무로그 원칙)
    if (e instanceof BlockedTargetError) {
      return NextResponse.json(
        { error: "리다이렉트 대상이 내부망 주소입니다." },
        { status: 400 },
      );
    }
    if (e instanceof TooLargeError) {
      return NextResponse.json(
        { error: "페이지가 너무 큽니다. (2MB 제한)" },
        { status: 413 },
      );
    }
    if (e instanceof TooManyRedirectsError) {
      return NextResponse.json(
        { error: "리다이렉트가 너무 많습니다." },
        { status: 400 },
      );
    }
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return NextResponse.json(
      {
        error: timedOut
          ? "페이지 응답이 너무 느립니다. (10초 제한)"
          : "링크에 접속하지 못했습니다. 공개 링크인지 확인하세요.",
      },
      { status: 502 },
    );
  }
}
