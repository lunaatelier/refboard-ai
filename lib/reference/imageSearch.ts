import { hexToHsl } from "./palette";

// 무드보드 이미지 재생성 (P3-2) — 검색어 편집/컬러 유지/제외 키워드를 실제
// Unsplash·Pexels 요청으로 바꾸는 순수 함수만 여기 둔다. fetch 자체는
// app/api/mood-images/route.ts에 남긴다(외부 호출은 항상 Route Handler에서만).
//
// "피사체 유지"는 서버 파라미터가 아니다 — 클라이언트가 재생성 시 검색어의
// 피사체 단어를 그대로 두고 나머지만 편집하는 UI 동작이라, 서버는 그냥
// 넘어온 query를 그대로 쓴다.

export interface ImageSearchParams {
  query: string;
  colorHex?: string; // "컬러 유지" 체크 시에만 채워 보낸다
  excludeKeywords?: string[]; // "제외 키워드 추가"
  page?: number; // "다시 생성" — 페이지를 올려 다른 결과를 받는다
}

export interface SearchedImage {
  id: string;
  url: string;
  source: "unsplash" | "pexels";
  attribution: string;
}

const UNSPLASH_COLORS = [
  "black",
  "white",
  "yellow",
  "orange",
  "red",
  "purple",
  "magenta",
  "green",
  "teal",
  "blue",
] as const;
export type UnsplashColor = (typeof UNSPLASH_COLORS)[number];

// Unsplash는 고정된 색상 이름만 받는다(hex 불가) — HSL 색상환을 구간으로
// 나눠 가장 가까운 이름으로 매핑한다. 무채색(저채도)은 굳이 강제하지 않고
// undefined를 반환해 색상 필터 없이 검색한다(더 넓은 결과 유지).
export function hexToUnsplashColor(hex: string): UnsplashColor | undefined {
  const hsl = hexToHsl(hex);
  if (!hsl) return undefined;
  const { h, s, l } = hsl;
  if (l >= 0.92) return "white";
  if (l <= 0.08) return "black";
  if (s <= 0.12) return undefined;
  if (h < 15 || h >= 345) return "red";
  if (h < 45) return "orange";
  if (h < 70) return "yellow";
  if (h < 170) return "green";
  if (h < 200) return "teal";
  if (h < 260) return "blue";
  if (h < 320) return "purple";
  return "magenta";
}

export function buildUnsplashSearchUrl(params: ImageSearchParams): string {
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", params.query);
  url.searchParams.set("per_page", "8");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("page", String(params.page ?? 1));
  const color = params.colorHex ? hexToUnsplashColor(params.colorHex) : undefined;
  if (color) url.searchParams.set("color", color);
  return url.toString();
}

// Pexels는 이름 있는 색상뿐 아니라 hex도 그대로 받는다 — 매핑이 필요 없다.
export function buildPexelsSearchUrl(params: ImageSearchParams): string {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", params.query);
  url.searchParams.set("per_page", "8");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("page", String(params.page ?? 1));
  if (params.colorHex) url.searchParams.set("color", params.colorHex);
  return url.toString();
}

// 두 제공자 모두 "제외" 검색 연산자가 없다 — 결과의 설명 텍스트에 제외
// 키워드가 나오면 서버에서 걸러낸다.
function matchesExcluded(text: string | undefined | null, excludeKeywords: string[]): boolean {
  if (!text || excludeKeywords.length === 0) return false;
  const lower = text.toLowerCase();
  return excludeKeywords.some((k) => k.trim() !== "" && lower.includes(k.trim().toLowerCase()));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseUnsplashResults(
  raw: unknown,
  excludeKeywords: string[] = [],
): SearchedImage[] {
  const results = Array.isArray((raw as any)?.results) ? (raw as any).results : [];
  return results
    .filter((r: any) => typeof r?.urls?.small === "string")
    .filter((r: any) => !matchesExcluded(r?.alt_description ?? r?.description, excludeKeywords))
    .map((r: any) => ({
      id: `unsplash-${r.id}`,
      url: r.urls.small,
      source: "unsplash" as const,
      attribution: `${r?.user?.name ?? "Unknown"} / Unsplash`,
    }));
}

export function parsePexelsResults(
  raw: unknown,
  excludeKeywords: string[] = [],
): SearchedImage[] {
  const photos = Array.isArray((raw as any)?.photos) ? (raw as any).photos : [];
  return photos
    .filter((p: any) => typeof p?.src?.medium === "string")
    .filter((p: any) => !matchesExcluded(p?.alt, excludeKeywords))
    .map((p: any) => ({
      id: `pexels-${p.id}`,
      url: p.src.medium,
      source: "pexels" as const,
      attribution: `${p?.photographer ?? "Unknown"} / Pexels`,
    }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */
