import type { DomainHint, Page, ProjectAnalysis } from "../analysis/types";
import { sectionKey } from "./sectionPriority";
import type { MoodOption, ReferenceResult, RepresentativePages } from "./types";

// 이미지 힌트 판정 (Step 11) — isomorphic 순수 함수. 프롬프트 문구만 Gemini가 채운다.

// 타입 판정 기준: 도메인 + 선택한 무드 (flow-spec ④ 이미지 힌트)
export function decideDirection(
  domain: DomainHint,
  tags: string[],
  mood?: MoodOption,
): string {
  const moodText = mood ? `${mood.label} ${mood.keywords.join(" ")}` : "";
  if (/혁신|미래|첨단|테크/.test(moodText)) return "3D 렌더";
  if (/미니멀|절제|여백/.test(moodText)) return "라인 일러스트";
  if (/따뜻|친근|유쾌|키즈|이벤트/.test(moodText)) return "일러스트 2D";
  const tagText = tags.join(" ");
  if (/키즈|이벤트|축제/.test(tagText)) return "일러스트 2D";
  if (/금융|B2B|엔터프라이즈|공공/.test(tagText)) return "미니멀 3D";
  if (domain === "dashboard-ops") return "미니멀 3D";
  return "사진형";
}

export interface HintSkeleton {
  key: string; // sectionKey(pageId, sectionId) — 섹션과 안정적으로 연결(P7)
  pageId: string;
  sectionId: string;
  area: string;
  scale: "hero" | "section" | "icon";
  direction: string;
  aspectRatio: string;
  contextSummary: string; // Gemini 프롬프트 생성용 (마스킹된 요약)
}

// hero 콘텐츠타입 섹션 = 표지급 키비주얼. 별도 무조건 항목을 두지 않고, 이
// 목록에 포함되면 "새 이미지 필요" 기본 체크값(true)에 반영된다(P7 — 확정된
// 섹션+필요 선택 없이는 표지 이미지도 생성되지 않는다).
const SECTION_IMAGE_TYPES = ["hero", "case-study", "history", "vision", "cta"];
const ICON_IMAGE_TYPES = ["feature", "team", "pricing"];

// "새 이미지 필요" 체크박스의 기본값(휴리스틱) — 저장된 사용자 결정이 없을 때만 쓴다.
// 사용자가 명시적으로 끈 결정(references.imageNeedByKey[key] === false)은 여기로
// 절대 되돌아가지 않는다(호출부에서 `?? defaultImageNeed(...)`로만 결합).
export function defaultImageNeed(contentType: string): boolean {
  return SECTION_IMAGE_TYPES.includes(contentType) || ICON_IMAGE_TYPES.includes(contentType);
}

export function scaleFor(contentType: string): {
  scale: HintSkeleton["scale"];
  aspectRatio: string;
} {
  if (contentType === "hero") return { scale: "hero", aspectRatio: "16:9" };
  if (ICON_IMAGE_TYPES.includes(contentType)) return { scale: "icon", aspectRatio: "1:1" };
  return { scale: "section", aspectRatio: "4:3" };
}

// 확정 섹션 중 "새 이미지 필요"로 결정된 것만 스켈레톤을 만든다(P7) — contentType
// 휴리스틱은 기본 체크값에만 쓰이고, 실제 포함 여부는 항상 이 결정을 거친다.
// 표지 키비주얼도 예외 없이 이 조건을 통과해야 한다(무조건 포함하던 이전 동작 제거).
export function buildHintSkeletons(
  analysis: ProjectAnalysis,
  references: Pick<ReferenceResult, "imageNeedByKey">,
  mood?: MoodOption,
): HintSkeleton[] {
  const direction = decideDirection(analysis.domain, analysis.tags, mood);
  const skeletons: HintSkeleton[] = [];

  outer: for (const page of analysis.pages.filter((p) => p.selected)) {
    for (const s of page.sections) {
      if (s.status !== "confirmed") continue;
      const key = sectionKey(page.pageId, s.sectionId);
      const required = references.imageNeedByKey?.[key] ?? defaultImageNeed(s.contentType);
      if (!required) continue;
      if (skeletons.length >= 8) break outer; // 볼륨 제한

      const { scale, aspectRatio } = scaleFor(s.contentType);
      skeletons.push({
        key,
        pageId: page.pageId,
        sectionId: s.sectionId,
        area:
          scale === "icon"
            ? `${page.pageTitle} — ${s.sectionTitle} (아이콘 세트)`
            : `${page.pageTitle} — ${s.sectionTitle}`,
        scale,
        direction: scale === "icon" && direction === "사진형" ? "라인 일러스트" : direction,
        aspectRatio,
        contextSummary: s.contentSummary,
      });
    }
  }
  return skeletons;
}

// 이미지 힌트 생성 게이팅(P7) — UI의 버튼 비활성화와 테스트가 같은 기준을
// 공유하도록 순수 함수로 분리한다. 최소 조건: 방향 확정 + 그 방향의 무드 존재 +
// 팔레트 확정 + "새 이미지 필요"인 확정 섹션 최소 1개.
export function canGenerateImageHints(
  analysis: ProjectAnalysis,
  references: Pick<
    ReferenceResult,
    "directionOptions" | "selectedDirectionId" | "moodOptions" | "editedPaletteOption" | "imageNeedByKey"
  >,
): { ok: boolean; reason?: string } {
  const direction = references.directionOptions?.find(
    (d) => d.directionId === references.selectedDirectionId,
  );
  if (!direction) return { ok: false, reason: "글로벌 방향을 먼저 확정하세요." };
  const mood = references.moodOptions?.find((m) => m.id === direction.moodOptionId);
  if (!mood) return { ok: false, reason: "선택한 방향의 무드를 찾을 수 없습니다." };
  if (!references.editedPaletteOption) {
    return { ok: false, reason: "팔레트를 먼저 확정하세요." };
  }
  const anyRequired = analysis.pages
    .filter((p) => p.selected)
    .some((p) =>
      p.sections.some(
        (s) =>
          s.status === "confirmed" &&
          (references.imageNeedByKey?.[sectionKey(p.pageId, s.sectionId)] ??
            defaultImageNeed(s.contentType)),
      ),
    );
  if (!anyRequired) {
    return { ok: false, reason: "새 이미지가 필요한 섹션이 없습니다." };
  }
  return { ok: true };
}

// 대표 페이지 추천 (Step 11) — "표지 ≠ 대표". cover는 내용 대표로 쓰지 않는다(내용 빈약).
// 도메인별 기본: 문서형=metrics/content, 대시보드=메인 대시보드, 마케팅웹=랜딩 히어로.
export function recommendRepresentativePages(
  analysis: ProjectAnalysis,
): RepresentativePages {
  const selected = analysis.pages.filter((p) => p.selected);
  const byRole = (role: Page["pageRole"]) =>
    selected.find((p) => p.pageRole === role);

  const visual = byRole("cover") ?? selected[0];

  const nonCover = selected.filter((p) => p.pageRole !== "cover");
  let content: Page | undefined;
  if (analysis.domain === "document") {
    content = byRole("metrics") ?? byRole("content");
  } else {
    content = byRole("content") ?? byRole("metrics");
  }
  // 폴백: 섹션이 가장 많은 비표지 페이지 (정보구조가 가장 잘 드러남)
  if (!content) {
    content = [...nonCover].sort(
      (a, b) => b.sections.length - a.sections.length,
    )[0];
  }

  return {
    visualPageId: visual?.pageId,
    contentPageId: content?.pageId,
  };
}

// 대표 페이지 추천 이유 한 줄(P7 item 4) — RepresentativePages에 저장하지 않고
// 매번 계산한다. 현재 선택값이 휴리스틱 추천과 같으면 추천 근거를, 사용자가
// 다른 페이지로 바꿨으면 "직접 지정"을 보여준다(저장했다면 사용자가 다시 바꿔도
// 낡은 문구가 남는 문제가 생긴다 — 그래서 파생값으로만 유지).
export function representativePageReason(
  analysis: ProjectAnalysis,
  rep: RepresentativePages,
): { visualReason: string; contentReason: string } {
  const recommended = recommendRepresentativePages(analysis);
  const visualReason =
    rep.visualPageId && rep.visualPageId === recommended.visualPageId
      ? "표지 역할 페이지라 첫인상 대표로 추천"
      : "사용자가 직접 지정";
  const contentReason =
    rep.contentPageId && rep.contentPageId === recommended.contentPageId
      ? analysis.domain === "document"
        ? "성과·본문 데이터가 정보구조를 가장 잘 보여줌"
        : "본문 콘텐츠 구조가 가장 잘 드러남"
      : "사용자가 직접 지정";
  return { visualReason, contentReason };
}

// 이미지 실제 생성용 크기 매핑 (Step 19) — "16:9" 같은 비율 문자열을
// NVIDIA NIM flux 계열이 허용하는 크기(768~1344, 64배수)로 변환.
// 실측: 그 밖의 값은 HTTP 422 (Input should be 768, 832, ..., 1344).
export function aspectRatioToSize(aspectRatio?: string): {
  width: number;
  height: number;
} {
  const m = aspectRatio?.match(/^(\d+)\s*:\s*(\d+)$/);
  if (!m) return { width: 1024, height: 1024 };
  const [w, h] = [Number(m[1]), Number(m[2])];
  if (w <= 0 || h <= 0 || w === h) return { width: 1024, height: 1024 };
  const clamp64 = (n: number) =>
    Math.min(1344, Math.max(768, Math.round(n / 64) * 64));
  // 긴 변을 1344로 놓고 짧은 변을 비율대로 — 허용 범위로 클램프
  if (w > h) return { width: 1344, height: clamp64((1344 * h) / w) };
  return { width: clamp64((1344 * w) / h), height: 1344 };
}
