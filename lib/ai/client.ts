// 모든 외부 AI 호출은 이 모듈 한 곳에 모은다 (CLAUDE.md §2).
// 서버 전용 — 키는 서버에서만 읽고, 로그·에러·응답에 노출하지 않는다.
// 모델 교체(NVIDIA 등 OpenAI 호환)가 필요하면 이 파일만 바꾼다.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error("lib/ai/client.ts는 서버 전용입니다.");
  }
}

export async function generateJson<T>(prompt: string): Promise<T> {
  assertServer();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다 (.env.local).");
  }
  const model = process.env.GEMINI_MODEL || "gemini-3-flash";

  const res = await fetch(`${API_BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey, // URL이 아닌 헤더로 — 키가 URL 로그에 남지 않게
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    }),
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
