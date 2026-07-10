import type { DirectiveScope, ProjectDirective } from "../analysis/types";

// 분석 프롬프트 (Step 7) — 입력은 항상 maskedText만 (보안 하드 게이트).

// 전역 지시 블록 (Step 8 + Step 15) — 이후 모든 Gemini 프롬프트에 주입한다.
// scope 인자 = 호출처 단계. 지시의 scope가 비어있으면 전체 적용,
// 지정돼 있으면 그 단계가 포함될 때만 주입된다 ("reference에만" 같은 세밀 제어).
export function buildDirectiveBlock(
  directives: ProjectDirective[] = [],
  scope?: DirectiveScope,
): string {
  const applicable = scope
    ? directives.filter(
        (d) => !d.scope || d.scope.length === 0 || d.scope.includes(scope),
      )
    : directives;
  if (applicable.length === 0) return "";
  const lines = applicable.map(
    (d) => `- ${d.text}${d.priority === "high" ? " (중요)" : ""}`,
  );
  return `\n## 전역 지시 (사용자 요청 — 모든 판단·산출물에 반드시 반영)\n${lines.join("\n")}\n`;
}

export function buildAnalysisPrompt(
  maskedText: string,
  keptTargets: string[] = [],
  directives: ProjectDirective[] = [],
  imageNotes: string[] = [], // 재마스킹 완료된 이미지 분석 요약만 (Step 9)
): string {
  const imageBlock =
    imageNotes.length > 0
      ? `\n## 이미지 분석 요약 (사용자 동의분, 마스킹됨 — 페이지·섹션 재구성에 참고)\n${imageNotes.map((n) => `- ${n}`).join("\n")}\n`
      : "";
  const targetNote =
    keptTargets.length > 0
      ? `\n다음 이름들은 사용자가 공개 엔티티(경쟁사·벤치마킹 브랜드 등)로 확정해 실명이 유지된 것이다: ${keptTargets.join(", ")}. 분석에 활용하라.`
      : "";

  return `당신은 시니어 프로덕트 디자이너다. 아래는 민감정보가 마스킹된 기획서 텍스트다.
[회사A], [이메일A] 같은 대괄호 토큰은 마스킹된 민감정보다. 토큰을 그대로 유지하고 실명을 추측·복원하지 마라.${targetNote}
${buildDirectiveBlock(directives, "analysis")}${imageBlock}

## 작업

1. 프로젝트 분석
- title: 프로젝트명 (토큰 유지)
- description: 한 줄 설명
- domain: "marketing-web" | "dashboard-ops" | "mobile-app" | "document" | "generic"
  (화면 생김새가 아니라 메뉴·기능의 "행위 성격" 기준으로 판정: 게시판·배너·회원 관리 등 CRUD 행위 → dashboard-ops(관리자), 통계·차트·모니터링 행위 → dashboard-ops(분석형), 브랜드 소개·전환 유도 → marketing-web, 제안서·소개서 문서 → document)
- domainConfidence: 0~1
- domainConfidenceReason: domain 판정 근거를 키워드 중심 짧은 문장으로 (예: "대시보드·통계·모니터링 키워드 다수 탐지")
- businessDomains: 이 프로젝트의 업무 영역/산업 도메인 배열 (예: ["스마트시티", "통합관제"], ["이커머스"], ["헬스케어", "금융"]). 프로젝트가 여러 업무 영역에 걸치면 전부 나열하고, 하나뿐이면 1개짜리 배열로. domain(화면 유형=화면의 행위 성격)과는 다른 축이다 — 겹치는 말을 반복하지 마라.
- targetUser, tags(3~8개)
- projectType: 산출물 형식 (예: 브로셔/제안서/피치덱/랜딩페이지/이벤트페이지/상세페이지/사용설명서). domain·businessDomains와 겹치지 않는, "이게 어떤 형태의 결과물인가" 축이다.
- brandColors: 문서에 "브랜드/로고/CI 컬러"로 명시된 hex만 포함하라. 배경·테마·다크모드·UI 컬러 시스템 설명(예: "배경은 #0f172a 계열")에만 등장하는 hex는 브랜드 컬러가 아니므로 포함하지 마라 — 대신 아래 explicitRequirements로 분류하라.
- explicitRequirements: 문서에 "명시적으로" 적힌 요구사항만 추출한다 (AI가 스스로 제안하는 recommendedLayout 등과는 다르다 — 오직 문서에 실제로 적힌 지시·설명만). 배경색 지정, "다크모드로 만들어주세요" 같은 모드 지정, "GNB는 좌측 고정" 같은 레이아웃 고정 요구를 감지하라. 각 항목 { "kind": "background-color"|"mode"|"layout"|"other", "text": string(원문 발췌/요약, 마스킹 토큰 유지), "value": string|null(background-color→hex, mode→"dark"|"light", 그 외는 null), "sourceSlides": number[] }. 없으면 빈 배열.

2. 구성 페이지 재구성 (중요)
- 슬라이드·장 구분과 1:1로 만들지 마라. 내용 기준으로 페이지를 재구성한다 (여러 슬라이드가 1페이지일 수도, 1슬라이드에 여러 섹션이 있을 수도 있다).
- 텍스트에 "--- 슬라이드 N ---" 마커가 있으면 각 페이지·섹션이 어느 슬라이드에서 왔는지 sourceSlides 배열(숫자)로 기록하라.
- pageRole: "cover" | "section-divider" | "content" | "case-study" | "metrics" | "team" | "appendix" | "contact"
- 문서에 화면ID/요구사항ID(예: RUC-UI-MAI, DBM-001, REQ-F-007 같은 코드)가 있으면 해당 페이지·섹션의 sourceDocumentId에 보존하라.

3. 각 페이지의 후보 섹션
- sectionTitle, contentSummary(본문 요약 — 마스킹 토큰 그대로 유지), contentType(예: hero/feature/history/business-model/pricing/team/data-table/chart-widget 등 자유), recommendedLayout(예: timeline/comparison-table/card-grid/hero/stat-band/flow-diagram 등 자유), confidence(0~1)
- contentTypeLabel, recommendedLayoutLabel: 위 contentType/recommendedLayout을 화면에 그대로 보여줄 짧은 한글 표시 라벨 (예: "technical-spec"→"기술 스펙", "color-palette"→"컬러 팔레트"). 원시 slug 값 자체는 절대 바꾸지 말고 이 표시용 필드만 추가로 채워라.
- 문서 안의 리뷰 코멘트("[김OO 9/25] 문구 확정 필요" 형태)는 삭제하지 말고 해당 섹션의 unresolvedNotes 배열에 보존하라.

4. existingContentVariants: 같은 화면/섹션이 "Main1/Main2/Main3"처럼 이미 N개 변형으로 존재하고 카피·톤·순서만 다르면 감지하라. 각 항목 { label, sourceSlides, contentSummary }. 없으면 빈 배열.

5. detectedCaseStudies: 문서 안에 이미 있는 사례분석/벤치마킹 섹션(브랜드·서비스 설명 + 출처)이 있으면 감지하라. 각 항목 { name, sourceSlides, extractedNote, sourceUrls }. 없으면 빈 배열.

6. parentSiteRelation: 이 문서가 "다른 사이트(부모/대민 사이트)를 관리하는 관리자·백오피스 화면"으로 보이면 감지하라. 단서: 게시판·배너·회원·콘텐츠 관리 메뉴가 특정 공개 사이트를 대상으로 함, "OO홈페이지 관리자" 같은 명칭, 대민 사이트의 GNB/LNB·컴포넌트 정책을 그대로 물려받은 구성. 감지되면 { "relationNote": "어떤 부모 사이트의 무엇을 관리하는지 1문장 (마스킹 토큰 유지)" }, 아니면 null.

## 출력
반드시 아래 형태의 JSON만 출력하라 (설명·마크다운 금지):
{
  "title": string, "description": string,
  "domain": string, "domainConfidence": number, "domainConfidenceReason": string,
  "businessDomains": string[],
  "targetUser": string, "projectType": string, "tags": string[],
  "brandColors": string[],
  "explicitRequirements": [{ "kind": string, "text": string, "value": string|null, "sourceSlides": number[] }],
  "pages": [{ "pageTitle": string, "pageRole": string, "sourceSlides": number[], "sourceDocumentId": string|null,
    "sections": [{ "sectionTitle": string, "contentSummary": string, "contentType": string, "recommendedLayout": string, "contentTypeLabel": string, "recommendedLayoutLabel": string, "sourceSlides": number[], "sourceDocumentId": string|null, "confidence": number, "unresolvedNotes": string[] }] }],
  "existingContentVariants": [{ "label": string, "sourceSlides": number[], "contentSummary": string }],
  "detectedCaseStudies": [{ "name": string, "sourceSlides": number[], "extractedNote": string, "sourceUrls": string[] }],
  "parentSiteRelation": { "relationNote": string } | null
}

## 기획서 텍스트
${maskedText}`;
}
