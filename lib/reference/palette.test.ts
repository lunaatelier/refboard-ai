import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  colorPool,
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
