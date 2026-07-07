// 모든 외부 AI 호출은 이 모듈 한 곳에 모은다 (CLAUDE.md §2).
// 서버 전용 — 키는 서버에서만 읽고, 로그·에러·응답에 노출하지 않는다.
// 모델 교체(NVIDIA 등 OpenAI 호환)가 필요하면 이 파일만 바꾼다.

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error("lib/ai/client.ts는 서버 전용입니다.");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// GEMINI_API_KEY 쿼터 소진(HTTP 429) 시 GEMINI_API_KEY_2(예비 키)로 한 번 재시도한다.
// GEMINI_API_KEY_2가 설정되지 않았으면 원래 응답(429)을 그대로 반환한다.
// HTTP 503(모델 일시 과부하)은 실측상 짧게 재시도하면 대부분 성공하므로,
// 백오프(1초→2초)를 두고 최대 2회 재시도한 뒤에도 안 되면 그대로 반환한다.
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

  let res = await call(apiKey);
  for (let attempt = 0; res.status === 503 && attempt < 2; attempt++) {
    await sleep(1000 * (attempt + 1));
    res = await call(apiKey);
  }

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

// ── NVIDIA NIM 이미지 생성 (Step 19) ──────────────────────────────────────
// 프롬프트는 이미 마스킹 토큰이 제거된 영어 문구만 들어와야 한다 (image-hints 경로).
// 모델별로 요청 본문이 다르다 — 기본값 flux.1-schnell 기준. 교체 시 여기만 수정.

const NVIDIA_GENAI_BASE = "https://ai.api.nvidia.com/v1/genai";

export function isImageGenerationEnabled(): boolean {
  assertServer();
  return Boolean(process.env.NVIDIA_API_KEY);
}

export interface GeneratedImage {
  mimeType: string;
  base64: string;
}

export async function generateImage(
  prompt: string,
  size: { width: number; height: number },
): Promise<GeneratedImage> {
  assertServer();
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY가 설정되지 않았습니다 (.env.local).");
  }
  // 기본 flux.1-dev — 실측: schnell 함수는 콜드스타트 504가 잦고, dev는 즉시 200.
  const model =
    process.env.NVIDIA_IMAGE_MODEL || "black-forest-labs/flux.1-dev";
  // schnell은 4스텝 전용 증류 모델, dev는 스텝이 많을수록 품질↑ (10 = 속도 절충)
  const steps = model.includes("schnell") ? 4 : 10;

  let res = await fetch(`${NVIDIA_GENAI_BASE}/${model}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "application/json",
      "content-type": "application/json",
      // 서버가 준비될 때까지 최대 60초 롱폴 (콜드스타트 504 완화)
      "nvcf-poll-seconds": "60",
    },
    body: JSON.stringify({
      prompt,
      width: size.width,
      height: size.height,
      steps,
      seed: Math.floor(Math.random() * 4294967295),
    }),
  });

  // NVCF 비동기 패턴: 202 + nvcf-reqid → 상태 엔드포인트 폴링
  if (res.status === 202) {
    const reqId = res.headers.get("nvcf-reqid");
    if (!reqId) throw new Error("이미지 생성 실패 (202, 요청 ID 없음)");
    for (let attempt = 0; attempt < 5 && res.status === 202; attempt++) {
      res = await fetch(
        `https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/${reqId}`,
        {
          headers: {
            authorization: `Bearer ${apiKey}`,
            accept: "application/json",
            "nvcf-poll-seconds": "60",
          },
        },
      );
    }
  }
  if (!res.ok) {
    // 키·프롬프트를 에러에 싣지 않는다
    throw new Error(`이미지 생성 실패 (HTTP ${res.status})`);
  }

  const data = await res.json();
  // 모델·버전에 따라 응답 필드가 다르다 — 알려진 형태를 순서대로 시도
  const base64: unknown =
    data?.artifacts?.[0]?.base64 ?? data?.image ?? data?.data?.[0]?.b64_json;
  if (typeof base64 !== "string" || !base64) {
    throw new Error("이미지 생성 응답 형식을 해석하지 못했습니다.");
  }
  return { mimeType: detectImageMimeType(base64), base64 };
}

// 실측: flux.1-dev는 실제로 JPEG 바이트를 반환하는데 별도 포맷 필드가 없다.
// mimeType을 PNG로 고정하면 브라우저가 매직바이트로 눈치껏 보정해 우연히 렌더링될
// 뿐, data URL 스펙상 틀린 라벨이 된다 — base64 앞부분(매직바이트)으로 직접 판별한다.
export function detectImageMimeType(base64: string): string {
  const head = base64.slice(0, 16);
  if (head.startsWith("iVBORw0KGgo")) return "image/png";
  if (head.startsWith("/9j/")) return "image/jpeg";
  if (head.startsWith("R0lGOD")) return "image/gif";
  if (head.startsWith("UklGR")) return "image/webp";
  return "image/png"; // 알 수 없는 경우의 폴백
}
