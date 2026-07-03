import { NextResponse } from "next/server";
import { generateJson } from "@/lib/ai/client";
import { buildAnalysisPrompt } from "@/lib/ai/prompts";
import { normalizeAnalysis } from "@/lib/analysis/normalize";

// Phase 2 분석 (Step 7) — 입력은 maskedText만 (보안 하드 게이트).
// 원문·복원매핑은 이 라우트에 절대 도달하지 않는다. keptTargets는
// 사용자가 "유지"로 확정한 공개 엔티티 실명뿐이다 (CLAUDE.md §4.1.1).

export const runtime = "nodejs";

const MAX_TEXT = 200_000;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const maskedText: unknown = body?.maskedText;
  const keptTargets: string[] = Array.isArray(body?.keptTargets)
    ? body.keptTargets.filter((x: unknown): x is string => typeof x === "string")
    : [];
  // 전역 지시 (Step 8) — 텍스트만 수용 (마스킹 검수를 거치지 않는 자유 입력이므로
  // 사용자 책임 범위. UI에 "실명·기밀을 넣지 말 것" 안내)
  const directives = Array.isArray(body?.directives)
    ? body.directives
        .filter((d: unknown): d is { text: string } =>
          typeof (d as { text?: unknown })?.text === "string" &&
          !!(d as { text: string }).text.trim(),
        )
        .map((d: { text: string }) => ({ text: d.text.trim() }))
    : [];

  if (typeof maskedText !== "string" || !maskedText.trim()) {
    return NextResponse.json(
      { error: "maskedText가 필요합니다." },
      { status: 400 },
    );
  }
  if (maskedText.length > MAX_TEXT) {
    return NextResponse.json(
      { error: "텍스트가 너무 깁니다 (20만 자 제한)." },
      { status: 413 },
    );
  }

  try {
    const raw = await generateJson(
      buildAnalysisPrompt(maskedText, keptTargets, directives),
    );
    return NextResponse.json({ analysis: normalizeAnalysis(raw) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "분석에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
