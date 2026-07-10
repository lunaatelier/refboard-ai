import { NextResponse } from "next/server";
import { generateJson } from "@/lib/ai/client";
import { buildSourceMaterial } from "@/lib/ai/exclusion";
import { buildDirectiveBlock } from "@/lib/ai/prompts";
import { deriveForcedMode } from "@/lib/analysis/requirements";
import { normalizeConcept } from "@/lib/concept/normalize";
import type { ProjectAnalysis } from "@/lib/analysis/types";

// 컨셉 3안 생성 (Step 12-a) — Concept JSON(SSoT).
// 입력은 전부 마스킹된 분석/레퍼런스 결정뿐. 제외 페이지는 buildSourceMaterial이 차단.

export const runtime = "nodejs";

const DIFFERENTIATION: Record<string, string> = {
  "dashboard-ops":
    "3안 차별화 축: 다크/라이트 모드, GNB 위치(상단 top vs 좌측 left), 정보밀도(집약 vs 여백)",
  "mobile-app":
    "3안 차별화 축: 다크/라이트, 내비게이션 방식, 정보밀도(집약 vs 여백)",
  document:
    "3안 차별화 축: 표지 톤(다크/라이트), 이미지 타입(일러스트/사진/3D), 그리드 구조",
  "marketing-web":
    "3안 차별화 축: 무드(신뢰/혁신/미니멀), 레이아웃 대담함, 이미지 타입",
  generic: "3안 차별화 축: 무드, 레이아웃, 이미지 타입",
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const analysis: ProjectAnalysis | undefined = body?.analysis;
  if (!analysis || !Array.isArray(analysis.pages)) {
    return NextResponse.json({ error: "analysis가 필요합니다." }, { status: 400 });
  }
  const directives = Array.isArray(body?.directives) ? body.directives : [];
  const representative = body?.representative ?? {};
  const palette = body?.palette; // 확정 팔레트 (현재 모드)
  const moodSummary = typeof body?.moodSummary === "string" ? body.moodSummary : "";
  const layoutBySection: Record<string, string> =
    body?.layoutBySection && typeof body.layoutBySection === "object"
      ? body.layoutBySection
      : {};
  const targetImplications: string[] = Array.isArray(body?.targetImplications)
    ? body.targetImplications
    : [];
  const useVariants = body?.useVariants === true;
  const variants = analysis.existingContentVariants ?? [];

  const layoutLines = Object.entries(layoutBySection)
    .map(([id, layout]) => `- ${id}: ${layout} (사용자 확정)`)
    .join("\n");

  const variantBlock =
    useVariants && variants.length >= 2
      ? `\n## 기존 시안 변형 기반 생성 (중요 — 실사용#24)
이 문서에는 이미 시안 변형 ${variants.length}개가 있다. 3안을 처음부터 만들지 말고, 아래 변형을 각 안에 1:1로 매핑하라 (basedOnVariantLabel에 라벨 기록). 그 위에 UI 톤(색감·레이아웃)만 옵션별로 다르게 얹어라.
${variants.map((v) => `- ${v.label}: ${v.contentSummary}`).join("\n")}\n`
      : "";

  const forcedMode = deriveForcedMode(analysis.explicitRequirements);
  const forcedModeBlock = forcedMode
    ? `\n## 문서 명시 제약 (반드시 지킬 것 — 3안 전부 동일 적용, 변주 대상 아님)\n- 문서가 배경/모드를 명시적으로 요구했다. uiStructure.mode는 3안 모두 "${forcedMode}"로 고정하라. mode 축으로는 3안을 차별화하지 마라 (다른 축으로 차별화할 것).\n`
    : "";

  const prompt = `당신은 시니어 프로덕트 디자이너다. 아래 자료로 프로젝트 전체를 관통하는 디자인 컨셉 3안을 만들어라.
([회사A] 같은 대괄호 토큰은 마스킹된 실명이다 — 그대로 유지하고 복원하지 마라.)
${buildDirectiveBlock(directives, "concept")}${forcedModeBlock}
## 프로젝트
${analysis.title} — ${analysis.description}
화면 유형: ${analysis.domain}${analysis.businessDomains && analysis.businessDomains.length > 0 ? ` / 프로젝트 도메인: ${analysis.businessDomains.join(", ")}` : ""} / 산출물 형식: ${analysis.projectType} / 타겟: ${analysis.targetUser}
${DIFFERENTIATION[analysis.domain] ?? DIFFERENTIATION.generic}

## 확정된 디자인 결정 (반드시 반영)
- 팔레트: ${palette ? JSON.stringify(palette) : "미확정"}
- 무드: ${moodSummary || "미확정"}
${layoutLines ? `- 섹션별 표현 방식:\n${layoutLines}` : ""}
${targetImplications.length > 0 ? `- 벤치마킹 시사점:\n${targetImplications.map((t) => `  - ${t}`).join("\n")}` : ""}
${variantBlock}
## 소스 자료 (선택된 페이지·확정 섹션만)
${buildSourceMaterial(analysis)}

## 출력 규칙
- 각 안 = 3축 컨셉 키워드 + UiStructure(전체 UI 방향) + KeyVisual(전체 비주얼 방향) + 페이지별 콘텐츠 매핑.
- 3축(conceptKeywords)은 "사용성/일관성/효율성" 같은 전략 축 3개. no("01"~"03"), title("사용성 (Usability)"), category("UX Strategy | 사용자 경험 중심"), description(2~3문장).
- pages: 소스 자료의 페이지·섹션 구조를 그대로 쓰되(pageId/sectionId 동일하게 유지 — 절대 새 ID 만들지 마라), 각 섹션에 layoutPattern(사용자 확정값 우선)과 contentMapping을 채워라.
- contentMapping.maskedContent: 그 화면 영역에 들어갈 실제 카피/본문 요약 (마스킹 토큰 유지). targetArea: hero-title/feature-card/timeline/table/stat-band 등.
- 3안은 위 차별화 축에서 서로 뚜렷이 달라야 한다. label은 "A안 — 신뢰의 블루" 형식.
- platforms (웹+모바일 동시 요구 시에만): 소스 자료가 웹과 모바일 산출물을 모두 명시적으로 요구하는 경우(예: "반응형 웹 + 모바일 앱", "PC/모바일 각각"), 각 안에 platforms.web과 platforms.mobile 페이지 세트를 별도로 채워라. 두 세트 모두 pages와 같은 구조이며 pageId/sectionId는 소스 자료 그대로 유지하되, layoutPattern·contentMapping은 플랫폼 특성(모바일 = 단일 컬럼, 하단 탭, 축약 카피)에 맞게 다르게 설계하라. 이때 pages에는 웹 세트를 그대로 복사해 넣어라. 웹 단일 요구라면 platforms를 넣지 마라.

반드시 JSON만 출력:
{ "options": [{ "optionId": string, "label": string, "basedOnVariantLabel": string|null,
  "conceptKeywords": [{ "no": string, "title": string, "category": string, "description": string }],
  "uiStructure": { "mode": "dark"|"light", "navPosition": "top"|"left", "infoStructure": string, "layoutConcept": string },
  "keyVisual": { "imageTone": string, "illustrationStyle": string, "backgroundPattern": string, "decorativeElements": string },
  "pages": [{ "pageId": string, "pageTitle": string, "sections": [{ "sectionId": string, "sectionTitle": string, "contentType": string, "layoutPattern": string, "contentMapping": { "maskedContent": string, "sourceSectionId": string, "targetArea": string } }] }],
  "platforms": { "web": [/* pages와 동일 구조 */], "mobile": [/* pages와 동일 구조 */] } | null }] }`;

  try {
    const raw = await generateJson(prompt);
    const concept = normalizeConcept(raw, analysis, representative);
    if (concept.options.length === 0) {
      throw new Error("컨셉 생성 결과가 비어 있습니다.");
    }
    return NextResponse.json({ concept });
  } catch (e) {
    const message = e instanceof Error ? e.message : "컨셉 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
