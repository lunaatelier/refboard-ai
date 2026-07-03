import { NextResponse } from "next/server";

// 무드보드 이미지 검색 (Step 10-a) — Unsplash 우선, 실패/키없음 시 Pexels 폴백.
// 검색어는 무드의 영어 imageQuery뿐 — 문서 내용·실명은 여기로 오지 않는다.

export const runtime = "nodejs";

interface MoodImageOut {
  url: string;
  source: "unsplash" | "pexels";
  attribution: string;
}

async function searchUnsplash(query: string): Promise<MoodImageOut[] | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape`,
    { headers: { Authorization: `Client-ID ${key}` } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return results
    .filter((r: any) => typeof r?.urls?.small === "string")
    .map((r: any) => ({
      url: r.urls.small,
      source: "unsplash" as const,
      attribution: `${r?.user?.name ?? "Unknown"} / Unsplash`,
    }));
}

async function searchPexels(query: string): Promise<MoodImageOut[] | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape`,
    { headers: { Authorization: key } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const photos = Array.isArray(data?.photos) ? data.photos : [];
  return photos
    .filter((p: any) => typeof p?.src?.medium === "string")
    .map((p: any) => ({
      url: p.src.medium,
      source: "pexels" as const,
      attribution: `${p?.photographer ?? "Unknown"} / Pexels`,
    }));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const query: unknown = body?.query;
  if (typeof query !== "string" || !query.trim()) {
    return NextResponse.json({ error: "query가 필요합니다." }, { status: 400 });
  }

  try {
    const unsplash = await searchUnsplash(query.trim());
    if (unsplash && unsplash.length > 0) {
      return NextResponse.json({ images: unsplash });
    }
    const pexels = await searchPexels(query.trim());
    if (pexels && pexels.length > 0) {
      return NextResponse.json({ images: pexels });
    }
    // 키 미설정/할당량 소진 → 이미지 없이 진행 (키워드만으로도 무드 사용 가능)
    return NextResponse.json({ images: [] });
  } catch {
    return NextResponse.json({ images: [] });
  }
}
