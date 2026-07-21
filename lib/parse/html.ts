// 링크 입력 (Step 17, Phase 1.5) — 공개 페이지 HTML → 텍스트 추출. isomorphic 순수 함수.
// 추출된 텍스트는 업로드 문서와 동일하게 "원문(parsedText)" 취급 → 마스킹 게이트 통과 필수.

export function extractHtmlText(html: string): string {
  const withoutBlocks = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  // 블록 요소 경계는 줄바꿈으로 보존해 문단 구조를 남긴다
  const withBreaks = withoutBlocks
    .replace(/<(\/?)(p|div|section|article|h[1-6]|li|tr|br|header|footer|nav|main)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(withBreaks)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ");
}

// OG 미리보기 (P5-5) — 사용자가 수동으로 붙여넣은 레퍼런스 URL의 제목/썸네일만
// 뽑아 보여준다. 프로젝트 데이터가 아니라 공개 페이지 자체의 메타데이터라
// 마스킹 대상이 아니다(§4.1 "외부"는 우리 문서 원문 기준). 실패 시 호출자가
// 그냥 텍스트 링크로 두면 되도록 필드 전부 optional.
export interface OgMeta {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

function readMetaAttr(tag: string, name: string): string | undefined {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
  const m = tag.match(re);
  if (!m) return undefined;
  return decodeEntities(m[2] ?? m[3] ?? "");
}

export function extractOgMeta(html: string, baseUrl?: string): OgMeta {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const values: Record<string, string> = {};
  for (const tag of metaTags) {
    const prop = readMetaAttr(tag, "property") ?? readMetaAttr(tag, "name");
    const content = readMetaAttr(tag, "content");
    if (!prop || content === undefined) continue;
    const key = prop.toLowerCase();
    if (!(key in values)) values[key] = content; // 중복 태그는 첫 값 우선
  }

  const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleTag = titleTagMatch ? decodeEntities(titleTagMatch[1]).trim() : undefined;

  const image = values["og:image"] ?? values["og:image:url"] ?? values["twitter:image"];

  return {
    title: nonEmpty(values["og:title"] ?? values["twitter:title"] ?? titleTag),
    description: nonEmpty(values["og:description"] ?? values["twitter:description"] ?? values["description"]),
    siteName: nonEmpty(values["og:site_name"]),
    image: image ? resolveMaybeRelative(image, baseUrl) : undefined,
  };
}

function nonEmpty(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed ? trimmed : undefined;
}

function resolveMaybeRelative(url: string, baseUrl?: string): string | undefined {
  if (!baseUrl) return nonEmpty(url);
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return nonEmpty(url);
  }
}

// SSRF 가드 — 사설망·로컬 주소로의 서버 fetch 차단 (서버 라우트에서 사용)
export function isBlockedLinkTarget(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "::1") {
    return true;
  }
  // IPv4 사설/루프백/링크로컬 대역
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 0 || a === 10 || a === 127 || a === 169) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  // IPv6 루프백/사설(ULA)/링크로컬
  if (host.includes(":")) {
    if (/^(\[)?(::1|f[cd]|fe80)/i.test(host)) return true;
  }
  return false;
}
