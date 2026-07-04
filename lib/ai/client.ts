// 모든 외부 AI 호출은 이 모듈 한 곳에 모은다 (CLAUDE.md §2).
// 서버 전용 — 키는 서버에서만 읽고, 로그·에러·응답에 노출하지 않는다.
// 모델 교체(NVIDIA 등 OpenAI 호환)가 필요하면 이 파일만 바꾼다.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error("lib/ai/client.ts는 서버 전용입니다.");
  }
}

// GEMINI_API_KEY 쿼터 소진(HTTP 429) 시 GEMINI_API_KEY_2(예비 키)로 한 번 재시도한다.
// GEMINI_API_KEY_2가 설정되지 않았으면 원래 응답(429)을 그대로 반환한다.
async function fetchGemini(url: string, body: unknown): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다 (.env.local).");
  }
  const call = (key: string) =>
    fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key, // URL이 아닌 헤더로 — 키가 URL 로그에 남지 않게
      },
      body: JSON.stringify(body),
    });

  const res = await call(apiKey);
  if (res.status === 429) {
    const backupKey = process.env.GEMINI_API_KEY_2;
    if (backupKey) return call(backupKey);
  }
  return res;
}

// 멀티모달 입력 (Step 9) — opt-in 동의를 거친 이미지만 이 경로로 들어와야 한다.
export interface InlineImage {
  mimeType: string;
  data: string; // base64
}

export async function generateJson<T>(
  prompt: string,
  images: InlineImage[] = [],
): Promise<T> {
  assertServer();
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  const res = await fetchGemini(`${API_BASE}/models/${model}:generateContent`, {
    contents: [
      {
        parts: [
          { text: prompt },
          ...images.map((img) => ({
            inlineData: { mimeType: img.mimeType, data: img.data },
          })),
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  if (!res.ok) {
    // 응답 본문은 프롬프트/키 조각을 포함할 수 있으므로 상태 코드만 전달
    throw new Error(`AI 호출 실패 (HTTP ${res.status})`);
  }

  const data = await res.json();
  const text: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("AI 응답 형식이 올바르지 않습니다.");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("AI 응답 JSON 파싱에 실패했습니다.");
  }
}

// 검색 grounding 호출 (Step 10-c) — 분석 대상 브랜드의 실서비스 URL 확보용 (환각 방지).
// google_search 도구는 JSON 응답 모드와 함께 쓸 수 없어 텍스트에서 JSON을 추출한다.
// 주의: 무료 티어에서 grounding 쿼터는 모델별로 다르다 — gemini-3.5-flash는 쿼터가 없어
// grounding 전용 모델(기본 gemini-2.5-flash)을 분리해서 쓴다.
export async function generateGroundedJson<T>(prompt: string): Promise<T> {
  assertServer();
  const model = process.env.GEMINI_GROUNDING_MODEL || "gemini-2.5-flash";

  const res = await fetchGemini(`${API_BASE}/models/${model}:generateContent`, {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.3 },
  });

  if (!res.ok) {
    throw new Error(`AI 호출 실패 (HTTP ${res.status})`);
  }

  const data = await res.json();
  const parts: unknown[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((p) => (typeof (p as { text?: unknown })?.text === "string" ? (p as { text: string }).text : ""))
    .join("");

  // 코드펜스/설명문 속에서 JSON 본문만 추출
  const start = Math.min(
    ...["[", "{"].map((c) => {
      const i = text.indexOf(c);
      return i < 0 ? Number.POSITIVE_INFINITY : i;
    }),
  );
  const end = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
  if (!Number.isFinite(start) || end <= start) {
    throw new Error("AI 응답에서 JSON을 찾지 못했습니다.");
  }
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    throw new Error("AI 응답 JSON 파싱에 실패했습니다.");
  }
}
