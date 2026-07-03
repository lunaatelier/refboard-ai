import type { Detection, NumericDetection, NumericMaskingMode } from "./types";

// 민감 수치 탐지 (Step 6, flow-spec ②) — isomorphic 순수 함수.
// 개인정보는 아니나 외부 유출 위험이 있는 수치: 투자금·매출·고객 수·내부 KPI.
// 숫자 지표는 후보 탐지일 뿐 — 최종 민감 여부·모드는 사용자 검수로 확정한다.
//
// 표 형태 재무데이터(실사용#15): 표의 각 셀 수치도 아래 규칙에 개별 매칭되어
// 행/열 단위로 다건 생성된다. 라벨(연도·항목)은 치환하지 않으므로 표 구조는 유지된다.

type NumericKind = NumericDetection["kind"];

interface NumericRule {
  kind: NumericKind;
  regex: RegExp; // 그룹1 = 라벨(키워드), 그룹2 = 수치+단위 (치환 대상)
}

const NUM = "[\\d][\\d,.]*";

const NUMERIC_RULES: NumericRule[] = [
  {
    kind: "financialMetric",
    regex: new RegExp(
      `(누적\\s*투자금|투자\\s*유치(?:액)?|투자금|매출(?:액)?|영업\\s*이익|ARR|MRR)\\s*[:은는이가약]?\\s*(${NUM}\\s*(?:조|억|천만|백만|만)?\\s*원?)`,
      "g",
    ),
  },
  {
    kind: "businessMetric",
    regex: new RegExp(
      `(고객(?:사)?|사용자|가입자|회원|파트너)\\s*수?\\s*[:은는이가약]?\\s*(${NUM}\\s*(?:만|천)?\\s*(?:곳|개사|개|명|사))`,
      "g",
    ),
  },
  {
    kind: "businessMetric",
    regex: new RegExp(
      `(성장률|증가율|점유율|전환율|MAU|DAU|WAU)\\s*[:은는이가약]?\\s*(${NUM}\\s*(?:만|천)?\\s*[%명]?)`,
      "g",
    ),
  },
  {
    kind: "internalKpi",
    regex: new RegExp(
      `(KPI|내부\\s*목표(?:치)?|목표\\s*(?:전환율|매출|성장률|수치))\\s*[:은는이가약]?\\s*(${NUM}\\s*[%조억만원명곳개]*)`,
      "g",
    ),
  },
];

// 기본 모드 (flow-spec ②): 투자금·매출·ARR·영업이익 = exact /
// 고객수·사용자수·성장률 = range / keep은 사용자가 공개 확정한 경우만.
export const DEFAULT_NUMERIC_MODE: Record<NumericKind, NumericMaskingMode> = {
  financialMetric: "exact-mask",
  businessMetric: "range-generalize",
  internalKpi: "exact-mask",
};

function magnitudePrefix(n: number): string {
  if (n < 10) return "수";
  if (n < 100) return "수십";
  if (n < 1000) return "수백";
  return "수천";
}

// "35억" → "수십억 원대", "43곳" → "수십 곳", "12%" → "수십 % 수준"
export function generalizeNumeric(raw: string): string {
  const m = raw.replace(/,/g, "").match(/([\d.]+)\s*(조|억|천만|백만|만)?\s*(원|%|곳|개사|개|명|사)?/);
  if (!m) return "비공개 수치";
  const n = parseFloat(m[1]);
  const scale = m[2] ?? "";
  const unit = m[3] ?? "";

  if (unit === "%") {
    return n < 10 ? "한 자릿수 % 수준" : `${magnitudePrefix(n)} % 수준`;
  }
  if (scale === "조" || scale === "억") {
    return `${magnitudePrefix(n)}${scale} 원대`;
  }
  if (scale === "천만" || scale === "백만" || scale === "만") {
    return `${magnitudePrefix(n)}${scale} 원대`;
  }
  if (unit === "곳" || unit === "개" || unit === "개사" || unit === "명" || unit === "사") {
    return `${magnitudePrefix(n)} ${unit}`;
  }
  return "비공개 수치";
}

export function detectNumeric(
  text: string,
  existingDetections: Detection[] = [],
): NumericDetection[] {
  const found: NumericDetection[] = [];

  for (const rule of NUMERIC_RULES) {
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const numRaw = m[2].trim();
      const start = m.index + m[0].lastIndexOf(m[2]);
      const end = start + m[2].length;
      const overlapsDetection = existingDetections.some(
        (d) => start < d.end && d.start < end,
      );
      const overlapsNumeric = found.some(
        (f) => start < f.end && f.start < end,
      );
      if (overlapsDetection || overlapsNumeric) continue;
      found.push({
        id: `num-${start}`,
        kind: rule.kind,
        raw: numRaw,
        label: m[1].trim(),
        start,
        end,
        generalized: generalizeNumeric(numRaw),
        mode: DEFAULT_NUMERIC_MODE[rule.kind],
      });
    }
  }

  return found.sort((a, b) => a.start - b.start);
}
