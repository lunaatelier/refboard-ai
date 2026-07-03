import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeAnalysis } from "../analysis/normalize";
import {
  buildHintSkeletons,
  decideDirection,
  recommendRepresentativePages,
} from "./imageHints";
import type { MoodOption } from "./types";

const mood = (label: string, keywords: string[]): MoodOption => ({
  id: "m",
  label,
  keywords,
  description: "",
  imageQuery: "",
  styleAttributes: {
    radius: "soft",
    density: "airy",
    contrast: "soft",
    typographyNote: "",
  },
});

const docAnalysis = normalizeAnalysis({
  title: "[고객사A] 회사소개서",
  domain: "document",
  pages: [
    {
      pageTitle: "표지",
      pageRole: "cover",
      sections: [{ sectionTitle: "표지", contentType: "hero", recommendedLayout: "hero", contentSummary: "표지" }],
    },
    {
      pageTitle: "ESG 사업영역",
      pageRole: "content",
      sections: [
        { sectionTitle: "사업영역", contentType: "feature", recommendedLayout: "card-grid", contentSummary: "3개 사업" },
        { sectionTitle: "비전", contentType: "vision", recommendedLayout: "hero", contentSummary: "비전" },
      ],
    },
    {
      pageTitle: "성과 지표",
      pageRole: "metrics",
      sections: [{ sectionTitle: "지표", contentType: "metrics", recommendedLayout: "stat-band", contentSummary: "지표" }],
    },
  ],
});

describe("Step 11 — 방향 판정 (도메인+무드)", () => {
  it("혁신 무드 → 3D 렌더", () => {
    assert.equal(
      decideDirection("marketing-web", [], mood("그린 이노베이션", ["혁신적인", "미래지향적인"])),
      "3D 렌더",
    );
  });
  it("미니멀 무드 → 라인 일러스트", () => {
    assert.equal(
      decideDirection("marketing-web", [], mood("미니멀", ["절제된", "여백"])),
      "라인 일러스트",
    );
  });
  it("B2B 태그 → 미니멀 3D", () => {
    assert.equal(decideDirection("marketing-web", ["B2B", "친환경"]), "미니멀 3D");
  });
});

describe("Step 11 — 힌트 스켈레톤 (scale 구분)", () => {
  it("표지=hero, 비전 섹션=section, 사업영역 카드=icon", () => {
    const sk = buildHintSkeletons(docAnalysis);
    assert.equal(sk[0].area, "표지 키비주얼");
    assert.equal(sk[0].scale, "hero");
    assert.equal(sk[0].aspectRatio, "16:9");
    const vision = sk.find((s) => s.area.includes("비전"));
    assert.equal(vision?.scale, "section");
    const feature = sk.find((s) => s.area.includes("사업영역"));
    assert.equal(feature?.scale, "icon");
    assert.equal(feature?.aspectRatio, "1:1");
  });
});

describe("Step 11 — 대표 페이지 추천 (표지 ≠ 대표)", () => {
  it("문서형: 시각 대표=cover, 내용 대표=metrics (cover 아님)", () => {
    const rep = recommendRepresentativePages(docAnalysis);
    const visual = docAnalysis.pages.find((p) => p.pageId === rep.visualPageId);
    const content = docAnalysis.pages.find((p) => p.pageId === rep.contentPageId);
    assert.equal(visual?.pageRole, "cover");
    assert.equal(content?.pageRole, "metrics");
    assert.notEqual(rep.visualPageId, rep.contentPageId);
  });

  it("cover가 없으면 첫 페이지가 시각 대표", () => {
    const a = normalizeAnalysis({
      domain: "marketing-web",
      pages: [
        { pageTitle: "메인", pageRole: "content", sections: [] },
        { pageTitle: "소개", pageRole: "content", sections: [{}, {}] },
      ],
    });
    const rep = recommendRepresentativePages(a);
    assert.equal(rep.visualPageId, "p1");
    assert.equal(rep.contentPageId, "p1");
  });
});
