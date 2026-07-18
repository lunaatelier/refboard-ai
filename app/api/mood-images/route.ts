import { NextResponse } from "next/server";
import {
  buildPexelsSearchUrl,
  buildUnsplashSearchUrl,
  parsePexelsResults,
  parseUnsplashResults,
  type ImageSearchParams,
} from "@/lib/reference/imageSearch";

// 무드보드 이미지 검색/재생성 (Step 10-a, P3-2) — Unsplash 우선, 실패/키없음
// 시 Pexels 폴백. 검색어는 무드의 영어 imageQuery(또는 사용자가 편집한 검색어)뿐
// — 문서 내용·실명은 여기로 오지 않는다.
//
// "다시 생성" 컨트롤: query 편집(그대로 다른 검색어로 재요청), colorHex(컬러
// 유지 체크 시에만 전달), excludeKeywords(제외 키워드 누적), page(같은 검색어로
// 다른 결과를 받기 위한 페이지 증가). "피사체 유지"는 서버 파라미터가 아니라
// 클라이언트가 query의 피사체 단어를 그대로 두는 편집 동작이다.

export const runtime = "nodejs";

async function searchUnsplash(params: ImageSearchParams) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  const res = await fetch(buildUnsplashSearchUrl(params), {
    headers: { Authorization: `Client-ID ${key}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return parseUnsplashResults(data, params.excludeKeywords);
}

async function searchPexels(params: ImageSearchParams) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const res = await fetch(buildPexelsSearchUrl(params), {
    headers: { Authorization: key },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return parsePexelsResults(data, params.excludeKeywords);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const query: unknown = body?.query;
  if (typeof query !== "string" || !query.trim()) {
    return NextResponse.json({ error: "query가 필요합니다." }, { status: 400 });
  }

  const params: ImageSearchParams = {
    query: query.trim(),
    colorHex:
      typeof body?.colorHex === "string" && body.colorHex.trim()
        ? body.colorHex.trim()
        : undefined,
    excludeKeywords: Array.isArray(body?.excludeKeywords)
      ? body.excludeKeywords.filter((k: unknown) => typeof k === "string")
      : undefined,
    page:
      typeof body?.page === "number" && body.page >= 1
        ? Math.floor(body.page)
        : undefined,
  };

  try {
    const unsplash = await searchUnsplash(params);
    if (unsplash && unsplash.length > 0) {
      return NextResponse.json({ images: unsplash });
    }
    const pexels = await searchPexels(params);
    if (pexels && pexels.length > 0) {
      return NextResponse.json({ images: pexels });
    }
    // 키 미설정/할당량 소진/결과 없음 → 이미지 없이 진행 (키워드만으로도 무드 사용 가능)
    return NextResponse.json({ images: [] });
  } catch {
    return NextResponse.json({ images: [] });
  }
}
