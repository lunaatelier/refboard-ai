import type { Palette, PaletteOption } from "./types";

// 팔레트 3세트 생성 (Step 10-a) — isomorphic 순수 함수, 외부 호출 없음.
// 브랜드컬러가 있으면 그 기반 3변주, 없으면 무드 기반 3세트(신뢰형/혁신형/미니멀형).

interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function hexToHsl(hex: string): Hsl | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

function adjust(hex: string, delta: Partial<Hsl>): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  return hslToHex({
    h: hsl.h + (delta.h ?? 0),
    s: Math.min(1, Math.max(0, hsl.s + (delta.s ?? 0))),
    l: Math.min(1, Math.max(0, hsl.l + (delta.l ?? 0))),
  });
}

function normalizeHex(hex: string): string | null {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  return m ? `#${m[1].toUpperCase()}` : null;
}

function isUsableBrandColor(hex: string): boolean {
  const hsl = hexToHsl(hex);
  if (!hsl) return false;
  // Gemini can return placeholder black/gray from documents. If used as the
  // brand seed, every generated variation becomes gray, so ignore neutrals.
  return hsl.s >= 0.12 && hsl.l >= 0.08 && hsl.l <= 0.92;
}

function buildPair(
  optionId: string,
  label: string,
  primary: string,
  secondary: string,
  accent: string,
): PaletteOption {
  const light: Palette = {
    mode: "light",
    primary,
    secondary,
    accent,
    background: "#FFFFFF",
    surface: "#F7F8FA",
    text: "#1C1F24",
    navigation: "#FFFFFF",
  };
  const dark: Palette = {
    mode: "dark",
    primary: adjust(primary, { l: 0.12 }), // 다크에서 시인성 확보
    secondary: adjust(secondary, { l: 0.12 }),
    accent: adjust(accent, { l: 0.08 }),
    background: "#0F1115",
    surface: "#171A21",
    text: "#E8EAED",
    navigation: "#12151B",
  };
  return { optionId, label, light, dark };
}

const BRAND_OPTION_IDS = ["brand-faithful", "brand-contrast", "brand-minimal"] as const;
type BrandOptionId = (typeof BRAND_OPTION_IDS)[number];

// jitter=false면 항상 같은 값(초기 3세트 생성용, 재현 가능해야 함 — 테스트 기준).
// jitter=true면 델타에 랜덤 편차를 더해 "이 변주만 다시" 눌렀을 때 매번 다르게 나온다.
function buildBrandOption(
  optionId: BrandOptionId,
  brand: string,
  jitter: boolean,
): PaletteOption {
  const j = (range: number) => (jitter ? (Math.random() * 2 - 1) * range : 0);
  switch (optionId) {
    case "brand-faithful":
      return buildPair(
        "brand-faithful",
        "브랜드 충실형",
        brand,
        adjust(brand, { l: 0.18 + j(0.05), s: -0.1 + j(0.05) }),
        adjust(brand, { h: 30 + j(20), s: 0.1 + j(0.05) }),
      );
    case "brand-contrast":
      return buildPair(
        "brand-contrast",
        "브랜드 대비형",
        brand,
        adjust(brand, { h: -20 + j(20), l: 0.1 + j(0.05) }),
        adjust(brand, { h: 180 + j(20), s: 0.05 + j(0.05) }), // 보색 포인트
      );
    case "brand-minimal":
      return buildPair(
        "brand-minimal",
        "브랜드 미니멀형",
        adjust(brand, { s: -0.35 + j(0.1) }),
        "#6B7280",
        brand,
      );
  }
}

export function generatePaletteOptions(
  brandColors: string[] = [],
): PaletteOption[] {
  const brand = brandColors
    .map(normalizeHex)
    .find((c): c is string => Boolean(c && isUsableBrandColor(c)));

  if (brand) {
    // 브랜드컬러 기반 3변주: 원색 충실 / 보색 포인트 / 저채도 미니멀
    return BRAND_OPTION_IDS.map((id) => buildBrandOption(id, brand, false));
  }

  return [
    buildPair("trust", "신뢰형", "#2563EB", "#64748B", "#0EA5E9"),
    buildPair("innovation", "혁신형", "#7C3AED", "#14B8A6", "#F59E0B"),
    buildPair("minimal", "미니멀형", "#1C1F24", "#6B7280", "#2563EB"),
  ];
}

// 브랜드 기반 3세트 중 하나만 다른 변주로 재생성 (나머지 2개는 그대로 유지).
// "3개 다 별로는 아닌데 이 하나만 별로일 때" 대안 (flow-spec ④ 보강).
export function regenerateBrandOption(
  brand: string,
  optionId: string,
): PaletteOption | null {
  if (!hexToHsl(brand)) return null;
  if (!(BRAND_OPTION_IDS as readonly string[]).includes(optionId)) return null;
  return buildBrandOption(optionId as BrandOptionId, brand, true);
}

// 선택 옵션에서 역할에 배치할 수 있는 색 풀 (중복 제거)
export function colorPool(option: PaletteOption): string[] {
  const all = [option.light, option.dark].flatMap((p) => [
    p.primary,
    p.secondary,
    p.accent,
    p.background,
    p.surface,
    p.text,
    p.navigation,
  ]);
  return [...new Set(all)];
}
