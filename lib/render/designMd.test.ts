import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mockConceptJson } from "../concept/mockConceptJson";
import type { DomainHint } from "../analysis/types";
import {
  AA_CONTRAST_THRESHOLD,
  buildDesignMdInstance,
  contrastRatio,
  renderDesignMd,
} from "./designMd";

// Phase 5 렌더러 검증 — docs/design-system-schema.md v1.1.1 §0~§13 구조 준수 확인.
// mockConceptJson(designBasis 포함 fixture, 3안)에서 A안(라이트)/B안(다크)을 각각 넣어
// source: concept 완화 규칙(필수 컴포넌트 4종·category 순회 의무 면제)까지 함께 확인한다.

const optionA = mockConceptJson.options[0]; // light, primary #2563EB
const optionB = mockConceptJson.options[1]; // dark, primary #3B82F6

const baseOpts = {
  projectTitle: mockConceptJson.projectTitle,
  option: optionA,
  extractedDate: "2026-07-10",
  instanceVersion: "0.1",
};

describe("Phase 5 — 디자인 MD 렌더러: frontmatter", () => {
  it("source: concept, status: draft가 고정되고 schema-version은 1.1.1이다", () => {
    const instance = buildDesignMdInstance(baseOpts);
    assert.equal(instance.meta.source, "concept");
    assert.equal(instance.meta.status, "draft");
    assert.equal(instance.meta["schema-version"], "1.1.1");
    assert.equal(instance.meta.mode, "light");
  });

  it("옵션 mode(dark)를 넣으면 meta.mode도 dark로 반영된다", () => {
    const instance = buildDesignMdInstance({ ...baseOpts, option: optionB });
    assert.equal(instance.meta.mode, "dark");
  });

  it("MD 텍스트의 frontmatter도 동일 값을 담는다", () => {
    const md = renderDesignMd(baseOpts);
    assert.match(md, /^---\n/);
    assert.match(md, /source: concept/);
    assert.match(md, /status: draft/);
    assert.match(md, /schema-version: "1\.1\.1"/);
  });
});

describe("Phase 5 — 디자인 MD 렌더러: colors.semantic 매핑(§12)", () => {
  it("필수 7종이 모두 채워진다", () => {
    const { semantic } = buildDesignMdInstance(baseOpts).colors;
    for (const key of ["primary", "on-primary", "canvas", "surface", "text", "text-muted", "border"]) {
      assert.ok(semantic[key], `${key} 슬롯이 없음`);
      assert.ok(semantic[key].value.length > 0);
    }
  });

  it("palette.background→canvas, palette.text→text 매핑 규칙을 따른다", () => {
    const instance = buildDesignMdInstance(baseOpts);
    assert.equal(instance.colors.semantic.canvas.value, optionA.designBasis.palette.background);
    assert.equal(instance.colors.semantic.text.value, optionA.designBasis.palette.text);
    assert.equal(instance.colors.semantic.canvas.source, "proposed");
  });

  it("on-primary/border는 컨셉에 없는 슬롯이라 derived로 표기되고 known-gaps에도 기록된다", () => {
    const instance = buildDesignMdInstance(baseOpts);
    assert.equal(instance.colors.semantic["on-primary"].source, "derived");
    assert.equal(instance.colors.semantic.border.source, "derived");
    const gapTypes = instance["known-gaps"].map((g) => g.type);
    assert.ok(gapTypes.includes("on-primary"));
    assert.ok(gapTypes.includes("border"));
  });
});

describe("Phase 5 — 디자인 MD 렌더러: on-primary 대비 검증(회귀 — 흰색 고정 버그)", () => {
  it("optionA(primary #2563EB)는 흰색이 이미 AA(4.5:1)를 충족해 흰색을 유지한다", () => {
    const instance = buildDesignMdInstance(baseOpts);
    const onPrimary = instance.colors.semantic["on-primary"].value;
    assert.equal(onPrimary, "#FFFFFF");
    assert.ok(contrastRatio(optionA.designBasis.palette.primary, onPrimary) >= AA_CONTRAST_THRESHOLD);
  });

  it("optionB(primary #3B82F6)는 흰색이 AA 미달(≈3.7:1)이라 어두운 값으로 전환된다", () => {
    const instance = buildDesignMdInstance({ ...baseOpts, option: optionB });
    const primary = optionB.designBasis.palette.primary;
    const onPrimary = instance.colors.semantic["on-primary"].value;

    // 회귀 대상이었던 실패 조건: 흰색 고정 시 AA 미달이었음 — 그 사실 자체를 재확인.
    const whiteRatio = contrastRatio(primary, "#FFFFFF");
    assert.ok(whiteRatio < AA_CONTRAST_THRESHOLD, `사전 조건 실패 — 흰색 대비가 이미 ${whiteRatio}로 AA를 충족함`);

    // 수정 후: 흰색이 아니라 AA를 충족하는 값으로 전환되어야 한다.
    assert.notEqual(onPrimary, "#FFFFFF");
    const finalRatio = contrastRatio(primary, onPrimary);
    assert.ok(finalRatio >= AA_CONTRAST_THRESHOLD, `전환 후에도 AA 미달 — ${finalRatio}:1`);
  });

  it("known-gaps의 on-primary reason에 실제 재계산된 대비비와 AA 충족 여부가 기록된다(자기모순 없음)", () => {
    const instanceA = buildDesignMdInstance(baseOpts);
    const gapA = instanceA["known-gaps"].find((g) => g.category === "colors" && g.type === "on-primary")!;
    assert.match(gapA.reason, /충족/);
    assert.ok(!/미달/.test(gapA.reason));

    const instanceB = buildDesignMdInstance({ ...baseOpts, option: optionB });
    const gapB = instanceB["known-gaps"].find((g) => g.category === "colors" && g.type === "on-primary")!;
    // B안은 전환 후 AA를 충족하므로(위 테스트) "충족"으로 기록되어야 한다.
    assert.match(gapB.reason, /충족/);
  });
});

describe("Phase 5 — 디자인 MD 렌더러: known-gaps reason 일관성(회귀 — surface-alt 자기모순 버그)", () => {
  it("surface-alt는 JSON에서도 proposed, known-gaps reason도 proposed로 일치한다(mapped라고 쓰지 않음)", () => {
    const instance = buildDesignMdInstance(baseOpts);
    assert.equal(instance.colors.semantic["surface-alt"].source, "proposed");
    const gap = instance["known-gaps"].find((g) => g.category === "colors" && g.type === "surface-alt")!;
    assert.match(gap.reason, /proposed/);
    assert.ok(!/mapped/.test(gap.reason), "surface-alt는 proposed인데 reason에 mapped가 남아있으면 자기모순");
  });

  it("모든 known-gaps 항목은 그 토큰이 실제로 존재할 경우 reason이 토큰의 source와 모순되지 않는다", () => {
    const instance = buildDesignMdInstance(baseOpts);
    const sourceWord: Record<string, string> = {
      proposed: "proposed",
      mapped: "mapped",
      derived: "derived",
      fallback: "fallback",
      extracted: "실측",
    };
    for (const [key, token] of Object.entries(instance.colors.semantic)) {
      const gap = instance["known-gaps"].find((g) => g.category === "colors" && g.type === key);
      if (!gap) continue; // 권장 토큰 등 부재 항목은 대상 아님
      assert.match(
        gap.reason,
        new RegExp(sourceWord[token.source]),
        `${key}: reason("${gap.reason}")이 실제 source("${token.source}")와 불일치`,
      );
    }
  });

  it("text-muted는 secondary를 mapped했다는 사실이 reason의 from과 일치한다", () => {
    const instance = buildDesignMdInstance(baseOpts);
    assert.equal(instance.colors.semantic["text-muted"].from, "secondary");
    const gap = instance["known-gaps"].find((g) => g.category === "colors" && g.type === "text-muted")!;
    assert.match(gap.reason, /secondary/);
  });
});

describe("Phase 5 — 디자인 MD 렌더러: 필수 컴포넌트 4종 완화 규칙(§6.2/§1)", () => {
  it("button-primary/card-default는 concept 레벨로 채워지고, button-secondary/input-default는 없어도 에러 없이 known-gaps로 대체된다", () => {
    const instance = buildDesignMdInstance(baseOpts);
    assert.ok(instance.components["button-primary"]);
    assert.ok(instance.components["card-default"]);
    assert.equal(instance.components["button-secondary"], undefined);
    assert.equal(instance.components["input-default"], undefined);

    const gapTypes = instance["known-gaps"].map((g) => g.type);
    assert.ok(gapTypes.includes("button-secondary"));
    assert.ok(gapTypes.includes("input-default"));
  });

  it("component 토큰 필드는 참조 문법을 유지한다(hex 직접 기입 금지)", () => {
    const instance = buildDesignMdInstance(baseOpts);
    const btn = instance.components["button-primary"];
    assert.equal(btn.backgroundColor, "{colors.primary}");
    assert.equal(btn.textColor, "{colors.on-primary}");
    assert.ok(!/^#[0-9a-fA-F]{3,8}$/.test(btn.backgroundColor ?? ""));
  });
});

describe("Phase 5 — 디자인 MD 렌더러: known-gaps(§10)", () => {
  it("빈 배열이 아니며 각 항목은 category/type/reason을 갖는다", () => {
    const gaps = buildDesignMdInstance(baseOpts)["known-gaps"];
    assert.ok(gaps.length > 0);
    for (const g of gaps) {
      assert.ok(g.category);
      assert.ok(g.type);
      assert.ok(g.reason);
    }
  });
});

describe("Phase 5 — 디자인 MD 렌더러: typography fallback 스케일 자체 정합성(회귀 — caption 12px 버그)", () => {
  it("모든 슬롯(caption 포함)이 min-body-size 제약(최소 14px) 이상이다", () => {
    const instance = buildDesignMdInstance(baseOpts);
    const minBodySizeConstraint = instance.rules.constraints.find((c) => c.id === "min-body-size")!;
    assert.match(minBodySizeConstraint.rule, /14px/);

    for (const [slotName, slot] of Object.entries(instance.typography.slots)) {
      const px = parseInt(slot.fontSize, 10);
      assert.ok(px >= 14, `${slotName}: ${slot.fontSize}가 min-body-size(14px) 미달 — 인스턴스 자체 모순`);
    }
  });
});

describe("Phase 5 — 디자인 MD 렌더러: §0 문서 구조(섹션 생략 금지)", () => {
  it("frontmatter + 8개 고정 섹션이 순서대로 모두 존재한다", () => {
    const md = renderDesignMd(baseOpts);
    const headings = [
      "## 1. Overview",
      "## 2. Colors",
      "## 3. Typography",
      "## 4. Layout",
      "## 5. Shape & Elevation",
      "## 6. Components",
      "## 7. Rules",
      "## 8. Known Gaps",
    ];
    let lastIndex = -1;
    for (const h of headings) {
      const idx = md.indexOf(h);
      assert.ok(idx > lastIndex, `${h} 섹션이 없거나 순서가 어긋남`);
      lastIndex = idx;
    }
  });

  it("후미에 ```json 블록이 있고, 그 안의 JSON이 buildDesignMdInstance와 동일하다(JSON=SSoT)", () => {
    const md = renderDesignMd(baseOpts);
    const match = md.match(/```json\n([\s\S]+?)\n```/);
    assert.ok(match, "후미 JSON 블록을 찾지 못함");
    const parsed = JSON.parse(match![1]);
    assert.deepEqual(parsed, buildDesignMdInstance(baseOpts));
  });

  it("MD 프로즈에는 hex 값을 직접 쓰지 않고 토큰명({colors.x})으로 언급한다", () => {
    const md = renderDesignMd(baseOpts);
    const proseOnly = md.split("```json")[0];
    assert.ok(!/#[0-9a-fA-F]{6}\b/.test(proseOnly));
    assert.ok(proseOnly.includes("{colors.primary}"));
  });

  it("known-gaps가 비어도(가정) 섹션 8은 '없음'을 명시해야 하지만, concept 인스턴스는 항상 gap이 있다", () => {
    const gaps = buildDesignMdInstance(baseOpts)["known-gaps"];
    assert.ok(gaps.length > 0, "concept 인스턴스는 known-gaps가 항상 존재해야 한다");
  });
});

describe("Phase 5 — 디자인 MD 렌더러: rules 파생 렌더링(§7.1, 회귀 — Don't 하드코딩 버그)", () => {
  it("모든 constraints.rule이 Do 또는 Don't 어딘가에 1:1로 파생된다(누락 없음)", () => {
    const instance = buildDesignMdInstance(baseOpts);
    const md = renderDesignMd(baseOpts);
    const rulesProse = md.split("## 7. Rules")[1].split("## 8. Known Gaps")[0];
    for (const c of instance.rules.constraints) {
      assert.ok(rulesProse.includes(c.rule), `constraint "${c.id}"가 Rules 섹션에 반영되지 않음`);
    }
  });

  it("Don't로 렌더링되는 두 항목이 정식 constraint로 존재한다(§7.1: 별도 작성 금지)", () => {
    const instance = buildDesignMdInstance(baseOpts);
    const ids = instance.rules.constraints.map((c) => c.id);
    assert.ok(ids.includes("no-unverified-fix-apply"));
    assert.ok(ids.includes("no-fabricated-recommended-colors"));

    const md = renderDesignMd(baseOpts);
    const dontBlock = md.split("**Don't:**")[1].split("## 8. Known Gaps")[0];
    assert.ok(dontBlock.includes("apply의 fix 모드"));
    assert.ok(dontBlock.includes("권장 컬러"));
  });

  it("'금지'를 포함하는 constraint만 Don't에, 나머지는 Do에 기계적으로 분류된다", () => {
    const instance = buildDesignMdInstance(baseOpts);
    const md = renderDesignMd(baseOpts);
    const doBlock = md.split("**Do:**")[1].split("**Don't:**")[0];
    const dontBlock = md.split("**Don't:**")[1].split("## 8. Known Gaps")[0];
    for (const c of instance.rules.constraints) {
      if (c.rule.includes("금지")) {
        assert.ok(dontBlock.includes(c.rule), `"${c.id}"는 금지를 포함하므로 Don't에 있어야 함`);
      } else {
        assert.ok(doBlock.includes(c.rule), `"${c.id}"는 Do에 있어야 함`);
      }
    }
  });
});

describe("Phase 5 — 디자인 MD 렌더러: schema §13 concept 기본 스케일 (v1.1.1 패치)", () => {
  it("schema-version이 1.1.1이다", () => {
    const instance = buildDesignMdInstance(baseOpts);
    assert.equal(instance.meta["schema-version"], "1.1.1");
  });

  it("rounded 스케일이 §13.1과 정확히 일치한다(none/xs/sm/md/lg/xl/full)", () => {
    const instance = buildDesignMdInstance(baseOpts);
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(instance.rounded)) values[k] = v.value;
    assert.deepEqual(values, {
      none: "0px",
      xs: "2px",
      sm: "4px",
      md: "8px",
      lg: "12px",
      xl: "16px",
      full: "9999px",
    });
  });

  it("typography 크기 슬롯이 §13.3과 정확히 일치한다", () => {
    const instance = buildDesignMdInstance(baseOpts);
    const s = instance.typography.slots;
    assert.deepEqual(
      { fontSize: s.body.fontSize, fontWeight: s.body.fontWeight, lineHeight: s.body.lineHeight, letterSpacing: s.body.letterSpacing },
      { fontSize: "16px", fontWeight: 400, lineHeight: 1.6, letterSpacing: 0 },
    );
    assert.equal(s.caption.fontSize, "14px"); // §13.3 하한
  });

  it("spacing.section은 domain에 따라 §13.2 표대로 분기하고, domain 생략 시 generic(40px)이다", () => {
    const noDomain = buildDesignMdInstance(baseOpts);
    assert.equal(noDomain.spacing.section.value, "40px");

    const cases: Array<[DomainHint, string]> = [
      ["marketing-web", "80px"],
      ["dashboard-ops", "40px"],
      ["mobile-app", "24px"],
      ["document", "80px"],
      ["generic", "40px"],
    ];
    for (const [domain, expected] of cases) {
      const instance = buildDesignMdInstance({ ...baseOpts, domain });
      assert.equal(instance.spacing.section.value, expected, `domain=${domain}`);
    }
  });

  it("spacing/rounded/typography 크기 슬롯의 known-gaps reason은 'schema §13 concept 기본 스케일 적용'으로 통일된다", () => {
    const instance = buildDesignMdInstance({ ...baseOpts, domain: "dashboard-ops" as DomainHint });
    const reasonFor = (category: string, type: string) =>
      instance["known-gaps"].find((g) => g.category === category && g.type === type)?.reason;

    assert.equal(
      reasonFor("spacing", `scale (${Object.keys(instance.spacing).join("/")})`),
      "schema §13 concept 기본 스케일 적용",
    );
    assert.equal(
      reasonFor("rounded", `scale (${Object.keys(instance.rounded).join("/")})`),
      "schema §13 concept 기본 스케일 적용",
    );
    for (const key of Object.keys(instance.typography.slots)) {
      assert.equal(reasonFor("typography", key), "schema §13 concept 기본 스케일 적용");
    }
  });

  it("family(폰트, §3.4 fallback)의 known-gaps reason은 §13 문구를 쓰지 않는다(적용 범위 밖)", () => {
    const instance = buildDesignMdInstance(baseOpts);
    const gap = instance["known-gaps"].find((g) => g.category === "typography" && g.type === "family.sans")!;
    assert.notEqual(gap.reason, "schema §13 concept 기본 스케일 적용");
  });
});

describe("Phase 5 — 디자인 MD 렌더러: frontmatter YAML 이스케이프(회귀 — 콜론/해시 프로젝트명 버그)", () => {
  it("이름에 콜론·해시가 있어도 frontmatter가 한 줄의 따옴표 스칼라로 안전하게 유지된다", () => {
    const md = renderDesignMd({ ...baseOpts, projectTitle: "고객사: 신규 #1" });
    const frontmatterBlock = md.split("\n---\n")[0];

    // 회귀 재현 조건: 이스케이프 없이 넣으면 "status:"가 두 번(문서 자체 + 이름 안의 텍스트) 나타났었음.
    const statusLines = frontmatterBlock.split("\n").filter((l) => l.startsWith("status:"));
    assert.equal(statusLines.length, 1, `status 키가 중복 생성됨: ${JSON.stringify(statusLines)}`);

    const nameLine = frontmatterBlock.split("\n").find((l) => l.startsWith("name:"))!;
    assert.match(nameLine, /^name: "고객사: 신규 #1 — .*"$/);
    assert.match(nameLine, /^name: ".*"$/); // 이중따옴표 스칼라 하나로 감싸짐(줄바꿈 없음)
  });

  it("이름에 따옴표·백슬래시가 있어도 유효한 이스케이프로 처리된다", () => {
    const md = renderDesignMd({ ...baseOpts, projectTitle: '괴상한 "이름" \\ 테스트' });
    const nameLine = md.split("\n").find((l) => l.startsWith("name:"))!;
    assert.equal(nameLine, `name: "괴상한 \\"이름\\" \\\\ 테스트 — ${optionA.label}"`);
  });

  it("이름에 줄바꿈이 있으면 리터럴 \\n으로 이스케이프되어 frontmatter가 한 줄을 유지한다", () => {
    const md = renderDesignMd({ ...baseOpts, projectTitle: "1행\n2행" });
    const frontmatterBlock = md.split("\n---\n")[0];
    const lines = frontmatterBlock.split("\n").filter((l) => l.startsWith("name:"));
    assert.equal(lines.length, 1, "이름의 줄바꿈이 frontmatter 줄 수를 늘리면 안 됨");
    assert.ok(lines[0].includes("\\n"));
  });
});

describe("Phase 5 — 디자인 MD 렌더러: hex 검증(회귀 — 잘못된 색이 AA 통과로 오판되던 버그)", () => {
  it("designBasis.palette에 잘못된 hex가 있으면 조용히 검은색으로 취급하지 않고 에러를 던진다", () => {
    const invalidOption = {
      ...optionA,
      designBasis: {
        ...optionA.designBasis,
        palette: { ...optionA.designBasis.palette, primary: "not-a-color" },
      },
    };
    assert.throws(
      () => buildDesignMdInstance({ ...baseOpts, option: invalidOption }),
      /유효하지 않은 hex/,
    );
  });

  it("유효한 3자리/6자리 hex(# 유무 무관)는 정상 처리된다", () => {
    const shortHexOption = {
      ...optionA,
      designBasis: {
        ...optionA.designBasis,
        palette: { ...optionA.designBasis.palette, primary: "#0af", accent: "0af" },
      },
    };
    const instance = buildDesignMdInstance({ ...baseOpts, option: shortHexOption });
    assert.equal(instance.colors.semantic.primary.value, "#0af");
  });
});
