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

// ── 산출물 검증 (2026-07-09/10 그레이 팔레트 재발 방지) ──
// isUsableBrandColor는 "시드로 쓸 수 있는가"만 본다. 통과한 시드라도(예: 채도는
// 있지만 명도가 매우 낮은 짙은 남색 #0f172a — s≈0.47인데 l≈0.11)를 그대로
// primary에 쓰면 화면에서 거의 검정처럼 보인다. 이런 케이스는 대비비만으로는
// 못 잡는다 — 어두운 색은 흰 배경 대비 오히려 대비비가 "높게"(예: 17.8) 나오기
// 때문. 그래서 명도 하한선을 별도로 두고, 채도·대비비와 함께 검증한다.
const MIN_PRIMARY_SATURATION = 0.35;
const MIN_PRIMARY_LIGHTNESS = 0.3; // 이보다 어두우면 배경과 무관하게 "검정"처럼 보임
const MIN_PRIMARY_CONTRAST = 2.5; // 배경과 실질적으로 구분되는지의 안전망(WCAG 3:1보다 약간 관대 — 채도 있는 중간톤 색까지 통과시키기 위함)
// 문서가 명시한 실제 배경색(예: #0f172a) 위에 얹는 primary는 텍스트로도 쓰일 수 있어
// WCAG AA 텍스트 기준(4.5:1)까지 확보한다 — 합성 기본 배경(DARK_BG)에는 적용하지 않는다.
const MIN_PRIMARY_CONTRAST_EXPLICIT_BG = 4.5;

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG 2.x 대비비 공식. 1(무대비)~21(최대 대비).
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

// primary가 배경과 구분 안 되는 무채색(짙은 남색·회색·검정)으로 나오는 걸
// 막는다. 채도·명도를 하한까지 끌어올리고, 그래도 대비비가 부족하면 배경 반대
// 방향으로 명도를 조금씩 밀며 재시도한다. 이미 기준을 만족하면 원본 hex를
// 그대로 반환(불필요한 HSL 왕복 변환으로 인한 반올림 오차 방지).
function ensureVividPrimary(
  hex: string,
  backgroundHex: string,
  minContrast: number = MIN_PRIMARY_CONTRAST,
): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  if (
    hsl.s >= MIN_PRIMARY_SATURATION &&
    hsl.l >= MIN_PRIMARY_LIGHTNESS &&
    contrastRatio(hex, backgroundHex) >= minContrast
  ) {
    return hex;
  }

  let { h, s, l } = hsl;
  if (s < MIN_PRIMARY_SATURATION) s = MIN_PRIMARY_SATURATION;
  if (l < MIN_PRIMARY_LIGHTNESS) l = MIN_PRIMARY_LIGHTNESS;
  let candidate = hslToHex({ h, s, l });
  const bgIsDark = relativeLuminance(backgroundHex) < 0.5;
  let attempts = 0;
  while (
    contrastRatio(candidate, backgroundHex) < minContrast &&
    attempts < 12
  ) {
    l = bgIsDark ? Math.min(0.92, l + 0.03) : Math.max(0.08, l - 0.03);
    candidate = hslToHex({ h, s, l });
    attempts++;
  }
  return candidate;
}

const LIGHT_BG = "#FFFFFF";
const DARK_BG = "#0F1115";

function buildPair(
  optionId: string,
  label: string,
  primary: string,
  secondary: string,
  accent: string,
  // "미니멀형" 계열은 primary를 의도적으로 저채도로 설계한다(포인트는
  // accent가 담당) — 그런 경우엔 채도 강제 보정을 건너뛴다.
  enforceVividPrimary = true,
  // 문서가 명시한 배경색(explicitRequirements) — 있으면 다크 배경 앵커로 쓰고,
  // 합성 기본값(DARK_BG)이 아니라 "실제 이 배경 위에서" 대비를 확보한다 (게이트 1 정정).
  darkBg: string = DARK_BG,
): PaletteOption {
  const isExplicitBg = darkBg !== DARK_BG;
  const darkContrastFloor = isExplicitBg
    ? MIN_PRIMARY_CONTRAST_EXPLICIT_BG
    : MIN_PRIMARY_CONTRAST;
  const darkPrimaryRaw = adjust(primary, { l: 0.12 }); // 다크에서 시인성 확보
  const light: Palette = {
    mode: "light",
    primary: enforceVividPrimary ? ensureVividPrimary(primary, LIGHT_BG) : primary,
    secondary,
    accent,
    background: LIGHT_BG,
    surface: "#F7F8FA",
    text: "#1C1F24",
    navigation: "#FFFFFF",
  };
  const dark: Palette = {
    mode: "dark",
    primary: enforceVividPrimary
      ? ensureVividPrimary(darkPrimaryRaw, darkBg, darkContrastFloor)
      : darkPrimaryRaw,
    secondary: adjust(secondary, { l: 0.12 }),
    accent: adjust(accent, { l: 0.08 }),
    background: darkBg,
    surface: adjust(darkBg, { l: 0.04 }),
    text: "#E8EAED",
    navigation: adjust(darkBg, { l: 0.015 }),
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
  darkBg: string = DARK_BG,
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
        true,
        darkBg,
      );
    case "brand-contrast":
      return buildPair(
        "brand-contrast",
        "브랜드 대비형",
        brand,
        adjust(brand, { h: -20 + j(20), l: 0.1 + j(0.05) }),
        adjust(brand, { h: 180 + j(20), s: 0.05 + j(0.05) }), // 보색 포인트
        true,
        darkBg,
      );
    case "brand-minimal":
      return buildPair(
        "brand-minimal",
        "브랜드 미니멀형",
        adjust(brand, { s: -0.35 + j(0.1) }),
        "#6B7280",
        brand,
        false, // 저채도 primary가 의도된 디자인 — accent가 브랜드색을 담당
        darkBg,
      );
  }
}

export function generatePaletteOptions(
  brandColors: string[] = [],
  // 문서 명시 배경색(explicitRequirements의 background-color) — 있으면 dark 배경 앵커로 사용.
  backgroundOverride?: string,
): PaletteOption[] {
  const darkBg = normalizeHex(backgroundOverride ?? "") ?? DARK_BG;
  const brand = brandColors
    .map(normalizeHex)
    .find((c): c is string => Boolean(c && isUsableBrandColor(c)));

  if (brand) {
    // 브랜드컬러 기반 3변주: 원색 충실 / 보색 포인트 / 저채도 미니멀
    return BRAND_OPTION_IDS.map((id) => buildBrandOption(id, brand, false, darkBg));
  }

  return [
    buildPair("trust", "신뢰형", "#2563EB", "#64748B", "#0EA5E9", true, darkBg),
    buildPair("innovation", "혁신형", "#7C3AED", "#14B8A6", "#F59E0B", true, darkBg),
    buildPair("minimal", "미니멀형", "#1C1F24", "#6B7280", "#2563EB", false, darkBg),
  ];
}

// 브랜드 기반 3세트 중 하나만 다른 변주로 재생성 (나머지 2개는 그대로 유지).
// "3개 다 별로는 아닌데 이 하나만 별로일 때" 대안 (flow-spec ④ 보강).
export function regenerateBrandOption(
  brand: string,
  optionId: string,
  backgroundOverride?: string,
): PaletteOption | null {
  if (!hexToHsl(brand)) return null;
  if (!(BRAND_OPTION_IDS as readonly string[]).includes(optionId)) return null;
  const darkBg = normalizeHex(backgroundOverride ?? "") ?? DARK_BG;
  return buildBrandOption(optionId as BrandOptionId, brand, true, darkBg);
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
