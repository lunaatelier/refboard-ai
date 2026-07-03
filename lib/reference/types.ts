// 레퍼런스 타입 (Phase 3) — data-model.md §5가 단일 기준.
// Step 10-a: 팔레트·무드 / 10-b: 섹션별 레퍼런스 / 10-c: 분석 대상 브랜드 순으로 채운다.

// 팔레트 = 색(1층) + 역할 매핑(2층). 색은 유지한 채 역할 배치만 재배치 가능
// → "색은 좋은데 배치 틀림" 해결 (flow-spec ④).
export interface Palette {
  mode: "light" | "dark";
  primary: string; // 강조·주요 액션
  secondary: string;
  accent: string; // 포인트·CTA
  background: string;
  surface: string; // 카드·패널 배경
  text: string;
  navigation: string; // LNB/GNB 배경 (별도 역할)
}

export type PaletteRole = Exclude<keyof Palette, "mode">;

// 컬러 후보 3세트 — 브랜드컬러 있으면 그 변주, 없으면 신뢰형/혁신형/미니멀형
export interface PaletteOption {
  optionId: string;
  label: string;
  light: Palette;
  dark: Palette;
}

export interface MoodImage {
  url: string;
  source: "unsplash" | "pexels";
  attribution: string;
}

// 무드 후보 (Gemini 생성, 3종 제시 → 선택)
export interface MoodOption {
  id: string;
  label: string; // "신뢰의 블루"
  keywords: string[]; // "신뢰감 있는", "혁신적인" ...
  description: string;
  imageQuery: string; // Unsplash/Pexels 검색어 (영어)
  styleAttributes: {
    radius: "sharp" | "soft";
    density: "compact" | "airy";
    contrast: "high" | "soft";
    typographyNote: string;
  };
}

export interface MoodBoard {
  keywords: string[];
  description: string;
  images: MoodImage[];
}

export interface ReferenceQuery {
  platform: string; // Dribbble, Behance, Mobbin ...
  query: string; // 플랫폼 강점에 매핑된 검색어
  mode: "auto-search" | "copy-keyword";
  url?: string; // auto-search일 때 검색 이동 URL
}

// 섹션별 결정 (Step 10-b)
export interface SectionReference {
  sectionId: string;
  layoutPattern: string; // 사용자 선택 확정
  searchQuery: string; // 이 섹션의 대표 검색어 (Gemini 생성, 편집 가능)
  platformQueries: ReferenceQuery[];
}

// Phase 3 결과 — 프로젝트 전체 결정(팔레트/무드)은 위, 섹션별은 bySectionId(10-b).
// 진행 중 단계별로 채워지므로 필드는 optional로 열어둔다.
export interface ReferenceResult {
  paletteOptions?: PaletteOption[];
  // 선택한 옵션의 편집본 (역할 재배치 반영). selectedPalette = editedOption[mode].
  editedPaletteOption?: PaletteOption;
  paletteMode?: "light" | "dark";
  moodOptions?: MoodOption[];
  selectedMoodId?: string;
  globalMood?: MoodBoard; // 선택 무드 + 이미지
  paletteConfirmed?: boolean;
  bySectionId?: Record<string, SectionReference>; // 섹션별 (Step 10-b)
}
