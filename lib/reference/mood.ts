import { buildDirectiveBlock } from "../ai/prompts";
import type { ProjectDirective } from "../analysis/types";
import type { MoodOption, PaletteOption, TypographyDirection } from "./types";

// 무드 생성 (P3) — 팔레트 후보를 입력으로 받아, 각 무드가 서로 다른 팔레트
// 후보와 1:1로 짝지어지도록 한다. 프롬프트 조립·응답 파싱·정규화를 모두
// 순수 함수로 분리해 API 호출 없이 테스트한다.

export interface MoodPromptInput {
  title: string;
  description: string;
  domain: string;
  tags: string[];
  projectType?: string;
  directives?: ProjectDirective[];
  paletteOptions: PaletteOption[];
}

export function buildMoodPrompt(input: MoodPromptInput): string {
  const paletteBlock = input.paletteOptions
    .map((p) => {
      const r = p.light;
      return `- id:"${p.optionId}" (${p.label}) primary:${r.primary} secondary:${r.secondary} accent:${r.accent} background:${r.background} surface:${r.surface} text:${r.text} navigation:${r.navigation}`;
    })
    .join("\n");

  return `당신은 시니어 브랜드/프로덕트 디자이너다. 아래 프로젝트에 어울리는 서로 다른 무드 방향 3가지를 제안하라.
([회사A] 같은 대괄호 토큰은 마스킹된 실명이다. 그대로 두라.)
${buildDirectiveBlock(input.directives ?? [], "mood")}
프로젝트: ${input.title}
설명: ${input.description}
도메인: ${input.domain} / 종류: ${input.projectType ?? "-"}
태그: ${input.tags.length > 0 ? input.tags.join(", ") : "-"}

이미 확정된 팔레트 후보 목록(아래 id 중 하나를 각 무드에 정확히 하나씩 배정하라 — 3개 무드가 서로 다른 id를 쓰도록):
${paletteBlock}

각 무드는 뚜렷하게 달라야 한다 (예: 신뢰/혁신/미니멀 축). 반드시 JSON 배열만 출력:
[{
  "id": string(kebab-case),
  "label": string(한국어 짧은 이름),
  "keywords": string[4~6](한국어 형용사),
  "description": string(1~2문장),
  "imageQuery": string(영어 2~4단어, 무드보드 사진 검색용),
  "paletteOptionId": string(위 팔레트 후보 id 중 하나),
  "typography": {
    "title": { "sampleText": string(한국어 제목 예시 문구), "note": string(제목 타이포 방향 한 줄) },
    "body": { "sampleText": string(한국어 본문 예시 문구), "note": string(본문 타이포 방향 한 줄) }
  },
  "styleAttributes": {
    "radius": "sharp"|"soft",
    "density": "compact"|"airy",
    "contrast": "high"|"soft",
    "typographyNote": string(타이포 방향 한 줄 — title.note와 같은 내용이어도 됨)
  },
  "recommendedDirections": string[0~3](이 무드와 어울리는 요소 — 예: "넓은 여백", "사진 위주 히어로"),
  "avoidDirections": string[0~3](이 무드와 어울리지 않는 요소 — 예: "화려한 그라디언트", "장식적 아이콘")
}] (정확히 3개)`;
}

function fallbackTypography(typographyNote: string): TypographyDirection {
  return {
    title: { sampleText: "", note: typographyNote },
    body: { sampleText: "", note: typographyNote },
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseMoodResponse(
  raw: unknown,
  paletteOptions: PaletteOption[],
): MoodOption[] {
  const fallbackPaletteId = paletteOptions[0]?.optionId ?? "";
  const validIds = new Set(paletteOptions.map((p) => p.optionId));

  const moods = (Array.isArray(raw) ? raw : [])
    .slice(0, 3)
    .map((m: any, i: number): MoodOption => {
      const typographyNote =
        typeof m?.styleAttributes?.typographyNote === "string"
          ? m.styleAttributes.typographyNote
          : "";
      const typography: TypographyDirection =
        m?.typography &&
        typeof m.typography?.title?.sampleText === "string" &&
        typeof m.typography?.body?.sampleText === "string"
          ? {
              title: {
                sampleText: m.typography.title.sampleText,
                note:
                  typeof m.typography.title.note === "string"
                    ? m.typography.title.note
                    : typographyNote,
              },
              body: {
                sampleText: m.typography.body.sampleText,
                note:
                  typeof m.typography.body.note === "string"
                    ? m.typography.body.note
                    : typographyNote,
              },
            }
          : fallbackTypography(typographyNote);

      return {
        id: typeof m?.id === "string" ? m.id : `mood-${i + 1}`,
        label: typeof m?.label === "string" ? m.label : `무드 ${i + 1}`,
        keywords: Array.isArray(m?.keywords)
          ? m.keywords.filter((k: unknown) => typeof k === "string")
          : [],
        description: typeof m?.description === "string" ? m.description : "",
        imageQuery:
          typeof m?.imageQuery === "string" ? m.imageQuery : "abstract design",
        paletteOptionId:
          typeof m?.paletteOptionId === "string" &&
          validIds.has(m.paletteOptionId)
            ? m.paletteOptionId
            : fallbackPaletteId,
        typography,
        styleAttributes: {
          radius: m?.styleAttributes?.radius === "sharp" ? "sharp" : "soft",
          density:
            m?.styleAttributes?.density === "compact" ? "compact" : "airy",
          contrast:
            m?.styleAttributes?.contrast === "high" ? "high" : "soft",
          typographyNote,
        },
        recommendedDirections: Array.isArray(m?.recommendedDirections)
          ? m.recommendedDirections.filter((k: unknown) => typeof k === "string").slice(0, 3)
          : [],
        avoidDirections: Array.isArray(m?.avoidDirections)
          ? m.avoidDirections.filter((k: unknown) => typeof k === "string").slice(0, 3)
          : [],
      };
    });

  return normalizeMoodPaletteAssignment(moods, paletteOptions);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// 3개 무드가 가능한 한 서로 다른 팔레트 후보를 쓰도록 정규화한다.
// 후보 수가 무드 수보다 적으면(비정상 입력) 중복을 허용한다 — 순서상 먼저
// 온 무드가 우선권을 갖고, 이후 무드는 아직 안 쓰인 후보로 재배정된다.
export function normalizeMoodPaletteAssignment(
  moods: MoodOption[],
  paletteOptions: PaletteOption[],
): MoodOption[] {
  const used = new Set<string>();
  const allIds = paletteOptions.map((p) => p.optionId);
  return moods.map((mood) => {
    if (mood.paletteOptionId && !used.has(mood.paletteOptionId)) {
      used.add(mood.paletteOptionId);
      return mood;
    }
    const free = allIds.find((id) => !used.has(id));
    if (free == null) return mood; // 후보 소진 — 중복 허용
    used.add(free);
    return { ...mood, paletteOptionId: free };
  });
}
