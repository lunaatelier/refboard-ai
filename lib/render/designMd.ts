// Phase 5 렌더러 — ConceptJson(SSoT)의 확정 ConceptOption을 표준 디자인 MD
// 스키마(docs/design-system-schema.md v1.1.1) 인스턴스로 변환한다.
// 서버 렌더링 없음(CLAUDE.md §4.5) — isomorphic 순수 함수, 클라이언트에서 호출.
//
// source: concept 인스턴스 특성 (스키마 §1 완화 규칙):
// - ConceptOption.designBasis(팔레트·무드·타이포 방향)만 있고 실측 hex/px는 없다.
//   그래서 채워지는 토큰 대부분이 proposed(팔레트 자체가 AI 제안) 또는
//   derived(대비 계산 등으로 파생) 또는 fallback(계약 기본 스케일)이며,
//   extracted(실측)는 하나도 없다. 이 사실 자체가 concept 인스턴스의 정의다.
// - 필수 컴포넌트 4종·상태 변형 순회 의무가 면제된다 — 없으면 Known Gaps로 대체.
// - status는 항상 draft 고정 (confirmed 여부와 무관하게 fix 모드 입력 불가 — check만).
//
// Known Gaps 생성 원칙(검증 피드백 반영): reason 문자열은 항상 실제로 채운
// 토큰의 .source/.from/.use에서 파생한다. 별도 하드코딩 문구를 병렬로 두지
// 않는다 — 두 곳(토큰 자체 vs known-gaps)이 서로 다른 값을 주장하는 자기모순을
// 코드 구조로 원천 차단한다.

import type { ConceptOptionWithDesignBasis, DesignBasis } from "../concept/types";
import type { DomainHint } from "../analysis/types";

export type TokenSource = "extracted" | "mapped" | "derived" | "proposed" | "fallback";

export interface TokenLeaf {
  value: string;
  source: TokenSource;
  from?: string;
  use?: string;
}

export interface TypographySlot {
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  use: string;
  source: TokenSource;
}

export interface ComponentEntry {
  category: string;
  type: string;
  backgroundColor?: string;
  textColor?: string;
  typography?: string;
  rounded?: string;
  shadow?: string;
  border?: string;
  padding?: string;
  height?: string;
  use: string;
  source: TokenSource;
}

interface NormalizeAxis {
  strategy: string;
  threshold: null;
}

export interface RulesBlock {
  normalize: {
    color: NormalizeAxis;
    "font-size": NormalizeAxis;
    spacing: NormalizeAxis;
    radius: NormalizeAxis;
    "on-fail": "report";
    exceptions: string[];
  };
  constraints: Array<{
    id: string;
    severity: "must" | "should";
    scope: string;
    rule: string;
  }>;
}

export interface KnownGap {
  category: string;
  type: string;
  reason: string;
}

export interface DesignMdInstance {
  meta: {
    name: string;
    "schema-version": string;
    "instance-version": string;
    mode: "light" | "dark";
    source: "concept";
    extracted: string;
    status: "draft";
  };
  colors: {
    semantic: Record<string, TokenLeaf>;
    primitive: Record<string, TokenLeaf>;
  };
  typography: {
    family: Record<string, TokenLeaf>;
    slots: Record<string, TypographySlot>;
  };
  spacing: Record<string, TokenLeaf>;
  rounded: Record<string, TokenLeaf>;
  shadow: Record<string, TokenLeaf>;
  components: Record<string, ComponentEntry>;
  rules: RulesBlock;
  "known-gaps": KnownGap[];
}

export interface RenderDesignMdOptions {
  projectTitle: string;
  option: ConceptOptionWithDesignBasis;
  domain?: DomainHint; // §13.2 spacing.section의 domain 분기 근거. 생략 시 "generic"(40px).
  extractedDate?: string; // "YYYY-MM-DD" — 생략 시 오늘 날짜
  instanceVersion?: string; // 생략 시 "0.1"
}

// ── 컬러 계산 (WCAG 2.x 상대 휘도/대비비 — on-primary/border 파생 + 자체 검증용) ──

// #rgb 또는 #rrggbb만 허용(# 생략도 허용). 검증 없이 parseInt에 넘기면 잘못된 값이
// NaN→비트연산 과정에서 조용히 0(검은색)이 되어 "완벽한 대비"로 오판되는 사고가 있었음
// (검증 피드백) — 원칙 1(실재 우선, 지어내지 않는다)에 따라 잘못된 값은 숨기지 않고 던진다.
const HEX_COLOR_RE = /^#?[0-9a-fA-F]{6}$|^#?[0-9a-fA-F]{3}$/;

function hexToRgb(hex: string): [number, number, number] {
  if (!HEX_COLOR_RE.test(hex)) {
    throw new Error(
      `designMd 렌더러: 유효하지 않은 hex 컬러값 "${hex}" — designBasis.palette 값을 확인하세요.`,
    );
  }
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rl, gl, bl] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

// WCAG 대비비 — (밝은 휘도+0.05)/(어두운 휘도+0.05). 1:1~21:1.
export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

export const AA_CONTRAST_THRESHOLD = 4.5; // rules.constraints의 contrast-minimum(§7.1)과 동일 기준
const ON_PRIMARY_LIGHT = "#FFFFFF";
const ON_PRIMARY_DARK = "#0F172A";

// on-primary는 흰색을 기본 후보로 하되, primary 대비 4.5:1(contrast-minimum 자체 검증)
// 미달이면 어두운 값으로 전환한다. 전환해도 미달이면(드문 경우) 더 나은 쪽을 쓰고
// known-gaps에 "AA 미달" 사실을 그대로 남긴다 — 지어내지 않는다(원칙 1).
function deriveOnPrimary(primaryHex: string): { value: string; ratio: number; meetsAA: boolean } {
  const whiteRatio = contrastRatio(primaryHex, ON_PRIMARY_LIGHT);
  if (whiteRatio >= AA_CONTRAST_THRESHOLD) {
    return { value: ON_PRIMARY_LIGHT, ratio: whiteRatio, meetsAA: true };
  }
  const darkRatio = contrastRatio(primaryHex, ON_PRIMARY_DARK);
  return { value: ON_PRIMARY_DARK, ratio: darkRatio, meetsAA: darkRatio >= AA_CONTRAST_THRESHOLD };
}

function deriveBorderColor(mode: "light" | "dark", textHex: string): string {
  const [r, g, b] = hexToRgb(textHex);
  const alpha = mode === "light" ? 0.12 : 0.16;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── Known Gaps reason 파생 (단일 원천: 토큰 자체의 source/from/use) ──

function sourceReasonBase(source: TokenSource, from?: string): string {
  switch (source) {
    case "proposed":
      return "concept 팔레트/스케일 제안값(proposed) — 실측 확인 전 검수 필요";
    case "mapped":
      return `전용 값 없음 — ${from ?? "다른 토큰"} 값 매핑(mapped)`;
    case "derived":
      return "실측/제안값에 없는 슬롯 — 계산으로 파생(derived)";
    case "fallback":
      return "실측 없음 — 계약 기본값(fallback) 사용";
    case "extracted":
      return "실측값이나 재검증 목적으로 기록";
  }
}

// 토큰의 .use를 그대로 이어붙인다 — known-gaps 문구가 토큰 자체가 말하는 것과
// 항상 같은 문장을 공유하게 해서 "JSON은 proposed인데 gap은 mapped" 같은
// 자기모순이 구조적으로 발생할 수 없게 한다.
function tokenGapReason(t: { source: TokenSource; from?: string; use?: string }, extra?: string): string {
  const base = sourceReasonBase(t.source, t.from);
  const withUse = t.use ? `${base} — ${t.use}` : base;
  return extra ? `${withUse} — ${extra}` : withUse;
}

// spacing/rounded처럼 여러 키가 한 known-gap 항목으로 묶이는 축은 전부 같은
// source여야만 하나의 집계 문구가 정확하다 — 혼재되면 개별화가 필요하다는
// 신호이므로 조용히 잘못된 문구를 내지 않고 에러로 드러낸다.
function assertUniformSource(entries: Record<string, { source: TokenSource }>): TokenSource {
  const sources = new Set(Object.values(entries).map((e) => e.source));
  if (sources.size !== 1) {
    throw new Error(
      `known-gaps 집계 실패 — 스케일 내 토큰 source가 혼재됨(${[...sources].join(", ")}). 개별 gap 항목으로 분리해야 함.`,
    );
  }
  return [...sources][0];
}

// ── 축별 빌더 ──

// 필수 7종(§2.2) + 독립 역할 확장(§2.8: secondary/accent) + variant 확장(surface-alt).
// designBasis.palette는 AI 제안 팔레트라 전량 proposed — on-primary/border만
// 팔레트에 없는 슬롯이라 derived, text-muted는 secondary를 mapped.
function buildSemanticColors(
  designBasis: DesignBasis,
  mode: "light" | "dark",
): Record<string, TokenLeaf> {
  const p = designBasis.palette;
  const onPrimary = deriveOnPrimary(p.primary);
  return {
    primary: { value: p.primary, source: "proposed", use: "브랜드 인터랙션 컬러 — CTA·핵심 액션" },
    "on-primary": {
      value: onPrimary.value,
      source: "derived",
      use: "primary 등 채움 배경 위 텍스트/아이콘 — primary 대비 검증(AA 4.5:1) 후 파생, 팔레트에 없던 슬롯",
    },
    canvas: { value: p.background, source: "proposed", use: "페이지 최하단 배경" },
    surface: { value: p.surface, source: "proposed", use: "카드 등 canvas 위 한 단계 표면" },
    text: { value: p.text, source: "proposed", use: "기본 텍스트" },
    "text-muted": {
      value: p.secondary,
      source: "mapped",
      from: "secondary",
      use: "보조 텍스트 — 전용 색이 없어 secondary 매핑",
    },
    border: {
      value: deriveBorderColor(mode, p.text),
      source: "derived",
      use: "기본 테두리·구분선 (text 기준 반투명 파생, 팔레트에 없던 슬롯)",
    },
    secondary: { value: p.secondary, source: "proposed", use: "보조 브랜드컬러 — 카드 부제·아이콘 등" },
    accent: { value: p.accent, source: "proposed", use: "포인트·CTA 강조 컬러" },
    "surface-alt": {
      value: p.navigation,
      source: "proposed",
      use: "GNB/LNB 배경 — canvas와 분리된 표면",
    },
  };
}

// 권장 토큰(§2.3) — 컨셉 팔레트에 실재하지 않으므로 지어내지 않는다. Known Gaps로만 기록.
const ABSENT_RECOMMENDED_COLORS = ["error", "success", "warning", "link", "primary-hover", "primary-active"];

// schema-v1.1.1-patch §13.4 — spacing/rounded/typography 크기 슬롯이 §13 계약 기본값으로
// 채워졌을 때 known-gaps reason은 이 고정 문구를 그대로 쓴다(스키마 자체가 지정한 표기).
// family(폰트, §3.4 fallback)·shadow(§13 대상 아님)에는 적용하지 않는다.
const SCHEMA_13_REASON = "schema §13 concept 기본 스케일 적용";

const FAMILY_FALLBACK_SANS =
  "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
const FAMILY_FALLBACK_MONO = "JetBrains Mono, D2Coding, monospace";

// 필수 슬롯 7종(§3.1) — concept 단계는 실제 폰트·px가 없어 schema §13.3 기본 스케일(fallback)로
// 채운다. caption도 14px(§13.3이 명시한 하한) — rules.constraints의 min-body-size(필수,
// 최소 14px)와 이 인스턴스 자신의 fallback 스케일이 서로 어긋나면 안 되기 때문이다.
function buildTypography(): { family: Record<string, TokenLeaf>; slots: Record<string, TypographySlot> } {
  const slot = (
    fontSize: string,
    fontWeight: number,
    lineHeight: number,
    letterSpacing: number,
    use: string,
  ): TypographySlot => ({
    fontFamily: "{typography.family.sans}",
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
    use,
    source: "fallback",
  });

  return {
    family: {
      sans: { value: FAMILY_FALLBACK_SANS, source: "fallback", use: "본문·헤딩 공통 — 실제 폰트 미확정" },
      mono: { value: FAMILY_FALLBACK_MONO, source: "fallback", use: "수치·코드성 표기 — 실제 폰트 미확정" },
    },
    slots: {
      display: slot("44px", 700, 1.2, -0.02, "최대 제목 — 히어로"),
      heading: slot("30px", 700, 1.3, -0.01, "섹션 제목"),
      title: slot("20px", 600, 1.4, 0, "카드/항목 제목"),
      body: slot("16px", 400, 1.6, 0, "기본 본문"),
      "body-sm": slot("14px", 400, 1.5, 0, "보조 본문"),
      caption: slot("14px", 500, 1.4, 0.02, "메타 정보·라벨 — schema §13.3 하한(14px), min-body-size 준수"),
      button: slot("15px", 600, 1.2, 0, "버튼 전용"),
    },
  };
}

// spacing(§13.2)/rounded(§13.1) — schema-v1.1.1-patch로 명문화된 concept 인스턴스
// 전용 계약 기본값. §4/§5.1의 일반 예시 스케일과는 다른, source: concept에 한정된
// 별도 정의 — 값 자체가 스키마 §13에 정확히 고정되어 있으므로 "fallback" source
// 표기가 정당하다(계약 근거 있음).
const SECTION_SPACING_BY_DOMAIN: Record<DomainHint, string> = {
  "marketing-web": "80px",
  "dashboard-ops": "40px",
  "mobile-app": "24px",
  document: "80px",
  generic: "40px",
};

function buildSpacing(domain: DomainHint): Record<string, TokenLeaf> {
  const use = "concept 단계 — 실측 spacing 없음, schema §13.2 기본 스케일";
  return {
    "base-unit": { value: "8px", source: "fallback", use: "그리드 기준" },
    xs: { value: "4px", source: "fallback", use },
    sm: { value: "8px", source: "fallback", use },
    md: { value: "16px", source: "fallback", use },
    lg: { value: "24px", source: "fallback", use },
    xl: { value: "32px", source: "fallback", use },
    section: {
      value: SECTION_SPACING_BY_DOMAIN[domain],
      source: "fallback",
      use: `섹션 수직 여백 — domain(${domain}) 기준 schema §13.2 표`,
    },
  };
}

function buildRounded(): Record<string, TokenLeaf> {
  const use = "concept 단계 — 실측 radius 없음, schema §13.1 기본 스케일";
  return {
    none: { value: "0px", source: "fallback", use: "라운딩 안 함(의도적 선언)" },
    xs: { value: "2px", source: "fallback", use },
    sm: { value: "4px", source: "fallback", use },
    md: { value: "8px", source: "fallback", use },
    lg: { value: "12px", source: "fallback", use },
    xl: { value: "16px", source: "fallback", use },
    full: { value: "9999px", source: "fallback", use: "pill/원형 — " + use },
  };
}

// shadow(§5.2) — none 외 레벨은 실재를 확인할 방법이 없어(concept 단계) 지어내지 않는다.
function buildShadow(): Record<string, TokenLeaf> {
  return {
    none: { value: "none", source: "fallback", use: "그림자 없음(의도적 선언)" },
  };
}

// 필수 컴포넌트 4종(§6.2) — source: concept 완화 규칙: 미충족 허용.
// button-primary/card-default는 팔레트·라운드 토큰만으로 concept 레벨 제안,
// button-secondary/input-default는 컨셉 단계에서 다뤄지지 않아 Known Gaps로만 남긴다.
function buildComponents(): Record<string, ComponentEntry> {
  return {
    "button-primary": {
      category: "action",
      type: "button",
      backgroundColor: "{colors.primary}",
      textColor: "{colors.on-primary}",
      typography: "{typography.button}",
      rounded: "{rounded.md}",
      use: "핵심 액션 버튼 — concept 레벨(배경·문자·타이포·라운드만), 상태 변형(hover/active/disabled) 미정",
      source: "proposed",
    },
    "card-default": {
      category: "data-display",
      type: "card",
      backgroundColor: "{colors.surface}",
      rounded: "{rounded.md}",
      border: "1px solid {colors.border}",
      use: "정보 카드 — concept 레벨, 패딩·그림자 등 세부 미정",
      source: "proposed",
    },
  };
}

function buildRules(moodKeywords: string[]): RulesBlock {
  return {
    normalize: {
      color: { strategy: "nearest-semantic", threshold: null },
      "font-size": { strategy: "snap-to-slot", threshold: null },
      spacing: { strategy: "snap-to-base-unit", threshold: null },
      radius: { strategy: "snap-to-scale", threshold: null },
      "on-fail": "report",
      exceptions: [],
    },
    constraints: [
      {
        id: "single-interaction-color",
        severity: "must",
        scope: "action",
        rule: "모든 인터랙티브 요소는 {colors.primary} 계열만 사용한다. 제2 액센트 도입 금지",
      },
      {
        id: "contrast-minimum",
        severity: "must",
        scope: "colors",
        rule: "모든 배경↔텍스트 쌍은 WCAG AA(4.5:1) 이상. 미달 시 report",
      },
      {
        id: "min-body-size",
        severity: "must",
        scope: "typography",
        rule: "화면 표시 텍스트 최소 14px",
      },
      {
        id: "mood-consistency",
        severity: "should",
        scope: "*",
        rule: `전체 톤은 "${moodKeywords.join("·")}" 분위기에서 벗어나지 않는다`,
      },
      // §7.1: MD 본문 Don't는 별도 작성 금지 — constraints가 단일 원천이므로
      // Don't로 렌더링될 항목도 반드시 정식 constraint로 존재해야 한다.
      {
        id: "no-unverified-fix-apply",
        severity: "must",
        scope: "*",
        rule: "이 인스턴스의 proposed/derived/fallback 토큰을 실측 검수 없이 apply의 fix 모드에 사용하는 것을 금지한다 (source: concept는 check 모드만 허용)",
      },
      {
        id: "no-fabricated-recommended-colors",
        severity: "must",
        scope: "colors",
        rule: "컨셉 팔레트에 없는 권장 컬러(error/success/warning/link 등)를 임의로 지어내는 것을 금지한다",
      },
    ],
  };
}

// extracted 외 모든 값 + 완전 부재 항목을 전부 기록한다(§10). concept 인스턴스는
// 거의 전부가 여기 해당 — 이게 "실측 이전 단계"라는 사실 자체를 기계가 읽을 수 있게 한다.
// reason은 전부 실제로 빌드된 토큰 객체(semantic/typography/spacing/rounded/shadow/components)
// 에서 파생한다 — 별도 하드코딩 문구를 두지 않는다(자기모순 방지, 위 파일 헤더 주석 참조).
function buildKnownGaps(built: {
  semantic: Record<string, TokenLeaf>;
  typography: { family: Record<string, TokenLeaf>; slots: Record<string, TypographySlot> };
  spacing: Record<string, TokenLeaf>;
  rounded: Record<string, TokenLeaf>;
  components: Record<string, ComponentEntry>;
}): KnownGap[] {
  const gaps: KnownGap[] = [];

  // 컬러 — 실제로 채운 슬롯은 토큰 자체에서 파생. on-primary는 최종 값 기준으로
  // 대비비를 재계산해 AA 충족 여부를 그대로 기록한다(추정 아님, 재계산).
  const colorKeys = [
    "primary",
    "on-primary",
    "canvas",
    "surface",
    "text",
    "text-muted",
    "border",
    "secondary",
    "accent",
    "surface-alt",
  ];
  for (const key of colorKeys) {
    const t = built.semantic[key];
    let extra: string | undefined;
    if (key === "on-primary") {
      const ratio = contrastRatio(built.semantic.primary.value, t.value);
      extra = `primary 대비 ${ratio.toFixed(2)}:1 (AA 4.5:1 ${ratio >= AA_CONTRAST_THRESHOLD ? "충족" : "미달, 최선값 사용"})`;
    }
    gaps.push({ category: "colors", type: key, reason: tokenGapReason(t, extra) });
  }
  // 권장 토큰 — 채워지지 않았으므로 토큰 객체가 없다(부재 자체가 사실).
  for (const t of ABSENT_RECOMMENDED_COLORS) {
    gaps.push({ category: "colors", type: t, reason: "concept 팔레트에 미정의(권장 토큰) — 지어내지 않음" });
  }

  // 타이포 — family(§3.4 fallback)는 토큰 자체에서 파생, 크기 슬롯 7종(§13.3 계약
  // 기본값)은 schema §13.4가 지정한 고정 문구를 쓴다.
  for (const [key, t] of Object.entries(built.typography.family)) {
    gaps.push({ category: "typography", type: `family.${key}`, reason: tokenGapReason(t) });
  }
  assertUniformSource(built.typography.slots);
  for (const key of Object.keys(built.typography.slots)) {
    gaps.push({ category: "typography", type: key, reason: SCHEMA_13_REASON });
  }

  // spacing/rounded(§13.1/13.2 계약 기본값) — 스케일 전체가 같은 source일 때만
  // 집계 문구 하나로 묶는다(다르면 assertUniformSource가 드러낸다).
  assertUniformSource(built.spacing);
  gaps.push({
    category: "spacing",
    type: `scale (${Object.keys(built.spacing).join("/")})`,
    reason: SCHEMA_13_REASON,
  });
  assertUniformSource(built.rounded);
  gaps.push({
    category: "rounded",
    type: `scale (${Object.keys(built.rounded).join("/")})`,
    reason: SCHEMA_13_REASON,
  });

  // shadow — none 외 레벨은 실재 여부를 확인할 방법이 없어 애초에 토큰을 만들지 않았다
  // (원칙 1: 실재 우선). 그래서 이 항목만은 부재 자체가 근거이며 개별 토큰이 없다.
  gaps.push({
    category: "shadow",
    type: "subtle/standard/elevated/modal",
    reason: "실재 그림자 레벨 미확인 — none 외 레벨은 지어내지 않음",
  });

  // 컴포넌트 — 채워진 2종은 component.use를 그대로 이어 쓰고, 부재 2종은 이유를 직접 기록.
  gaps.push({
    category: "action",
    type: "button-primary",
    reason: tokenGapReason(built.components["button-primary"]),
  });
  gaps.push({
    category: "action",
    type: "button-secondary",
    reason: "concept 단계, 컴포넌트 상세 미정의 (source: concept 완화 규칙 적용)",
  });
  gaps.push({
    category: "form",
    type: "input-default",
    reason: "concept 단계, 컴포넌트 상세 미정의 (source: concept 완화 규칙 적용)",
  });
  gaps.push({
    category: "data-display",
    type: "card-default",
    reason: tokenGapReason(built.components["card-default"]),
  });

  return gaps;
}

// ── 최상위 JSON 인스턴스(§11) — MD 후미 블록의 SSoT ──

export function buildDesignMdInstance(opts: RenderDesignMdOptions): DesignMdInstance {
  const { projectTitle, option } = opts;
  const mode = option.uiStructure.mode;
  const domain = opts.domain ?? "generic";
  const extracted = opts.extractedDate ?? new Date().toISOString().slice(0, 10);
  const instanceVersion = opts.instanceVersion ?? "0.1";

  const semantic = buildSemanticColors(option.designBasis, mode);
  const typography = buildTypography();
  const spacing = buildSpacing(domain);
  const rounded = buildRounded();
  const shadow = buildShadow();
  const components = buildComponents();

  return {
    meta: {
      name: `${projectTitle} — ${option.label}`,
      "schema-version": "1.1.1",
      "instance-version": instanceVersion,
      mode,
      source: "concept",
      extracted,
      status: "draft",
    },
    colors: { semantic, primitive: {} },
    typography,
    spacing,
    rounded,
    shadow,
    components,
    rules: buildRules(option.designBasis.moodKeywords),
    "known-gaps": buildKnownGaps({ semantic, typography, spacing, rounded, components }),
  };
}

// ── Rules 프로즈 파생(§7.1: "MD 본문은 constraints에서 파생 렌더링, 별도 작성 금지") ──
// Do/Don't 분류도 constraints.rule 문자열 자체에서 기계적으로 파생한다(별도 문구 없음).
// "금지"를 포함하는 rule은 Don't로, 그 외는 Do로 — 새 문구를 추가하려면 constraints
// 배열에 정식 항목을 추가해야 하고(§7.1 4필드 고정), 이 분류가 자동으로 반영한다.

function buildRulesProse(constraints: RulesBlock["constraints"]): { dos: string[]; donts: string[] } {
  const dos: string[] = [];
  const donts: string[] = [];
  for (const c of constraints) {
    (c.rule.includes("금지") ? donts : dos).push(`- ${c.rule}`);
  }
  return { dos, donts };
}

function groupGapsByCategory(gaps: KnownGap[]): string {
  const counts = new Map<string, number>();
  for (const g of gaps) counts.set(g.category, (counts.get(g.category) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([c, n]) => `${c} ${n}건`)
    .join(" / ");
}

// YAML 이중따옴표 스칼라로 이스케이프한다 — 프로젝트명(projectTitle/option.label)은
// 사용자 입력이라 ":", "#", 줄바꿈, 따옴표를 포함할 수 있고, 그대로 삽입하면 frontmatter
// 파싱이 깨진다(검증 피드백: "고객사: 신규 #1" 같은 이름이 status 키를 중복 생성시킴).
// 이중따옴표 스칼라 안에서는 콜론·해시가 리터럴로 취급되므로 이 형태 하나로 전부 막힌다.
function yamlDoubleQuote(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r\n/g, "\\n")
    .replace(/[\r\n]/g, "\\n");
  return `"${escaped}"`;
}

// ── MD 문서 조립 — §0 고정 8섹션 + frontmatter + 후미 JSON. 섹션 생략 없음. ──

export function renderDesignMd(opts: RenderDesignMdOptions): string {
  const instance = buildDesignMdInstance(opts);
  const { option } = opts;
  const db = option.designBasis;

  const frontmatter = `---
name: ${yamlDoubleQuote(instance.meta.name)}
schema-version: "${instance.meta["schema-version"]}"
instance-version: "${instance.meta["instance-version"]}"
mode: ${instance.meta.mode}
source: ${instance.meta.source}
extracted: "${instance.meta.extracted}"
status: ${instance.meta.status}
---`;

  const title = `# ${instance.meta.name}`;

  const overview = `## 1. Overview

"${option.label}" 컨셉의 디자인 방향을 요약한다. 무드: ${db.moodKeywords.join(", ")}. 톤: ${option.keyVisual.imageTone}. 정보구조: ${option.uiStructure.mode === "dark" ? "다크" : "라이트"} 모드, ${option.uiStructure.navPosition === "left" ? "좌측 LNB" : "상단 GNB"} — ${option.uiStructure.infoStructure}.

이 문서는 \`source: concept\` 인스턴스다 — 실측 화면 이전 단계의 컨셉 제안이라 상세도가 실측 인스턴스보다 낮다(스키마 §1 완화 규칙). 필수 컴포넌트·상태 변형 순회 의무가 면제되며, 채워진 토큰 대부분은 \`proposed\`/\`derived\`/\`fallback\`이다 — 전량 \`known-gaps\`에 기록했다.`;

  const colorsSection = `## 2. Colors

브랜드 인터랙션은 \`{colors.primary}\` 하나로 묶고, 배경은 \`{colors.canvas}\`(카드 표면은 \`{colors.surface}\`)를 쌍으로 쓴다. 텍스트는 \`{colors.text}\`(보조는 \`{colors.text-muted}\`)이며 \`{colors.primary}\` 위에는 항상 \`{colors.on-primary}\`를 쌍으로 사용한다. 포인트 컬러는 \`{colors.accent}\`, GNB/LNB 배경은 \`{colors.surface-alt}\`. 이 팔레트는 컨셉 단계 제안값(\`proposed\`)이며, \`{colors.on-primary}\`는 primary와의 대비를 검증(AA 4.5:1)한 뒤 파생(\`derived\`)했고 \`{colors.border}\`도 팔레트에 없던 슬롯이라 파생했다 — 실제 화면 적용 전 검수가 필요하다. \`error\`/\`success\`/\`warning\`/\`link\` 등 권장 토큰은 컨셉 팔레트에 없어 지어내지 않았다(Known Gaps 참조).`;

  const typographySection = `## 3. Typography

컨셉 방향: ${db.typographyDirection}. 필수 슬롯 7종(\`display\`~\`button\`)을 정의했으나, 실제 폰트·크기·행간이 아직 확정되지 않아 계약 기본값(\`fallback\`, Pretendard 스택 + 표준 스케일)으로 채웠다. 모든 슬롯(\`caption\` 포함)이 min-body-size 제약(최소 14px)을 만족하도록 스케일을 잡았다. 실제 폰트가 결정되면 \`family\`와 각 슬롯 값을 갱신하고 \`instance-version\`을 올린다.`;

  const layoutSection = `## 4. Layout

\`{spacing.base-unit}\`(8px) 그리드를 기본값으로 사용한다. 컨셉 단계라 실제 화면의 spacing 실측이 없어 표준 스케일(\`fallback\`)을 임시로 채웠다 — 실제 레이아웃 확정 시 재검증이 필요하다(Known Gaps 참조).`;

  const shapeSection = `## 5. Shape & Elevation

라운드는 표준 5단계(\`{rounded.none}\`~\`{rounded.full}\`) 기본값을 사용한다. 그림자는 \`{shadow.none}\`만 확정했고, 실제 elevation 레벨(subtle/standard/elevated/modal)은 실재 여부를 확인할 방법이 없어 비워뒀다 — 지어내지 않았다.`;

  const componentsSection = `## 6. Components

필수 컴포넌트 4종 중 \`button-primary\`·\`card-default\`는 컨셉 수준(배경·문자·타이포·라운드만)으로 제안했다 — 상태 변형(hover/active/disabled)은 미정이다. \`button-secondary\`·\`input-default\`는 컨셉 단계에서 다뤄지지 않아 아직 정의하지 않았다. \`source: concept\` 인스턴스는 이 미충족을 허용하며(§1 완화 규칙), 대신 사유를 Known Gaps에 남긴다.`;

  const { dos, donts } = buildRulesProse(instance.rules.constraints);
  const rulesSection = `## 7. Rules

(후미 JSON \`rules.constraints\`에서 파생 렌더링 — 값의 원천은 JSON. Do/Don't 분류도 constraints.rule 문자열에서 기계적으로 파생하며 별도로 작성하지 않는다)

**Do:**
${dos.join("\n")}

**Don't:**
${donts.join("\n")}`;

  const knownGapsSection = `## 8. Known Gaps

없음이 아니다 — 이 인스턴스는 \`source: concept\`(실측 이전 단계)라 대부분의 토큰이 \`proposed\`/\`derived\`/\`fallback\`이며, 총 ${instance["known-gaps"].length}건이 Known Gaps로 남아 있다(상세는 후미 JSON \`known-gaps\` 참조). 카테고리별: ${groupGapsByCategory(instance["known-gaps"])}.`;

  const body = [
    overview,
    colorsSection,
    typographySection,
    layoutSection,
    shapeSection,
    componentsSection,
    rulesSection,
    knownGapsSection,
  ].join("\n\n");

  const jsonBlock = "```json\n" + JSON.stringify(instance, null, 2) + "\n```";

  return `${frontmatter}\n\n${title}\n\n${body}\n\n---\n\n${jsonBlock}\n`;
}
