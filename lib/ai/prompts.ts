// 분석 프롬프트 (Step 7) — 입력은 항상 maskedText만 (보안 하드 게이트).

export function buildAnalysisPrompt(
  maskedText: string,
  keptTargets: string[] = [],
): string {
  const targetNote =
    keptTargets.length > 0
      ? `\n다음 이름들은 사용자가 공개 엔티티(경쟁사·벤치마킹 브랜드 등)로 확정해 실명이 유지된 것이다: ${keptTargets.join(", ")}. 분석에 활용하라.`
      : "";

  return `당신은 시니어 프로덕트 디자이너다. 아래는 민감정보가 마스킹된 기획서 텍스트다.
[회사A], [이메일A] 같은 대괄호 토큰은 마스킹된 민감정보다. 토큰을 그대로 유지하고 실명을 추측·복원하지 마라.${targetNote}

## 작업

1. 프로젝트 분석
- title: 프로젝트명 (토큰 유지)
- description: 한 줄 설명
- domain: "marketing-web" | "dashboard-ops" | "mobile-app" | "document" | "generic"
  (화면 생김새가 아니라 메뉴·기능의 "행위 성격" 기준으로 판정: 게시판·배너·회원 관리 등 CRUD 행위 → dashboard-ops(관리자), 통계·차트·모니터링 행위 → dashboard-ops(분석형), 브랜드 소개·전환 유도 → marketing-web, 제안서·소개서 문서 → document)
- domainConfidence: 0~1
- targetUser, projectType(브로셔/홈페이지/관리자/대시보드/앱 등), tags(3~8개)
- brandColors: 문서에 브랜드 컬러 언급이 있을 때만 hex 배열

2. 구성 페이지 재구성 (중요)
- 슬라이드·장 구분과 1:1로 만들지 마라. 내용 기준으로 페이지를 재구성한다 (여러 슬라이드가 1페이지일 수도, 1슬라이드에 여러 섹션이 있을 수도 있다).
- 텍스트에 "--- 슬라이드 N ---" 마커가 있으면 각 페이지·섹션이 어느 슬라이드에서 왔는지 sourceSlides 배열(숫자)로 기록하라.
- pageRole: "cover" | "section-divider" | "content" | "case-study" | "metrics" | "team" | "appendix" | "contact"
- 문서에 화면ID/요구사항ID(예: RUC-UI-MAI, DBM-001, REQ-F-007 같은 코드)가 있으면 해당 페이지·섹션의 sourceDocumentId에 보존하라.

3. 각 페이지의 후보 섹션
- sectionTitle, contentSummary(본문 요약 — 마스킹 토큰 그대로 유지), contentType(예: hero/feature/history/business-model/pricing/team/data-table/chart-widget 등 자유), recommendedLayout(예: timeline/comparison-table/card-grid/hero/stat-band/flow-diagram 등 자유), confidence(0~1)
- 문서 안의 리뷰 코멘트("[김OO 9/25] 문구 확정 필요" 형태)는 삭제하지 말고 해당 섹션의 unresolvedNotes 배열에 보존하라.

4. existingContentVariants: 같은 화면/섹션이 "Main1/Main2/Main3"처럼 이미 N개 변형으로 존재하고 카피·톤·순서만 다르면 감지하라. 각 항목 { label, sourceSlides, contentSummary }. 없으면 빈 배열.

5. detectedCaseStudies: 문서 안에 이미 있는 사례분석/벤치마킹 섹션(브랜드·서비스 설명 + 출처)이 있으면 감지하라. 각 항목 { name, sourceSlides, extractedNote, sourceUrls }. 없으면 빈 배열.

## 출력
반드시 아래 형태의 JSON만 출력하라 (설명·마크다운 금지):
{
  "title": string, "description": string,
  "domain": string, "domainConfidence": number,
  "targetUser": string, "projectType": string, "tags": string[],
  "brandColors": string[],
  "pages": [{ "pageTitle": string, "pageRole": string, "sourceSlides": number[], "sourceDocumentId": string|null,
    "sections": [{ "sectionTitle": string, "contentSummary": string, "contentType": string, "recommendedLayout": string, "sourceSlides": number[], "sourceDocumentId": string|null, "confidence": number, "unresolvedNotes": string[] }] }],
  "existingContentVariants": [{ "label": string, "sourceSlides": number[], "contentSummary": string }],
  "detectedCaseStudies": [{ "name": string, "sourceSlides": number[], "extractedNote": string, "sourceUrls": string[] }]
}

## 기획서 텍스트
${maskedText}`;
}
