import { NextResponse } from "next/server";
import { generateJson } from "@/lib/ai/client";
import { buildSourceMaterial } from "@/lib/ai/exclusion";
import { buildDirectiveBlock } from "@/lib/ai/prompts";
import { deriveForcedMode } from "@/lib/analysis/requirements";
import { normalizeConcept } from "@/lib/concept/normalize";
import { assertConceptJsonInvariant } from "@/lib/concept/versionGuard";
import { assertBriefMatchesAnalysis, ConfirmBriefError } from "@/lib/reference/confirmBrief";
import type { ProjectAnalysis } from "@/lib/analysis/types";
import type { ConfirmedReferenceBrief } from "@/lib/reference/types";

// 컨셉 3안 생성 (Step 12-a, P9-A) — Concept JSON(SSoT).
// 입력은 확정 브리프(ConfirmedReferenceBrief)와 분석 결과뿐. 제외 페이지는
// buildSourceMaterial이 차단하고, 브리프의 pageId/sectionId는 분석 결과와
// 교차 검증한다(§P9-A). 클라이언트→서버는 같은 신뢰 경계이므로 analysis는
// 전체 ProjectAnalysis를 받는다 — "외부 전송 금지"(§3.6)는 이 프롬프트가
// Gemini로 나갈 때 buildSourceMaterial이 걸러내는 지점에 적용된다.

export const runtime = "nodejs";

// 3안의 차별화 축은 도메인이 아니라 항상 이 세 가지로 고정한다(P9-A 확정 —
// 이전에는 도메인별로 다크/라이트·GNB 위치 등을 축으로 썼으나, 팔레트·무드는
// 이미 확정 브리프로 고정돼 있으므로 남은 변주는 구조·비주얼·균형 축뿐이다).
const STRUCTURE_AXIS_BLOCK = `## 3안 차별화 축 (고정)
- \`구조·신뢰형\`: 정보 위계, 설명 가능성, 안정적인 구조를 우선한다.
- \`비주얼·몰입형\`: 대표 이미지, 공간감, 인터랙션 인상을 우선한다.
- \`균형형\`: 정보 전달과 시각적 몰입을 균형 있게 적용한다.
세 안 모두 확정된 팔레트·무드·타이포·금지 방향은 동일하게 유지한다. 차이는
정보 밀도, 레이아웃 대담함, 이미지 사용 방식, 인터랙션 강조도에서만 만든다.
label은 "A안 — 구조·신뢰형"처럼 축 이름을 포함해 작성한다.`;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const analysis: ProjectAnalysis | undefined = body?.analysis;
  if (!analysis || !Array.isArray(analysis.pages)) {
    return NextResponse.json({ error: "analysis가 필요합니다." }, { status: 400 });
  }
  const referenceBrief: ConfirmedReferenceBrief | undefined = body?.referenceBrief;
  if (!referenceBrief?.direction?.editedPaletteOption || !referenceBrief.direction.paletteMode) {
    return NextResponse.json(
      { error: "확정된 레퍼런스 브리프가 필요합니다." },
      { status: 400 },
    );
  }
  try {
    assertBriefMatchesAnalysis(referenceBrief, analysis);
  } catch (e) {
    if (e instanceof ConfirmBriefError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }

  const directives = Array.isArray(body?.directives) ? body.directives : [];
  const representative = body?.representative ?? {};
  const baseContentVariantId: string | undefined =
    typeof body?.baseContentVariantId === "string" ? body.baseContentVariantId : undefined;

  const { direction, pages: briefPages, brandDecisions } = referenceBrief;
  const paletteOption = direction.editedPaletteOption;
  const moodKeywords = direction.moodKeywords;
  const typographyDirection = direction.typographyDirection;

  const layoutLines = briefPages
    .flatMap((p) => p.sections.map((s) => `- ${s.sectionId}: ${s.layoutPattern} (사용자 확정)`))
    .join("\n");

  // 채택 레퍼런스의 적용 요소·메모를 우선 사용한다(P9-A 작업 2·4) — 검색 결과
  // 자체가 아니라 "무엇을 가져오기로 했는지"만 프롬프트에 들어간다.
  const adoptionLines = briefPages
    .flatMap((p) =>
      p.sections.flatMap((s) =>
        s.adoptions.map(
          (a) =>
            `- ${s.sectionId}: ${a.aspects.join("/") || "전반"} 참고${a.note ? ` — ${a.note}` : ""}`,
        ),
      ),
    )
    .join("\n");

  const brandLines = brandDecisions
    .map((b) => {
      const parts: string[] = [];
      if (b.adoptedPatterns.length > 0) parts.push(`가져올 점: ${b.adoptedPatterns.join("; ")}`);
      if (b.avoidedPatterns.length > 0) parts.push(`피할 점: ${b.avoidedPatterns.join("; ")}`);
      return `  - ${b.name}${parts.length > 0 ? ` — ${parts.join(" / ")}` : ""}`;
    })
    .join("\n");

  const variants = analysis.existingContentVariants ?? [];
  const baseVariant = baseContentVariantId
    ? variants.find((v) => v.variantId === baseContentVariantId)
    : undefined;
  // 기존 시안 변형은 3안을 나누는 축이 아니라, 기준 변형 하나의 톤·강조점을
  // 참고 자료로만 전달한다(§6.7 — 변형별 안 생성은 온디맨드로 별도 처리).
  const variantBlock = baseVariant
    ? `\n## 기준 콘텐츠 변형 (참고 — 이 변형으로 3안 모두 작성, 변형별로 안을 나누지 않는다)\n${baseVariant.label}: ${baseVariant.contentSummary}\n`
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
${STRUCTURE_AXIS_BLOCK}

## 확정된 디자인 결정 (반드시 반영)
- 팔레트: ${JSON.stringify(paletteOption)}
- 무드 키워드: ${moodKeywords.join(", ") || "미확정"}
- 타이포 방향: ${typographyDirection || "미확정"}
- 금지 방향: ${direction.avoidDirections.join(", ") || "없음"}
${layoutLines ? `- 섹션별 표현 방식:\n${layoutLines}` : ""}
${adoptionLines ? `- 채택한 레퍼런스 적용 요소:\n${adoptionLines}` : ""}
${brandLines ? `- 벤치마킹 시사점:\n${brandLines}` : ""}
${variantBlock}
## 소스 자료 (선택된 페이지·확정 섹션만)
${buildSourceMaterial(analysis)}

## 출력 규칙
- 각 안 = 3축 컨셉 키워드 + UiStructure(전체 UI 방향) + KeyVisual(전체 비주얼 방향) + 페이지별 콘텐츠 매핑.
- 3축(conceptKeywords)은 "사용성/일관성/효율성" 같은 전략 축 3개. no("01"~"03"), title("사용성 (Usability)"), category("UX Strategy | 사용자 경험 중심"), description(2~3문장).
- pages: 소스 자료의 페이지·섹션 구조를 그대로 쓰되(pageId/sectionId 동일하게 유지 — 절대 새 ID 만들지 마라), 각 섹션에 layoutPattern(사용자 확정값 우선)과 contentMapping을 채워라.
- contentMapping.maskedContent: 그 화면 영역에 들어갈 실제 카피/본문 요약 (마스킹 토큰 유지). targetArea: hero-title/feature-card/timeline/table/stat-band 등.
- platforms (웹+모바일 동시 요구 시에만): 소스 자료가 웹과 모바일 산출물을 모두 명시적으로 요구하는 경우(예: "반응형 웹 + 모바일 앱", "PC/모바일 각각"), 각 안에 platforms.web과 platforms.mobile 페이지 세트를 별도로 채워라. 두 세트 모두 pages와 같은 구조이며 pageId/sectionId는 소스 자료 그대로 유지하되, layoutPattern·contentMapping은 플랫폼 특성(모바일 = 단일 컬럼, 하단 탭, 축약 카피)에 맞게 다르게 설계하라. 이때 pages에는 웹 세트를 그대로 복사해 넣어라. 웹 단일 요구라면 platforms를 넣지 마라.

반드시 JSON만 출력:
{ "options": [{ "optionId": string, "label": string,
  "conceptKeywords": [{ "no": string, "title": string, "category": string, "description": string }],
  "uiStructure": { "mode": "dark"|"light", "navPosition": "top"|"left", "infoStructure": string, "layoutConcept": string },
  "keyVisual": { "imageTone": string, "illustrationStyle": string, "backgroundPattern": string, "decorativeElements": string },
  "pages": [{ "pageId": string, "pageTitle": string, "sections": [{ "sectionId": string, "sectionTitle": string, "contentType": string, "layoutPattern": string, "contentMapping": { "maskedContent": string, "sourceSectionId": string, "targetArea": string } }] }],
  "platforms": { "web": [/* pages와 동일 구조 */], "mobile": [/* pages와 동일 구조 */] } | null }] }`;

  try {
    const raw = await generateJson(prompt);
    const concept = normalizeConcept(raw, analysis, representative, {
      paletteOption,
      moodKeywords,
      typographyDirection,
    });
    if (concept.options.length === 0) {
      throw new Error("컨셉 생성 결과가 비어 있습니다.");
    }
    // basedOnVariantLabel은 이제 "기준 변형" 표시 용도다(§6.7) — 3안 전체에 동일하게 적용.
    const optionsWithVariantLabel = baseVariant
      ? concept.options.map((o) => ({ ...o, basedOnVariantLabel: baseVariant.label }))
      : concept.options;
    const versioned = {
      ...concept,
      options: optionsWithVariantLabel,
      version: "2.0" as const,
      sourceBasis: referenceBrief,
      ...(baseContentVariantId ? { baseContentVariantId } : {}),
    };
    assertConceptJsonInvariant(versioned);
    return NextResponse.json({ concept: versioned });
  } catch (e) {
    const message = e instanceof Error ? e.message : "컨셉 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
