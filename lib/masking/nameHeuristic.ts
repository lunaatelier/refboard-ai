// 직함 인접 한글 이름 휴리스틱 (실사용 QA 2026-07-24 발견 반영).
//
// personName은 원칙상 정규식 NER이 불가능해 사전 기반 전용이다(types.ts 참고) — 하지만
// 사전에 한 번도 등록된 적 없는 이름은, txt/md처럼 표 구조가 없는 문서에서 자동 탐지
// 경로가 전혀 없어 마스킹 없이 그대로 외부로 전송되는 사고가 실사용 QA에서 재현됐다
// ("담당자: 김민준", "PM 박서연", "최지훈 이사"류 문장이 전량 미탐지).
//
// 그렇다고 일반 NER을 도입하진 않는다(오탐 통제 불가) — 대신 "직함 단어 바로 옆의
// 2~4자 한글 토큰"만 후보로 잡아 dummyConfidence:"uncertain"으로 검수 화면에 올린다.
// 확정 여부는 항상 사용자 판단이며, 이 휴리스틱은 검토 유도 신호일 뿐이다.
//
// "대표"는 의도적으로 제외 — "대표 이미지/대표 색상"처럼 직함이 아닌 일반 형용사
// 용법이 실사용 문서에서 훨씬 흔해 오탐이 과도하다고 판단했다.
const ROLE_WORDS =
  "담당자|팀장|매니저|기획자|디자이너|개발자|실장|본부장|이사|책임자|사원|주임|대리|과장|부장|리드|PM|PL|PO|CTO|CEO";

// "직함(:)? 이름" — 예: "담당자: 김민준", "PM 박서연"
const PREFIX_RE = new RegExp(
  `(?:${ROLE_WORDS})\\s*[:：]?\\s*([가-힣]{2,4})(?=[\\s,)\\.]|$)`,
  "gd",
);

// "이름 직함" — 예: "김민준 팀장", "최지훈 이사"
const SUFFIX_RE = new RegExp(`([가-힣]{2,4})\\s+(?:${ROLE_WORDS})`, "gd");

// "디자인 리드", "영업 팀장", "개발 매니저"처럼 부서/직무 수식어 + 직함이 합쳐진
// 복합 직함도 흔하다 — 이 경우 SUFFIX_RE가 수식어를 이름으로 오탐한다("디자인 리드
// 이도현"에서 "디자인"을 잡는 식). 수식어 자리에 흔히 오는 단어는 이름이 아니므로
// 후보에서 제외한다.
const NON_NAME_QUALIFIERS = new Set([
  "디자인", "개발", "기획", "마케팅", "영업", "인사", "재무", "회계",
  "전략", "프로덕트", "서비스", "운영", "품질", "고객", "데이터", "보안",
  "인프라", "플랫폼", "브랜드", "콘텐츠", "프로젝트", "제품", "사업",
]);

export interface NameHeuristicCandidate {
  raw: string;
  start: number;
  end: number;
}

interface WithIndices {
  indices?: Array<[number, number] | undefined>;
}

export function detectRoleAdjacentNames(text: string): NameHeuristicCandidate[] {
  const out: NameHeuristicCandidate[] = [];
  for (const source of [PREFIX_RE, SUFFIX_RE]) {
    const regex = new RegExp(source.source, source.flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const groupRange = (m as unknown as WithIndices).indices?.[1];
      if (groupRange) {
        const [start, end] = groupRange;
        const raw = text.slice(start, end);
        if (!NON_NAME_QUALIFIERS.has(raw)) {
          out.push({ raw, start, end });
        }
      }
      if (m[0].length === 0) regex.lastIndex++;
    }
  }
  return out;
}
