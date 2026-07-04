# 제품 A — 순차 구현 스텝 (Claude Code 실행용)

> 목적: 한 번에 다 구현하면 토큰 초과·중단 위험이 크다. 독립 완결 스텝으로 나눈다.
> 각 스텝은 중단돼도 다음 세션에서 이어갈 수 있다.

## 분할 원칙 (모든 스텝이 3종 세트를 가짐)

각 스텝은 반드시 아래 3개를 같이 가져간다:
1. **명세 수정** — 이번 스텝에 필요한 문서만 최소 수정
2. **구현 단위** — UI/API/타입 중 필요한 만큼만
3. **확인 시나리오** — 샘플 하나로 "끝났다"를 확인

## 실행 원칙 (Claude Code에게)

- 한 번에 한 스텝만. 건너뛰거나 합치지 않는다.
- 시작 시 "선행" 확인. 끝에 "확인 시나리오"를 만족해야 다음으로.
- **타입은 그 기능을 만드는 스텝에서 추가.** 앞에서 미리 전체 타입을 만들지 않는다.
- 반쪽 상태로 끝내지 않는다. 막히면 그 스텝 안에서 해결, 안 되면 중단·보고. 다음 스텝으로 도망가지 않는다.

## 순서 원칙 (한 줄)

```
보안 경계 → 텍스트 업로드/마스킹 → 엔티티/수치 확장 → 분석 계보
→ 이미지 opt-in → 레퍼런스/컨셉/출력
```

이미지 분석은 **뒤로 미룬다.** 텍스트 기반 보안 경로를 먼저 완성하고 이미지 opt-in을 붙인다.
먼저 넣으면 Phase 1이 비대해지고, 중단 시 보안 경계가 애매하게 남는다.

---

## Step 1. 문서 충돌 정리 (구현 없음)

- **명세 수정:** CLAUDE.md ↔ flow-spec 충돌 4건 정리
  - 분석 대상 브랜드(경쟁사 등) 실명 유지 예외 → 보안 정책에 정식 반영(별도 민감도 등급 "사용자 확인 후 외부 전송 가능")
  - 이미지 = opt-in, 기본값 "텍스트만" 명시
  - Phase 1 업로드 범위 = txt/md/pdf/pptx로 고정(링크/이미지/클립보드는 후속)
  - NVIDIA 이미지 생성 = 후순위/선택. `.env`엔 주석만
- **구현:** 없음
- **확인 시나리오:** 다음 사람이 CLAUDE.md·flow-spec·data-model을 읽어도 위 4건에서 모순이 없다.

---

## Step 2. 워크스페이스 셸 + 단계 가드

- **명세 수정:** phase1-masking-spec §8(셸) 확인. data-model §2(WorkflowState/Step/canAccessStep).
- **구현:** 랜딩/워크스페이스 모드, LNB 스텝퍼(완료/현재/잠김), 같은 페이지 상태 전환, 재방문. 실제 분석 없음(더미 상태).
- **확인 시나리오:** 더미 상태로 단계 접근이 맞게 막힌다(마스킹 안 하면 분석 잠김). 완료 단계 재방문 가능.

---

## Step 3. 마스킹 코어 v1

- **명세 수정:** phase1-masking-spec §2~5. data-model §3.
  - `DraftMaskResult`(detections+raw 있음) / `FinalMaskResult`(maskedText+mappings만, raw 없음) 분리 정의.
  - `AnalysisTargetKind`(competitor/benchmarkBrand/roleModel/investor/partner/publicReference)는 **타입만 선언**(구현은 Step 6).
  - **실사용 검증 반영(10문서 테스트):** `SensitiveKind`에 personName/businessRegNo/certificationNo/address 4종 추가(§3). `DummyPatternRule`/`UrlMaskingRule` 타입 선언(구현은 아래). 파일명도 `detect()` 대상(`UploadedFileMeta`).
- **구현:** `lib/masking/` 순수 함수 — email/phone/url/ip/apikey/rrn 규칙, detect, apply, restore. UI 없어도 됨.
  - 더미 패턴(010-0000-XXXX, none@/noreply@, 순차적 사업자번호) → `dummyConfidence: "likely-dummy"` 태깅.
  - 원본 파일명도 detect() 통과, `displayName`(마스킹된 표시명) 생성.
- **확인 시나리오:** 순수 함수 테스트 — 이메일·전화·URL 섞인 텍스트에서 전량 탐지·치환, 같은 실명=같은 토큰, 서버/클라 동일 결과. `010-0000-1234` 넣으면 `likely-dummy` 태깅됨. 파일명 `"...전형진.pptx"` → `UploadedFileMeta.originalFileName`이 노출 안 되고 `displayName`만 화면에 뜸.

---

## Step 4. txt/md 업로드 + 마스킹 검수 완결  ★ Phase 1 Safe MVP

- **명세 수정:** phase1-masking-spec §7.1(브라우저 파싱), §8.3(검수 흐름).
- **구현:** 브라우저 파싱(txt/md) → 탐지 리스트 → 사용자 해제/추가 → 확정 → parsedText 폐기.
  - **회사명 가림/유지 이분법(B-1):** 검수에서 회사명 항목에 "가림(기본)" / "유지(분석 대상 브랜드·참고)" 토글.
    유지로 태깅된 것만 실명 외부 전송 허용. 세부 6종 라벨은 Step 6에서 확장(지금은 2분).
  - 확정 시 Draft→Final 변환, mappings→SecureClientMemory.
  - **실사용 검증 반영:** 더미 추정(`likely-dummy`) 항목은 검수 리스트에서 기본 미체크로 표시(#13/#29). 인명 탐지 시 사전에 `person`(전역) 카테고리로 등록 옵션 제공(#3/#5/#27).
- **확인 시나리오:** 회사명·이메일 섞인 txt 업로드 → 탐지 → "분석 대상 브랜드 유지" 하나 풀고 확정 → 마스킹본 미리보기, 네트워크에 실명·mappings 없음, parsedText 폐기됨.

> **★ 여기까지 = Phase 1 Safe MVP.** 가장 안전한 경로(txt/md) 하나가 완전히 동작. 첫 배포 가능 지점.
> (`phase1-masking-spec.md` §0 참조: Safe MVP = Step 4까지 / File Upload Complete = Step 5까지)
> 이후는 순차 확장이며, 각 확장은 이 안전 경로를 깨지 않는다.

---

## Step 5. pdf/pptx 서버 파싱 (텍스트만)  ★ Phase 1 File Upload Complete

- **명세 수정:** phase1-masking-spec §7.2(서버 파싱).
- **구현:** `/api/parse` — pdf/pptx 텍스트 추출(메모리·무저장). 이미지 분석은 하지 않음(텍스트만).
- **확인 시나리오:** PPT 업로드 → 텍스트만 추출되어 마스킹 검수로 진입. 로그·디스크에 원문 없음.

---

## Step 6. 분석 대상 엔티티 + 민감 수치 마스킹

- **명세 수정:** data-model §3 확장. flow-spec ② 보강.
  - 엔티티 라벨 6종 활성화(Step 3의 타입을 실제 태깅으로): customer/investor/partner/benchmarkBrand/competitor/publicReference. 각 항목 외부전송 허용/가림을 사용자 확정.
  - `SensitiveKind`에 financialMetric/businessMetric/internalKpi 추가.
  - `NumericMaskingMode`(exact-mask/range-generalize/keep) + `NumericDetection`.
    기본: 투자금·매출·ARR·영업이익=exact / 고객수·사용자수·성장률=range / 공개 확정 시만 keep.
  - **명세에 박기:** "숫자 지표는 후보 탐지이며, 최종 민감 여부·마스킹 방식은 사용자 검수로 확정."
  - **실사용 검증 반영:** `businessRegNo`/`certificationNo`/`address` 3종 추가(사전 보조 탐지 필요, phase1-spec §3 참조). `UrlMaskingRule` 구현(benchmarkBrand 도메인=유지후보, 사내협업툴=가림확정). 표 형태 재무데이터는 행/열 단위 `NumericDetection` 다건 생성. **법정 의무고지 정보**(개인정보 보호책임자 성명·연락처 등 개인정보처리방침 페이지의 필수 공개항목)는 `Detection.isLegallyRequiredDisclosure`로 태깅 — Gemini 전송 시 가림은 동일하되, 최종 산출물엔 "[담당자명] — 직접 입력 필요" 자리로 별도 표시(AI가 임의 생성 금지).
- **구현:** 검수 UI에 엔티티 라벨 드롭다운 + 수치 모드 토글.
- **확인 시나리오:** "그린테크(customer)/네이버D2SF(investor)/파타고니아(benchmarkBrand)/누적 투자금 35억" 샘플 → 그린테크 가림, 파타고니아 유지, 35억이 "수십억 원대"(range) 또는 [투자금A](exact)로 처리, 사용자가 모드 변경 가능. 사업자등록번호·인증번호·주소 샘플 입력 시 탐지됨. 파타고니아 URL은 유지후보, atlassian.net URL은 가림확정.

---

## Step 7. PPT 슬라이드 계보 + 페이지 재구성 분석

- **명세 수정:** data-model §4. 이 기능 직전에 추가:
  - `Page.pageRole`(cover/section-divider/content/case-study/metrics/team/appendix/contact), `Page.sourceSlides?`, `Section.sourceSlides?/confidence?`.
  - `ExclusionReason`(sensitive/out-of-scope/low-priority/duplicate/quality-issue/user-choice/other), `Page.excludedReason?/excludedNote?`.
  - **실사용 검증 반영:** `Page/Section.sourceDocumentId?`(문서 자체 화면ID·요구사항ID 매핑), `Section.unresolvedNotes?`(리뷰코멘트=미결이슈 보존), 문서 내 기존 콘텐츠변형(`existingContentVariants`)·기존 사례분석(`detectedCaseStudies`) 감지 로직(flow-spec ③ 참조).
- **구현:** Gemini 분석 호출(`lib/ai/client.ts` 한 곳에 모음). 슬라이드→내용 기반 페이지 재구성(1:1 매핑 금지). 페이지 선택/제외 시 사유 드롭다운.
  - **제외 = 차단 조건:** 이후 프롬프트에 "Excluded pages must not be used as source material. Reason: ..." 명시.
- **확인 시나리오:** 슬라이드 10개 PPT → 페이지 7개로 재구성, 각 페이지에 sourceSlides 기록. 투자정보 페이지 제외 → 이후 분석/컨셉 프롬프트에 안 들어감. 화면ID(RUC-UI-MAI 등)가 있는 문서는 sourceDocumentId로 매핑. "Main1/2/3" 같은 기존변형이 있으면 감지·제안됨.

---

## Step 8. 전역 지시 전파

- **명세 수정:** data-model §4. `ProjectDirective { text; scope?; priority? }` — 지금은 text만, scope/priority는 optional 필드만 열어둠(기본 전체 적용).
  - **실사용 검증 반영:** 문서 업로드 직후 `documentPurpose` 판정(project-brief/company-profile/template-only, flow-spec ① 참조) 로직을 이 스텝에서 함께 구현 — 판정 결과가 이후 분석·레퍼런스 흐름에 영향(경량경로·과잉마스킹방지 등).
- **구현:** 분석 단계 "추가 요청사항" 입력 → directive 저장 → 이후 모든 Gemini 호출 프롬프트에 주입. 업로드 직후 문서 성격 판정 후 안내(회사소개서 경고/템플릿 경량경로 제안).
- **확인 시나리오:** "ESG 강조" 입력 → 분석 결과, 레퍼런스 검색어, 컨셉 방향에 모두 반영/유지됨. 회사소개서 업로드 시 경고 표출, 표지·목차뿐인 템플릿 업로드 시 경량경로 제안.

---

## Step 9. 이미지 opt-in 분석 경로

- 선행: Step 4(텍스트 경로 완결), Step 7
- **명세 수정:** data-model. `ImageAsset { assetId; sourceSlide?; selectedForAnalysis; excludedReason?; excludedNote?; sensitivityHint }`, `imageConsent`.
- **구현:** 이미지 목록/썸네일/제외 사유/명시적 동의 → 동의분만 멀티모달. **기본값=텍스트만.**
  - **응답 재마스킹(중요):** 멀티모달 응답을 저장 전 마스킹 엔진 한 번 더 통과. 저장은 항상 masked 기준.
  - **실사용 검증#10(최고위험):** 목업 화면의 "예시 데이터"(로그인/신청서 등)에 실제 개인정보가 더미인 척 섞여있는 경우가 실제로 발견됨. 이미지뿐 아니라 텍스트 추출 단계(Step 3/6)의 탐지 규칙이 "이건 예시 화면이니 괜찮겠지"라고 넘어가지 않도록, 문서 종류와 무관하게 탐지 규칙을 항상 전체 적용한다(화면 목업이라고 탐지를 느슨하게 하지 않음). 더미 확신도(`dummyConfidence`)가 명확한 패턴(§Step3)만 자동 제외 후보, 나머지는 전부 검수 대상.
  - OCR 선마스킹은 후순위(안 함).
- **확인 시나리오:** 로고 포함 이미지 → 경고 → 1장 제외하고 동의 → 동의분만 전송. 응답에 "GreenTech" 재등장해도 저장 전 재마스킹돼 실명 유입 없음. 제외 이미지는 AI 입력에 안 들어감. "전문위원 신청" 같은 목업 예시 데이터의 실제 연락처가 더미로 오인되지 않고 탐지됨.

---

## Step 10. 레퍼런스·무드 구조 재편

- **명세 수정:** data-model §5 재편.
  ```
  interface ReferenceResult {
    globalMood: MoodBoard;
    selectedPalette: Palette;
    paletteOptions: PaletteOption[];
    adoptedAnalysisTargets: AnalysisTargetAnalysis[];
    analysisTargetList: AnalysisTargetListItem[];
    bySectionId: Record<string, SectionReference>;
  }
  ```
  - 팔레트/무드는 프로젝트 전체(위로), 섹션별은 bySectionId.
  - 분석 대상 브랜드, 문서형 레퍼런스, `ReferenceItem { usage: "inspiration-only"|"embeddable"; sourceUrl; licenseNote }`.
  - **실사용 검증 반영(우선순위 최상):** 레퍼런스/도메인 판정을 "화면 시각 스타일"이 아니라 "메뉴 행위 성격"(CRUD관리 vs 분석·모니터링) 기준으로. `parentSiteRelation?`(부모-자식 사이트 감지). 회사소개서 등 공개 마케팅 문서에서는 회사명 마스킹 기본값을 "유지후보"로 전환.
- **구현:** 팔레트(3세트→역할매핑 편집, 다크/라이트), 무드보드(도메인 분기+스킨프리뷰), 섹션 레퍼런스(아코디언+플랫폼 칩), 분석 대상 브랜드(2단계: 15~20개→깊게, 분석≠채택, 캐시). ④ 페이지는 탭+아코디언+그리드로 스크롤 최소화.
- **확인 시나리오:** 팔레트가 섹션마다 흩어지지 않고 프로젝트 전체에 1개. 분석 대상 브랜드 목록→선택→깊은분석→채택 동작. 스크롤이 과하지 않음. "관리자페이지인데 대민 UI 재사용" 샘플에서 CMS 관리자 레퍼런스가 붙음(공공기관 홈페이지 레퍼런스 아님).

---

## Step 11. 이미지 힌트 스케일 + 문서형 대표 페이지

- **명세 수정:** data-model. `ImageHint { area; scale: "hero"|"section"|"icon"; prompt; direction; aspectRatio? }`. Concept 쪽에 `visualRepresentativePageId`(cover) / `contentRepresentativePageId`(content/metrics).
  - **실사용 검증 반영:** `ImageHint.sourceReferenceMode`("use-source-image"|"text-only-ignore-source") 추가 — 제안서 템플릿처럼 원본 이미지를 참고하면 안 되는 경우 대응.
- **구현:** 도메인+무드로 타입·스케일 판정, 프롬프트 표출(실제 생성은 후순위 S).
  - 대표 페이지 추천: 문서형은 content/metrics(신뢰도 높은)로, cover는 키비주얼 대표로만.
  - `documentPurpose === "template-only"`면 `sourceReferenceMode`를 "text-only-ignore-source"로 기본 제안.
- **확인 시나리오:** 표지=hero, ESG/사업영역=content 대표로 추천. 이미지 힌트에 scale 구분 표시. 템플릿 요청 문서 업로드 시 원본 이미지 무시하고 사업명 텍스트만으로 프롬프트 생성.

---

## Step 12. 컨셉 3안 + 출력 프리셋

- **명세 수정:** data-model §6. `OutputPreset`(summary/proposal/detailed), `OutputConfig { preset; includeMaskedContent; includeReferenceRationale; includeSectionMapping; includeSubPages }`, `ConceptOutputSelection`.
  - **실사용 검증 반영:** `ConceptOption.platforms?`(web/mobile 별도 세트, 웹+모바일 동시 요구 대응). Step 7에서 감지한 `existingContentVariants`가 있으면 AI가 3안을 새로 만들지 않고 기존 변형을 1:1로 매핑.
- **구현:** Concept JSON 3안(도메인별 차별화 축, 대표 2종 분리) → 3안 비교 UI → 렌더러(HTML/PPT/PDF, 클라이언트). 프리셋별 밀도.
  - 요약형: 3안 비교+대표페이지 / 제안형: 3안+표지·대표·선택서브 / 상세형: 섹션 매핑·근거·이미지힌트까지.
- **확인 시나리오:** 3안이 비대해지지 않고, 선택 페이지 구성대로 프리셋별 PPT/PDF/HTML 프리뷰가 나옴. JSON에 실명 없음. "Main1/2/3 이미 있는" 문서에서 컨셉 3안이 그 3개를 기반으로 생성됨(무시하고 새로 안 만듦). 웹+모바일 요구 문서에서 platforms 별도 생성.

---

## Step 13. 재활용 모드

- 선행: Step 9, Step 12
- **명세 수정:** data-model. `sourceType: "raw-document"|"analysis-json"`, 가드 확장(analysis-json이면 reference 접근 허용).
- **구현:** 분석 JSON 저장/불러오기. 3모드 구분:
  - 일반(원본 시작, 실명본 가능) / 재활용(JSON 시작, 마스킹본만) / 같은세션 재활용(mappings 메모리 있으면 실명본 가능).
- **확인 시나리오:** 저장→재업로드→reference 직행. 다운로드 버튼에 마스킹본/실명본 가능 여부가 정확히 표시.

---

## 마일스톤

```
Step 4 완료 = Phase 1 Safe MVP (txt/md 안전 경로), 첫 배포 가능
Step 5 완료 = Phase 1 File Upload Complete (+pdf/pptx)
Step 6 완료 = 마스킹 완성형 (엔티티·수치까지)
Step 9 완료 = 보안 경계 완결 (텍스트+이미지 opt-in)
Step 12 완료 = 제품 A 핵심 완성 (컨셉·출력까지)
Step 13 완료 = 재활용까지 = 제품 A v1.0
```

## 후순위 구현 스텝 (Step 14~19) — v1.0 이후 착수

기존 "후순위 (지금 안 함)" 목록을 정식 스텝으로 전환. 순서 근거: 의존성 낮고 준비물 없는 것부터, 키 발급이 필요한 NVIDIA는 마지막.

### Step 14. 복원키 파일 내보내기/가져오기 (클라 전용)
- **명세 수정:** data-model(§2 재활용 4구분 + `RecoveryKeyExport`), CLAUDE.md §4.4(명시 액션 예외).
- **구현:** `lib/state/recoveryKey.ts`(빌드/파싱 순수 함수). 내보내기 버튼(마스킹 확정 화면·분석 JSON 저장 옆, 같은 `exportId` 공유). 재활용 모드에서 가져오기 → `exportId` 짝 검증 후 mappings 복구. 전 과정 서버 미접촉.
- **확인 시나리오:** 마스킹 확정 → 복원키 저장 + 분석 JSON 저장 → 새로고침 → 분석 JSON 재업로드(마스킹본만 경고) → 복원키 가져오기 → 실명본 다운로드 가능. 다른 문서의 복원키는 거부된다.

### Step 15. 지시별 세밀 scope UI + 프롬프트 scope 필터링
- **명세 수정:** flow-spec 지시 입력 절 — 복수 지시 + scope/priority 편집.
- **구현:** `ProjectDirective.scope/priority`(타입 기존)를 실제 사용. 지시 목록 UI(추가/삭제/scope 선택), `buildDirectiveBlock` 호출부별 scope 필터(analysis/reference/mood/concept/output).
- **확인 시나리오:** "reference에만" 지시가 분석 프롬프트에는 안 들어가고 레퍼런스 프롬프트에만 들어간다.

### Step 16. 확장 입력 A — 단일 이미지 업로드 + 클립보드 붙여넣기
- **명세 수정:** CLAUDE.md §4.2.1 Phase 1.5 착수 표기, flow-spec ① 확장 입력.
- **구현:** png/jpg/gif 업로드 + `paste` 핸들러 → 기존 Step 9 opt-in(ImageConsentPanel)·재마스킹 경로 재사용. 텍스트 없는 이미지 단독 시작 플로우 정의.
- **확인 시나리오:** 캡처 붙여넣기 → 동의 후 분석 → 응답 재마스킹 확인.

### Step 17. 확장 입력 B — V0 링크 입력
- **명세 수정:** 링크 fetch 보안 경계(공개 링크만, URL 무로그) 신설.
- **구현:** 링크 입력 UI + 서버 fetch/텍스트 추출 라우트 → 마스킹 게이트 통과 후 기존 플로우 합류.
- **확인 시나리오:** V0 공유 링크 → 텍스트 추출 → 마스킹 검수 화면 진입.

### Step 18. OCR 선마스킹 (브라우저, tesseract.js WASM)
- **명세 수정:** CLAUDE.md §4.2.2 "OCR 선마스킹 후순위" 문구 해제.
- **구현:** 이미지 전송 동의 전에 브라우저 OCR → 마스킹 엔진 통과 → 민감어 감지 시 경고 배지/기본 제외. 외부 전송 전 로컬 처리 원칙 유지.
- **확인 시나리오:** 실명 텍스트가 든 이미지에 민감 경고가 떠서 기본 제외된다.

### Step 19. NVIDIA NIM 이미지 실제 생성 (선행: 키 발급 = 사용자 액션)
- **명세 수정:** CLAUDE.md §2 API 표 상태 갱신, `.env` 주석 해제.
- **구현:** `lib/ai/client.ts`에 `generateImage()`(OpenAI 호환, 서버 전용). image-hints 라우트 확장 + `ImageHint.generatedImageUrl` 표출. 키 없으면 현행(프롬프트만) 폴백.
- **확인 시나리오:** 힌트 카드에서 "이미지 생성" → 생성 썸네일 표시. 키 미설정 시 버튼 비활성 + 안내.

## 진행 방법 (Claude Code)

```
docs/specs/ 문서들과 implementation-steps.md를 읽고, Step {N}만 구현해줘.
선행 확인 후 시작하고, 확인 시나리오를 만족하면 멈춰. 다음 스텝으로 넘어가지 마.
```
