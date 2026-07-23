import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractPptxText } from "../parse/pptx";
import {
  SAMPLE_AUTHOR_NAME,
  SAMPLE_AUTHOR_TEAM,
  SAMPLE_COMPANY_EMAIL,
  SAMPLE_COMPANY_PHONE,
  buildSampleReviewPptx,
} from "../parse/fixtures/samplePptx";
import { createMaskingReviewSummary, finalizeMask } from "./apply";
import { detect } from "./detect";

// 대표 흐름 1개(P2.1) — 합성 pptx 파싱 → 탐지 → 검수 중 요약 계산 → 확정까지
// 로직 계층에서 한 번에 검증한다. "화면에 뭐가 보이는지"는 MaskingReview.test.tsx가,
// "이 로직이 실제로 문서를 끝까지 처리하는지"는 여기서 담당(역할 분리).

describe("마스킹 검수 대표 흐름 — 합성 PPT 파싱부터 확정까지", () => {
  it("이메일·전화·작성자/소속이 전부 탐지되고, 검수 중 요약과 확정 결과가 일치한다", async () => {
    const data = await buildSampleReviewPptx();
    const { text, labeledEntities } = await extractPptxText(data);

    const detections = detect(text, [], labeledEntities);

    const emailDetection = detections.find((d) => d.raw === SAMPLE_COMPANY_EMAIL);
    const phoneDetection = detections.find((d) => d.raw === SAMPLE_COMPANY_PHONE);
    const authorDetection = detections.find((d) => d.raw === SAMPLE_AUTHOR_NAME);
    const teamDetection = detections.find((d) => d.raw === SAMPLE_AUTHOR_TEAM);
    assert.ok(emailDetection, "이메일이 탐지되어야 한다");
    assert.ok(phoneDetection, "전화번호가 탐지되어야 한다");
    assert.ok(authorDetection, "작성자 이름이 표 헤더 라벨로 탐지되어야 한다");
    assert.ok(teamDetection, "소속이 표 헤더 라벨로 탐지되어야 한다");
    assert.equal(authorDetection?.kind, "personName");
    assert.equal(teamDetection?.kind, "company");

    // 검수 중(확정 전) 요약 — 아직 아무것도 해제하지 않았으므로 탐지된 만큼 전부 적용 예정.
    const { summary: liveSummary, contextByKey } = createMaskingReviewSummary(
      text,
      detections,
    );
    const totalDetected = liveSummary.reduce((sum, g) => sum + g.totalCount, 0);
    const totalApplied = liveSummary.reduce((sum, g) => sum + g.appliedCount, 0);
    assert.equal(totalDetected, detections.length);
    assert.equal(totalApplied, detections.length);

    // 항목별 위치 정보 — 이메일 항목은 슬라이드 2, 작성자는 슬라이드 3에 있어야 한다.
    const emailCtxKey = `${emailDetection!.kind}::${emailDetection!.raw}`;
    const authorCtxKey = `${authorDetection!.kind}::${authorDetection!.raw}`;
    assert.equal(contextByKey[emailCtxKey]?.slide, 2);
    assert.equal(contextByKey[authorCtxKey]?.slide, 3);
    // 마스킹된 문맥에는 실명 조각이 아니라 토큰만 있어야 한다(민감정보 미노출).
    assert.ok(!contextByKey[emailCtxKey]?.maskedExcerpt?.includes(SAMPLE_COMPANY_EMAIL));

    // 확정 — 전부 토큰으로 치환되고, mappings로 실명이 복원 가능해야 한다.
    const { maskedText, mappings } = finalizeMask(text, detections);
    assert.ok(!maskedText.includes(SAMPLE_COMPANY_EMAIL));
    assert.ok(!maskedText.includes(SAMPLE_COMPANY_PHONE));
    assert.ok(!maskedText.includes(SAMPLE_AUTHOR_NAME));
    assert.ok(!maskedText.includes(SAMPLE_AUTHOR_TEAM));
    const emailMapping = mappings.find((m) => m.raw === SAMPLE_COMPANY_EMAIL);
    assert.ok(emailMapping, "이메일 복원 매핑이 있어야 한다");
    assert.ok(maskedText.includes(emailMapping!.token));
  });
});
