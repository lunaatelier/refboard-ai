// 분석 타입 (Phase 2) — data-model.md §4가 단일 기준.
// projectDirective(Step 8)·referenceQueries/imageHints(Phase 3)는 해당 스텝에서 추가.

export type DomainHint =
  | "marketing-web"
  | "dashboard-ops"
  | "mobile-app"
  | "document"
  | "generic";

export type PageRole =
  | "cover"
  | "section-divider"
  | "content"
  | "case-study"
  | "metrics"
  | "team"
  | "appendix"
  | "contact";

// 제외 사유 — 기록이 아니라 "후속 프롬프트 차단 조건"으로 사용 (Step 7)
export type ExclusionReason =
  | "sensitive"
  | "out-of-scope"
  | "low-priority"
  | "duplicate"
  | "quality-issue"
  | "user-choice"
  | "other";

// 내용의 성격 / 표현 방식 — 열린 enum (예외 섹션 수용)
export type ContentType = string;
export type LayoutPattern = string;

export interface Section {
  sectionId: string;
  sectionTitle: string;
  contentSummary: string; // 마스킹된 본문 요약 (토큰 유지)
  contentType: ContentType;
  recommendedLayout: LayoutPattern;
  sourceSlides?: number[]; // PPT 계보: 어느 슬라이드에서 왔나
  sourceDocumentId?: string; // 문서 자체 화면ID/요구사항ID (실사용#4/#8)
  confidence?: number;
  status: "candidate" | "confirmed"; // 사용자 확정 게이트
  unresolvedNotes?: string[]; // 리뷰 코멘트 = 미결 이슈 보존 (실사용#9)
}

export interface Page {
  pageId: string;
  pageTitle: string;
  pageRole: PageRole;
  sourceSlides?: number[];
  sourceDocumentId?: string;
  selected: boolean; // 최대 5개 선택
  excludedReason?: ExclusionReason;
  excludedNote?: string;
  sections: Section[];
}

// 문서에 이미 있는 콘텐츠 변형 (실사용#24) — Step 12에서 컨셉 3안에 1:1 매핑
export interface ExistingContentVariant {
  variantId: string;
  label: string; // "Main1"
  sourceSlides?: number[];
  contentSummary: string;
}

// 문서 내 기존 사례분석 (실사용#2) — ④ 분석 대상 브랜드에 선반영 제안
export interface DetectedCaseStudy {
  name: string;
  sourceSlides?: number[];
  extractedNote: string;
  sourceUrls?: string[];
}

export interface ProjectAnalysis {
  title: string;
  description: string;
  domain: DomainHint;
  domainConfidence: number; // 낮으면 사용자 선택 우선
  targetUser: string;
  tags: string[];
  projectType: string;
  brandColors?: string[];
  pages: Page[];
  existingContentVariants?: ExistingContentVariant[];
  detectedCaseStudies?: DetectedCaseStudy[];
}
