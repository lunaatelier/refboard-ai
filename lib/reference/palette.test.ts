import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  colorPool,
  contrastRatio,
  generatePaletteOptions,
  hexToHsl,
  hslToHex,
} from "./palette";

describe("palette — 색 변환 유틸", () => {
  it("hex ↔ hsl 왕복 변환이 안정적이다", () => {
    for (const hex of ["#2563EB", "#FF0000", "#1C1F24", "#FFFFFF"]) {
      const hsl = hexToHsl(hex);
      assert.ok(hsl);
      const back = hslToHex(hsl!);
      // 반올림 오차 허용: 다시 변환해도 같은 값으로 수렴
      assert.equal(hslToHex(hexToHsl(back)!), back);
    }
  });

  it("잘못된 hex는 null", () => {
    assert.equal(hexToHsl("파랑"), null);
    assert.equal(hexToHsl("#12"), null);
  });
});

describe("palette — 3세트 생성 (Step 10-a)", () => {
  it("브랜드컬러 없으면 신뢰형/혁신형/미니멀형 3세트", () => {
    const opts = generatePaletteOptions();
    assert.equal(opts.length, 3);
    assert.deepEqual(
      opts.map((o) => o.optionId),
      ["trust", "innovation", "minimal"],
    );
  });

  it("각 세트는 light/dark 쌍을 가지며 7개 역할이 모두 채워진다", () => {
    for (const opt of generatePaletteOptions()) {
      for (const mode of ["light", "dark"] as const) {
        const p = opt[mode];
        assert.equal(p.mode, mode);
        for (const role of [
          "primary",
          "secondary",
          "accent",
          "background",
          "surface",
          "text",
          "navigation",
        ] as const) {
          assert.match(p[role], /^#[0-9A-F]{6}$/i);
        }
      }
    }
  });

  it("브랜드컬러가 있으면 그 색이 변주의 기준이 된다", () => {
    const opts = generatePaletteOptions(["#E91E63"]);
    assert.equal(opts.length, 3);
    assert.equal(opts[0].light.primary, "#E91E63"); // 충실형 = 브랜드색 그대로
    assert.equal(opts[2].light.accent, "#E91E63"); // 미니멀형 = 브랜드색 포인트
  });

  it("검정/회색 placeholder 브랜드컬러는 추천 기준에서 제외한다", () => {
    const opts = generatePaletteOptions(["#000000", "#777777"]);
    assert.deepEqual(
      opts.map((o) => o.optionId),
      ["trust", "innovation", "minimal"],
    );
  });

  it("무채색과 유채색이 함께 있으면 유채색을 기준으로 추천한다", () => {
    const opts = generatePaletteOptions(["#111111", "#0EA5E9"]);
    assert.equal(opts[0].light.primary, "#0EA5E9");
  });

  it("잘못된 브랜드컬러는 무시하고 기본 3세트로 폴백", () => {
    const opts = generatePaletteOptions(["파란색"]);
    assert.equal(opts[0].optionId, "trust");
  });

  it("colorPool은 중복 없는 색 풀을 준다", () => {
    const pool = colorPool(generatePaletteOptions()[0]);
    assert.equal(new Set(pool).size, pool.length);
    assert.ok(pool.length >= 7);
  });
});

describe("palette — 산출물 검증 (대비비·채도 하한, 그레이 팔레트 재발 방지)", () => {
  it("채도는 있지만 명도가 낮아 거의 검게 보이는 시드도 브랜드 충실형에서 눈에 띄는 색으로 보정된다", () => {
    // #0f172a: HSL s≈0.47, l≈0.11 — isUsableBrandColor는 통과하지만
    // 화면에서는 거의 검정/짙은 남색으로 보인다. 흰 배경 대비 대비비는
    // 원래도 높으므로(어두운 색일수록 대비비만으로는 못 잡는다) 명도 하한이
    // 실제로 원본 hex를 밀어 올렸는지까지 확인한다.
    const opts = generatePaletteOptions(["#0f172a"]);
    const faithful = opts.find((o) => o.optionId === "brand-faithful")!;
    assert.notEqual(faithful.light.primary, "#0F172A"); // 보정이 실제로 일어남
    const hsl = hexToHsl(faithful.light.primary)!;
    assert.ok(hsl.s >= 0.35, `채도 하한 미달: ${hsl.s}`);
    assert.ok(hsl.l >= 0.3, `명도 하한 미달: ${hsl.l}`);
    assert.ok(
      contrastRatio(faithful.light.primary, "#FFFFFF") >= 2.5,
      "배경 대비 대비비 미달",
    );
  });

  it("브랜드 미니멀형 primary는 의도된 저채도를 유지한다 (accent가 브랜드색 담당)", () => {
    const opts = generatePaletteOptions(["#0f172a"]);
    const minimal = opts.find((o) => o.optionId === "brand-minimal")!;
    const hsl = hexToHsl(minimal.light.primary)!;
    assert.ok(hsl.s < 0.35);
  });

  it("이미 기준을 만족하는 색은 원본 그대로 유지한다 (불필요한 보정 없음)", () => {
    const opts = generatePaletteOptions(["#E91E63"]);
    assert.equal(opts[0].light.primary, "#E91E63");
  });

  it("contrastRatio: 동일 색은 1, 흑백은 21에 가깝다", () => {
    assert.ok(Math.abs(contrastRatio("#FFFFFF", "#FFFFFF") - 1) < 0.001);
    assert.ok(contrastRatio("#000000", "#FFFFFF") > 20);
  });
});

describe("palette — 문서 명시 배경색 반영 (게이트 1 정정)", () => {
  it("backgroundOverride가 있으면 dark.background로 그 hex를 그대로 쓴다", () => {
    const opts = generatePaletteOptions(["#E91E63"], "#0f172a");
    for (const opt of opts) {
      assert.equal(opt.dark.background, "#0F172A");
    }
  });

  it("backgroundOverride가 없으면 기존 합성 DARK_BG를 그대로 쓴다 (회귀 방지)", () => {
    const opts = generatePaletteOptions(["#E91E63"]);
    assert.equal(opts[0].dark.background, "#0F1115");
  });

  it("문서 명시 배경 위의 primary는 AA 텍스트 기준(4.5:1) 이상을 확보한다", () => {
    const opts = generatePaletteOptions(["#E91E63"], "#0f172a");
    for (const opt of opts) {
      assert.ok(
        contrastRatio(opt.dark.primary, opt.dark.background) >= 4.5,
        `${opt.optionId}: 대비비 부족 (${contrastRatio(opt.dark.primary, opt.dark.background)})`,
      );
    }
  });

  it("브랜드컬러가 없어도(기본 3세트) backgroundOverride는 반영된다", () => {
    const opts = generatePaletteOptions([], "#0f172a");
    assert.deepEqual(
      opts.map((o) => o.optionId),
      ["trust", "innovation", "minimal"],
    );
    for (const opt of opts) {
      assert.equal(opt.dark.background, "#0F172A");
    }
  });

  it("잘못된 backgroundOverride는 무시하고 기본 DARK_BG로 폴백", () => {
    const opts = generatePaletteOptions(["#E91E63"], "회색이요");
    assert.equal(opts[0].dark.background, "#0F1115");
  });
});
