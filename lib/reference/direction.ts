import type {
  DirectionImageCandidate,
  DirectionOption,
  ImageRole,
  MoodOption,
  PaletteOption,
} from "./types";

// 방향 카드 조립 (P3-3) — 무드+팔레트+이미지 검색 결과를 하나의 DirectionOption으로
// 묶는 순수 함수. 이미지 후보는 최대 6장, 앞쪽 4장을 기본 선택으로 둔다.
// (대표 1 + 보조 2~3 → hero/supporting 위계, 나머지는 detail로 예비)

export interface SearchedImageLike {
  url: string;
  source: "unsplash" | "pexels";
  attribution: string;
}

const ROLE_BY_INDEX: ImageRole[] = [
  "hero",
  "supporting",
  "supporting",
  "supporting",
  "detail",
  "detail",
];

function toImageCandidates(images: SearchedImageLike[]): DirectionImageCandidate[] {
  return images.slice(0, 6).map((img, i) => ({
    url: img.url,
    source: img.source,
    attribution: img.attribution,
    role: ROLE_BY_INDEX[i] ?? "detail",
    selected: i < 4,
    order: i,
  }));
}

export function buildDirectionOptions(
  moods: MoodOption[],
  paletteOptions: PaletteOption[],
  imagesByMoodId: Record<string, SearchedImageLike[]>,
): DirectionOption[] {
  const paletteById = new Map(paletteOptions.map((p) => [p.optionId, p]));
  return moods
    .filter((mood) => paletteById.has(mood.paletteOptionId))
    .map((mood) => ({
      directionId: mood.id,
      label: mood.label,
      description: mood.description,
      paletteOptionId: mood.paletteOptionId,
      moodOptionId: mood.id,
      keywords: mood.keywords.slice(0, 5),
      typography: mood.typography,
      styleAttributes: {
        radius: mood.styleAttributes.radius,
        density: mood.styleAttributes.density,
        contrast: mood.styleAttributes.contrast,
      },
      imageCandidates: toImageCandidates(imagesByMoodId[mood.id] ?? []),
      recommendedDirections: mood.recommendedDirections,
      avoidDirections: mood.avoidDirections,
    }));
}
