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
  sourceUrl: string;
  usage: "inspiration-only";
  fetchedAt: string;
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
    sourceUrl: img.sourceUrl,
    usage: img.usage,
    fetchedAt: img.fetchedAt,
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

// ── 이미지 상세 조작 (P3-4) — 전부 순수 함수, DirectionOption 하나를 받아
// 새 DirectionOption을 반환한다. 호출 측(UI)이 references.directionOptions
// 배열에서 해당 방향만 이 결과로 교체한다. ──

export const MAX_SELECTED_IMAGES = 4;

// 최대 4장까지만 선택 가능 — 이미 4장이면 추가 선택을 막는다(변경 없이 그대로 반환).
export function setImageSelected(
  direction: DirectionOption,
  url: string,
  selected: boolean,
): DirectionOption {
  const selectedCount = direction.imageCandidates.filter((c) => c.selected).length;
  if (selected && selectedCount >= MAX_SELECTED_IMAGES) return direction;
  return {
    ...direction,
    imageCandidates: direction.imageCandidates.map((c) =>
      c.url === url ? { ...c, selected } : c,
    ),
  };
}

export function setImageRole(
  direction: DirectionOption,
  url: string,
  role: ImageRole,
): DirectionOption {
  return {
    ...direction,
    imageCandidates: direction.imageCandidates.map((c) =>
      c.url === url ? { ...c, role } : c,
    ),
  };
}

// 선택된 이미지끼리만 순서를 바꾼다 — 미선택 이미지는 순서 경쟁에서 제외.
export function moveSelectedImage(
  direction: DirectionOption,
  url: string,
  delta: -1 | 1,
): DirectionOption {
  const selected = direction.imageCandidates
    .filter((c) => c.selected)
    .sort((a, b) => a.order - b.order);
  const idx = selected.findIndex((c) => c.url === url);
  const targetIdx = idx + delta;
  if (idx < 0 || targetIdx < 0 || targetIdx >= selected.length) return direction;
  const reordered = [...selected];
  [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
  const orderByUrl = new Map(reordered.map((c, i) => [c.url, i]));
  return {
    ...direction,
    imageCandidates: direction.imageCandidates.map((c) =>
      orderByUrl.has(c.url) ? { ...c, order: orderByUrl.get(c.url)! } : c,
    ),
  };
}

// 후보 하나를 다른 이미지로 교체 — role/selected/order는 그대로 유지.
export function replaceImageCandidate(
  direction: DirectionOption,
  url: string,
  next: SearchedImageLike,
): DirectionOption {
  return {
    ...direction,
    imageCandidates: direction.imageCandidates.map((c) =>
      c.url === url
        ? {
            ...c,
            url: next.url,
            source: next.source,
            attribution: next.attribution,
            sourceUrl: next.sourceUrl,
            usage: next.usage,
            fetchedAt: next.fetchedAt,
          }
        : c,
    ),
  };
}

// 검색어를 바꿔 다시 생성한 결과로 이미지 세트 전체를 교체(역할/선택 기본값 재적용).
export function applyRegeneratedImages(
  direction: DirectionOption,
  images: SearchedImageLike[],
): DirectionOption {
  return { ...direction, imageCandidates: toImageCandidates(images) };
}
