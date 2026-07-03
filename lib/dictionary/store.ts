import type { DictionaryEntry } from "../masking/types";

// 내 사전 — localStorage CRUD (phase1-masking-spec §6). 클라이언트 전용.
// 보안 경계: 사전은 "사용자가 직접 등록한 가릴 단어 목록"이라 localStorage 저장이
// 허용되는 유일한 예외다. 문서에서 추출된 원문·mappings·Detection.raw는 절대 저장 금지.
//
// person 카테고리는 항상 전역(global) — 같은 실무자가 여러 프로젝트에 반복 등장하므로
// 프로젝트 경계를 넘어 유지한다 (실사용#27).

const PROJECT_KEY = "drg.dictionary.v1";
const PERSON_KEY = "drg.dictionary.person.v1";

function read(key: string): DictionaryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(key: string, entries: DictionaryEntry[]): void {
  window.localStorage.setItem(key, JSON.stringify(entries));
}

function keyFor(kind: DictionaryEntry["kind"]): string {
  return kind === "person" ? PERSON_KEY : PROJECT_KEY;
}

export function listDictionary(): DictionaryEntry[] {
  return [...read(PROJECT_KEY), ...read(PERSON_KEY)];
}

export function addDictionaryEntry(
  value: string,
  kind: DictionaryEntry["kind"],
): DictionaryEntry | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const key = keyFor(kind);
  const entries = read(key);
  if (entries.some((e) => e.value === trimmed && e.kind === kind)) return null;

  const entry: DictionaryEntry = {
    id: crypto.randomUUID(),
    value: trimmed,
    kind,
    scope: kind === "person" ? "global" : "project",
  };
  write(key, [...entries, entry]);
  return entry;
}

export function removeDictionaryEntry(id: string): void {
  for (const key of [PROJECT_KEY, PERSON_KEY]) {
    const entries = read(key);
    const next = entries.filter((e) => e.id !== id);
    if (next.length !== entries.length) write(key, next);
  }
}
