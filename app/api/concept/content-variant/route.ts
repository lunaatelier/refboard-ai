import { NextResponse } from "next/server";
import { generateJson } from "@/lib/ai/client";
import { buildDirectiveBlock } from "@/lib/ai/prompts";
import type { ConceptPage } from "@/lib/concept/types";
import type { ProjectAnalysis, ProjectDirective } from "@/lib/analysis/types";
import { checkBudget, recordFailure, recordSuccess } from "@/lib/reference/apiGuard";

// 온디맨드 콘텐츠 변형 매핑 (§6.7, P1 item 12) — 이미 확정된 구조(uiStructure/
// keyVisual/designBasis/layoutPattern)는 건드리지 않고, 선택한 비기준 콘텐츠
// 변형의 원고로 각 섹션의 contentMapping.maskedContent만 다시 쓰는 경량 요청.
// 구조 3안 생성 API(/api/concept)를 다시 부르지 않는다 — 그래서 별도 route다.

export const runtime = "nodejs";

const FEATURE = "concept-content-variant";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const analysis: ProjectAnalysis | undefined = body?.analysis;
  const pages: ConceptPage[] | undefined = body?.pages;
  const contentVariantId: string | undefined = body?.contentVariantId;
  if (!analysis || !Array.isArray(analysis.pages) || !Array.isArray(pages) || pages.length === 0) {
    return NextResponse.json({ error: "analysis와 pages가 필요합니다." }, { status: 400 });
  }
  if (!contentVariantId) {
    return NextResponse.json({ error: "contentVariantId가 필요합니다." }, { status: 400 });
  }
  const variant = (analysis.existingContentVariants ?? []).find(
    (v) => v.variantId === contentVariantId,
  );
  if (!variant) {
    return NextResponse.json({ error: "존재하지 않는 콘텐츠 변형입니다." }, { status: 400 });
  }

  const validSectionIds = new Set(
    analysis.pages.flatMap((p) => p.sections.map((s) => s.sectionId)),
  );
  // 넘어온 pages 자체가 위조됐을 가능성도 방어한다 — 분석 결과에 없는 섹션은
  // 애초에 다시 쓰지 않는다.
  const targetSections = pages
    .flatMap((p) => p.sections)
    .filter((s) => validSectionIds.has(s.sectionId));
  if (targetSections.length === 0) {
    return NextResponse.json(
      { error: "유효한 섹션이 없습니다." },
      { status: 400 },
    );
  }

  const gate = checkBudget(req, FEATURE, "이 프로젝트에서 콘텐츠 변형 적용을 이미 최대 횟수만큼 사용했습니다.");
  if (!gate.ok) return gate.response!;

  const directives: ProjectDirective[] = Array.isArray(body?.directives)
    ? body.directives
    : [];

  const structureLines = targetSections
    .map(
      (s) =>
        `- ${s.sectionId} (${s.layoutPattern} / ${s.contentMapping.targetArea}): 기존 카피 "${s.contentMapping.maskedContent}"`,
    )
    .join("\n");

  const prompt = `당신은 시니어 카피라이터다. 이미 확정된 디자인 구조(레이아웃·화면 영역)는 그대로 두고, 아래 콘텐츠 변형의 원고 톤으로 각 섹션의 카피만 다시 작성하라.
([회사A] 같은 대괄호 토큰은 마스킹된 실명이다 — 그대로 유지하고 복원하지 마라.)
${buildDirectiveBlock(directives, "concept")}
## 적용할 콘텐츠 변형
${variant.label}: ${variant.contentSummary}

## 기존 섹션 구조 (layoutPattern·targetArea는 바꾸지 마라, sectionId도 그대로)
${structureLines}

반드시 JSON만 출력:
{ "sections": [{ "sectionId": string, "maskedContent": string }] }`;

  try {
    const raw = await generateJson<{
      sections?: Array<{ sectionId: string; maskedContent: string }>;
    }>(prompt);
    const rewritten = new Map(
      (Array.isArray(raw?.sections) ? raw.sections : [])
        .filter(
          (s): s is { sectionId: string; maskedContent: string } =>
            typeof s?.sectionId === "string" &&
            typeof s?.maskedContent === "string" &&
            validSectionIds.has(s.sectionId),
        )
        .map((s) => [s.sectionId, s.maskedContent] as const),
    );
    const nextPages: ConceptPage[] = pages.map((p) => ({
      ...p,
      sections: p.sections.map((s) => ({
        ...s,
        contentMapping: {
          ...s.contentMapping,
          maskedContent: rewritten.get(s.sectionId) ?? s.contentMapping.maskedContent,
        },
      })),
    }));
    recordSuccess(FEATURE, gate);
    return NextResponse.json({ pages: nextPages });
  } catch (e) {
    recordFailure(FEATURE, gate, e);
    const message = e instanceof Error ? e.message : "콘텐츠 매핑 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
