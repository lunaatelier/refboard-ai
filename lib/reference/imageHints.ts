import type { DomainHint, Page, ProjectAnalysis } from "../analysis/types";
import type { MoodOption, RepresentativePages } from "./types";

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
  area: string;
  scale: "hero" | "section" | "icon";
  direction: string;
  aspectRatio: string;
  contextSummary: string; // Gemini 프롬프트 생성용 (마스킹된 요약)
}

const SECTION_IMAGE_TYPES = ["hero", "case-study", "history", "vision", "cta"];
const ICON_IMAGE_TYPES = ["feature", "team", "pricing"];

// 표지 = hero 1개 + 선택 페이지의 이미지성 섹션 = section + 카드형 섹션 = icon
export function buildHintSkeletons(
  analysis: ProjectAnalysis,
  mood?: MoodOption,
): HintSkeleton[] {
  const direction = decideDirection(analysis.domain, analysis.tags, mood);
  const skeletons: HintSkeleton[] = [
    {
      area: "표지 키비주얼",
      scale: "hero",
      direction,
      aspectRatio: "16:9",
      contextSummary: `${analysis.title} — ${analysis.description}`,
    },
  ];

  for (const page of analysis.pages.filter((p) => p.selected)) {
    for (const s of page.sections) {
      if (skeletons.length >= 8) break; // 볼륨 제한
      if (SECTION_IMAGE_TYPES.includes(s.contentType)) {
        skeletons.push({
          area: `${page.pageTitle} — ${s.sectionTitle}`,
          scale: "section",
          direction,
          aspectRatio: "4:3",
          contextSummary: s.contentSummary,
        });
      } else if (ICON_IMAGE_TYPES.includes(s.contentType)) {
        skeletons.push({
          area: `${page.pageTitle} — ${s.sectionTitle} (아이콘 세트)`,
          scale: "icon",
          direction: direction === "사진형" ? "라인 일러스트" : direction,
          aspectRatio: "1:1",
          contextSummary: s.contentSummary,
        });
      }
    }
  }
  return skeletons;
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
