# Design Reference Generator — 프로젝트 컨텍스트

> 이 문서는 Claude Code가 프로젝트 전체를 이해하기 위한 최상위 컨텍스트다.
> 세부 구현 명세는 `docs/specs/` 하위 문서를 참조한다.

> **실사용 문서 검증 완료 (실제 프로젝트 문서 10건 시뮬레이션):** 기획서·화면설계서·회사소개서·제안서템플릿·계절성캠페인 등 실제 업무 문서로 파이프라인을 시뮬레이션하여 발견한 32개 개선사항이 이 문서 세트에 반영되어 있다. 각 반영 지점은 "실사용 검증" 또는 "실사용#N" 주석으로 표시. 마스킹 정확도(개인정보·법정고지·더미패턴 구분)와 레퍼런스 매칭 정확도(도메인 오판 방지)가 핵심 개선 영역이다.

---

## 1. 제품 정의

**목적:** 디자이너가 프로젝트마다 레퍼런스를 찾는 시간을 줄인다. 기획서(설계서)를 업로드하면, 분석 → 레퍼런스/무드보드 → 컨셉서까지 빠르고 정확하게 도출하여, 곧바로 프로젝트에 투입할 수 있게 한다.

**핵심 사용자:** 현재는 단독 사용(디자이너 1인). 단, 추후 디자인팀 사내 배포 가능성을 전제로 설계한다 → 키 노출 없는 서버 구조 필수.

### 이 프로젝트가 다루는 것
기획서 업로드 → 마스킹 → 분석 → 도메인 분류 → 구성페이지 추출 → 레퍼런스/무드보드 → 컨셉서(3안) → 확정 컨셉 → **디자인 MD 직렬화(Phase 5)**.

### 외부 경계 (이 레포 밖)
Phase 5에서 생성하는 디자인 MD는 **이 레포 밖에서 정의된 표준 스키마**를 따른다. 그 스키마를 소비하는 후속 파이프라인(기존 화면/Figma에서 MD를 추출·적용하는 별도 트랙)은 이 프로젝트 범위가 아니다. 이 프로젝트는 "확정된 컨셉을 표준 스키마 MD로 출력"하는 데까지만 책임진다.

### 세부 명세 위치
- 데이터 모델(타입·계보·상태 객체): `docs/specs/data-model.md`
- 화면 셸(랜딩/워크스페이스/LNB) + 마스킹 상세: `docs/specs/phase1-masking-spec.md`
- 단계별 정보 흐름·UX(Phase 2~4: 분석/레퍼런스/분석 대상 브랜드/무드/컨셉): `docs/specs/product-a-flow-spec.md`
- **구현 순서(Claude Code 실행용, 13스텝): `docs/specs/implementation-steps.md`** ← 개발은 여기부터

**구현 시작점:** Claude Code는 `implementation-steps.md`의 Step 1(문서 충돌 정리)부터 순서대로 진행한다. 한 세션에 한 스텝.

---

## 2. 기술 스택 (고정)

- **프레임워크:** Next.js (App Router)
- **언어:** TypeScript
- **구조 원칙:** 프론트(UI)와 백엔드(API Routes)를 한 프로젝트에 둔다. 외부 API 호출과 키 사용은 **반드시 서버(Route Handler)에서만** 한다.
- **배포:** Vercel 전제. 키는 배포 플랫폼 환경변수로 주입.

### 사용 API (전부 발급 완료, 추가 발급 불필요)
| API | 용도 | 모델/비고 |
| --- | --- | --- |
| Gemini | 문서 분석·도메인 분류·컨셉서 생성·분석 대상 브랜드 grounding·이미지 멀티모달 분석 | `gemini-3.5-flash` (무료 티어, 검색 grounding 월 5,000건 무료) |
| Unsplash | 무드보드 감성 이미지 | Access Key |
| Pexels | 무드보드 이미지/영상 | API Key |
| (후순위) NVIDIA NIM | **이미지 실제 생성**(키비주얼·로그인 이미지) | 미발급·미사용. 도입 시 `.env` 추가. OpenAI 호환 |
| (후순위) 스크린샷 API | 분석 대상 브랜드 첫 화면 캡처 | 무료 티어 할당량 내, 소진 시 링크 폴백 |

**LLM/이미지 호출 추상화:** 모든 외부 AI 호출은 `lib/ai/client.ts` 한 곳에 모은다. 나중에 모델 교체(NVIDIA 등, OpenAI 호환)가 코드 한 줄로 되게 한다.

---

## 3. 환경변수 (.env.local)

```bash
# ⚠️ git 커밋 금지 (.gitignore 포함). 전부 서버 전용 — NEXT_PUBLIC_ 절대 금지.

# Gemini (Google AI Studio: https://aistudio.google.com/apikey)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash

# Unsplash (https://unsplash.com/oauth/applications)
UNSPLASH_ACCESS_KEY=

# Pexels (https://www.pexels.com/api/)
PEXELS_API_KEY=

# (후순위/선택) 이미지 실제 생성 도입 시에만 추가 — NVIDIA NIM (OpenAI 호환)
# 현재 미발급·미사용. 이미지 힌트는 프롬프트+타입 표출까지가 기본.
# NVIDIA_API_KEY=
```

`.gitignore`에 반드시 포함: `.env`, `.env.local`, `.env*.local`

**키 취급 규칙 (절대 위반 금지)**
- 모든 키는 서버(Route Handler / Server Action)에서만 읽는다. 클라이언트 번들에 키가 들어가면 안 된다.
- `NEXT_PUBLIC_` 접두사를 붙인 키는 두지 않는다.
- 키 값은 로그·에러 메시지·응답 바디에 노출하지 않는다.

---

## 4. 보안 원칙 (Security KPI 기준 — 최우선)

이 프로젝트의 보안 핵심: **외부 제3자 AI/API(Gemini·Unsplash·Pexels)로는 마스킹된 데이터만 보낸다.** 근거: 무료 Gemini 티어는 프롬프트를 모델 학습에 사용할 수 있다. 사내 기획서 원문이 외부로 나가면 보안 위반이다.

### 4.1 "외부"의 정확한 정의 (표현 주의)
- **외부 = 제3자 AI/API** (Gemini, Unsplash, Pexels). 여기엔 **원문·복원매핑·실명 텍스트를 절대 보내지 않는다.**
- **자사 서버 Route Handler**는 "외부"와 구분된다. 원문은 파일 파싱을 위해 자사 서버까지는 업로드될 수 있다. 단, 서버는 **원문을 메모리에서만 처리하고 로그·디스크·DB에 저장하지 않는다.**
- **Phase 2 이후에는 `maskedText`만 서버/API 경계를 통과한다.**

### 4.1.1 엔티티 민감도 등급 (분석 대상 브랜드 실명 유지 예외 — 정식 규칙)
회사명·기관명을 무차별로 가리면 분석 대상 브랜드(경쟁사·롤모델 등) 분석이 불가능하다(가려서 보내면 Gemini가 분석 못 함). 그래서 엔티티를 **민감도 등급으로 구분**하고, 공개 엔티티는 사용자 확인 후 실명 전송을 허용한다.

- **기밀 등급 (기본 = 가림):** `customer`(우리 고객사), `investor`(투자사·금액), `partner`(비공개 협력사), `internalKpi`. → 마스킹 후 전송.
- **공개 등급 (사용자 확인 후 실명 전송 가능):** `competitor`, `benchmarkBrand`, `roleModel`, `publicReference`. → 공개 정보이므로, **사용자가 "유지"로 확정한 것만** 실명 그대로 외부 전송.
- 원칙: 기본은 전부 가림(안전). 사용자가 명시적으로 "이건 공개 엔티티"라 확정한 것만 실명 유지. AI 자동 판단 금지(틀리면 기밀 유출).
- `investor`는 애매할 수 있다(기밀 투자금 vs 공개 홍보). 항목별로 사용자가 가림/유지를 확정한다.
- 실명 유지 엔티티는 공개 정보라 결과 저장·표출에 실명 포함이 허용된다(고객사 기밀과 구분).

### 4.2 파싱 위치 (보안 강화)
- **txt/md**: 가능하면 **브라우저에서 직접 파싱** → 원문이 PC를 떠나지 않음 (가장 강한 보안).
- **pdf/pptx**: 파싱 라이브러리가 무거워 **자사 서버에서 파싱**. 서버는 메모리 처리·무저장 원칙 준수.
- 그래서 **마스킹 엔진은 서버/클라 양쪽에서 동작하는 isomorphic 순수 함수**로 작성한다(`lib/masking/`). 브라우저 파싱(txt/md)의 경우 마스킹도 클라이언트에서 수행.

### 4.2.1 업로드 범위
- **Phase 1 File Upload Complete 범위 = txt/md/pdf/pptx 텍스트만.** 여기까지가 안전한 기본 경로.
  - **Phase 1 Safe MVP** = txt/md만 (`implementation-steps.md` Step 4, 첫 배포 가능 지점)
  - **Phase 1 File Upload Complete** = 위 Safe MVP + pdf/pptx (Step 5)
- **Phase 1.5 확장 입력:** 단일 이미지(png/jpg/jpeg/gif)·클립보드 캡처 붙여넣기는 **Step 16에서 구현됨** — 이미지 바이트는 브라우저 메모리에만 두고(자사 서버에도 미업로드), 외부 전송은 기존 Step 9 opt-in 동의·재마스킹 경로만 사용. 링크(V0) 입력은 Step 17.

### 4.2.2 이미지 분석 = opt-in (기본값 텍스트만)
- **기본값은 "텍스트만 분석".** 이미지(이미지 포함 pdf/pptx, 이미지 업로드)는 **명시적 동의(opt-in)** 없이 외부로 보내지 않는다.
- 이미지 전송 전: 목록 + 썸네일 + 제외 체크 + 민감 가능성 경고 표시. 동의한 이미지만 Gemini 멀티모달로 전송.
- **멀티모달 응답 재마스킹(필수):** 이미지 분석 응답이 실명(로고·회사명 등)을 다시 뱉을 수 있으므로, **저장 전 마스킹 엔진을 한 번 더 통과**한다. 결과 저장은 항상 masked 기준.
- OCR 선마스킹은 후순위(당장 미구현).

### 4.3 Security KPI 필수 기준
- **로컬 마스킹 적용률 100%** — 탐지된 민감정보는 외부 전송 전 전량 비식별화.
- **원문 외부 입력 0건** — RFP/회의록/기획서 원문을 그대로 외부 API에 전송 금지.
- **프롬프트 보안 위반 0건** — 내부 URL·API Key·고객명·실데이터 후보가 외부 프롬프트에 포함되지 않음.
- **AI 결과는 사람이 최종 확인** — Gemini 분석/생성 결과는 "초안"이며, 확정 전 사용자 검수 단계를 둔다.

→ 그래서 **마스킹 모듈을 가장 먼저 만든다.** 마스킹을 통과하지 못한 데이터는 외부 호출 단계로 넘어갈 수 없다(하드 게이트).

### 4.4 민감 데이터 격리 (상태 분리)
앱 상태를 보안 등급으로 **두 객체로 분리**한다:

```typescript
// 일반 워크플로 상태 — 마스킹된 것만. 평범하게 다뤄도 안전.
interface WorkflowState {
  currentStep: Step;
  completedSteps: Step[];
  maskedText?: string;          // 마스킹됨
  analysis?: ProjectAnalysis;
  references?: ReferenceResult;
  conceptJson?: ConceptJson;    // maskedContent만 보유
}

// 민감 메모리 — 원문·복원키. 격리, 최소 수명, 절대 영속화 금지.
interface SecureClientMemory {
  parsedText?: string;          // 원문
  mappings?: MaskMapping[];     // 복원키 (토큰↔실명)
}
```

**SecureClientMemory 취급 규칙 (절대 위반 금지):**
- `parsedText`, `mappings`, `Detection.raw`(매칭된 원문 조각)는 **모두 민감 등급**이다.
- 이들은 **localStorage·sessionStorage·URL 파라미터·서버 요청 바디·로그**에 **절대** 들어가지 않는다.
- `parsedText`는 **마스킹 검수 확정 직후 즉시 폐기**(`undefined`)한다. 원문이 메모리에 떠도는 시간을 최소화.
- `mappings`(복원키)는 결과 화면 실명 미리보기·실명본 다운로드용으로 워크플로 끝까지 유지하되, **영속화하지 않으므로 새로고침 시 소멸**한다 → 사용자에게 "세션을 벗어나면 실명 복원 불가, 산출물 먼저 다운로드" 안내.
- **복원키 파일 내보내기/가져오기 (Step 14) — 유일한 예외:** 사용자가 명시적으로 버튼을 눌렀을 때만 `mappings`를 로컬 JSON 파일(`drg-recovery-key`)로 다운로드하고, 재활용 모드에서 같은 파일을 다시 가져와 실명 복원을 복구할 수 있다. 생성·해석 전 과정이 클라이언트 메모리에서만 수행되며 서버·외부 API로는 여전히 절대 전송하지 않는다. 파일은 실명 포함 민감물로 취급(공유 금지 안내), 분석 JSON과 `exportId`로 짝을 검증해 다른 문서의 복원키 오적용을 차단한다.

### 4.5 산출물 렌더링 = 클라이언트 일원화
- HTML/PPT/PDF/MD **모든 산출물은 클라이언트에서 렌더링**한다(`pptxgenjs`, `jsPDF`/`pdf-lib` 등). **서버 렌더링 옵션은 두지 않는다.**
- 이유: 실명본을 서버에서 생성하면 복원매핑·실명 텍스트가 서버로 올라가 4.4 원칙이 깨진다. 클라 렌더링이면 어떤 산출물도 서버로 안 보낸다.
- **PPT/PDF 다운로드는 기본 마스킹본**을 생성한다. **실명본은 사용자가 명시적으로 선택한 경우에만** 제공하며, 복원 처리는 클라이언트 메모리에서 수행한다. 실명본 생성을 위해 복원매핑·실명 텍스트를 서버로 전송하지 않는다.
- 트레이드오프: 클라 렌더링은 서버 렌더 대비 폰트 임베딩·복잡 레이아웃 정교함이 다소 떨어질 수 있다. 컨셉서 수준에서는 충분하며, **보안 > 픽셀 완벽**으로 이 트레이드오프를 수용한다.

---

## 5. 데이터 흐름 (전체)

```
[1] 기획서 업로드 (txt/md/pdf/pptx)
      ↓  txt/md → 브라우저 파싱 / pdf·pptx → 자사 서버 파싱(메모리, 무저장)
[2] 로컬 텍스트 추출 (parsedText = SecureClientMemory)
      ↓
[3] 마스킹 모듈 (3계층)  ← Phase 1, 하드 게이트 / isomorphic 엔진
      규칙 자동 탐지 → 내 사전 매칭 → 사용자 최종 검수
      ↓  확정 시: maskedText→WorkflowState, mappings→SecureClientMemory, parsedText 즉시 폐기
      ↓  (외부로는 maskedText만 통과)
[4] Gemini 분석  ← Phase 2
      ProjectAnalysis + Page[] + 후보 Section[] + 도메인/태그 + contentType 판정
      ↓
   ★ 사용자 확정 게이트: 후보 Section 병합/삭제/수정 → confirmed Section
      ↓
[5] confirmed Section 단위 부착  ← Phase 3
      레퍼런스(플랫폼20종 + Gemini grounding 분석 대상 브랜드) + 무드 + 팔레트 + 이미지힌트 + layoutPattern + 스킨 프리뷰
      ↓
[6] Concept JSON 생성 (단일 원천 SSoT)  ← Phase 4
      3안 × {UiStructure, KeyVisual, pages[]⊃sections[]⊃contentMapping}
      ↓
   Concept JSON → 클라이언트 렌더러 4종
      ├─→ HTML 미리보기
      ├─→ PPT (pptxgenjs)
      ├─→ PDF (jsPDF/pdf-lib)
      └─→ (Phase 5) 표준 디자인 MD
[7] 디자인 MD  ← Phase 5
      Concept JSON → 외부 표준 스키마 MD로 변환
```

**Concept JSON = 단일 원천(SSoT):** HTML·PPT·PDF·디자인 MD는 모두 Concept JSON 하나에서 파생된다. 각 산출물을 따로 생성하지 않는다(틀어짐 방지). 디자인 MD도 Concept JSON의 한 renderer일 뿐이다.

**Concept JSON ≠ 표준 디자인 MD 스키마:**
- **Concept JSON** = 제품 내부 산출물의 단일 원천 (Phase 4에서 확정).
- **표준 디자인 MD 스키마** = 이 레포 밖과 공유하는 외부 계약 (Phase 5 직전 확정). Phase 5의 MD 렌더러가 Concept JSON을 읽어 이 스키마로 변환한다.

**복원 매핑 규칙:** `삼성전자→[회사A]` 같은 매핑은 **SecureClientMemory(클라이언트 메모리)에만** 보관한다. 결과 화면 실명 복원·실명본 다운로드에만 쓰고, 어떤 경우에도 서버·외부 API로 전송하지 않는다. Concept JSON에는 항상 `maskedContent`만 저장하며 실명 복원본은 저장하지 않는다(렌더 시점에만 생성).

---

## 6. 빌드 순서 (Phase)

| Phase | 책임 (한 동사) | 범위 | 산출물 | 상태 |
| --- | --- | --- | --- | --- |
| **Phase 1** | 셸+마스킹 | 랜딩 업로드 + 워크스페이스 셸 + LNB 스텝퍼 + 3계층 마스킹(파싱→탐지→검수→미리보기) | 동작하는 셸 + 마스킹 게이트 | **착수** |
| Phase 2 | **분석** | Gemini 분석: ProjectAnalysis, Page[], 후보 Section[], 도메인/태그, contentType 판정 + 사용자 confirmed 게이트 | 분석 결과 + 확정된 Page/Section | 대기 |
| Phase 3 | **수집** | confirmed Section 단위로 레퍼런스(플랫폼20종+grounding)·무드·팔레트·이미지힌트·layoutPattern·스킨 프리뷰 부착 | 섹션별 레퍼런스·무드 화면 | 대기 |
| Phase 4 | **종합** | Concept JSON(SSoT) 생성, 3안 비교, 클라이언트 렌더링(HTML/PPT/PDF) | Concept JSON + 컨셉 산출물 | 대기 |
| Phase 5 | **변환** | Concept JSON → 외부 표준 디자인 MD 스키마로 변환 | 표준 스키마 MD | 대기 |
| Phase 6 (검토) | — | Tauri 데스크톱(오프라인) / 사내 프라이빗 AI 연동 / 이미지 생성 API | — | 보류 |

**Phase 3 내부 순서:** 팔레트·무드를 먼저 확정한 뒤 그 KeyVisual 데이터로 스킨 프리뷰를 입힌다(순서 고정).

**모든 렌더링은 클라이언트에서 수행**한다(§4.5). 서버 렌더링 옵션 없음.

**스키마 확정 시점:** Phase 5의 입력은 Phase 4 Concept JSON 구조에 의존한다. 따라서 외부 표준 MD 스키마는 **Phase 4 완료 후 ~ Phase 5 착수 직전**에 확정한다. 미리 추측으로 잡지 않는다. 단, Phase 4 Concept JSON은 컬러·타이포·무드를 줄글이 아닌 **구조화된 데이터**로 보유하도록 설계해, Phase 5 변환이 단순 매핑이 되게 한다.

각 Phase 상세 명세는 `docs/specs/phaseN-*.md`에 둔다.
Phase 1 명세: `docs/specs/phase1-masking-spec.md` · 데이터 모델: `docs/specs/data-model.md`

---

## 7. 등록 레퍼런스 플랫폼

20종 플랫폼의 검색링크 매칭 규칙은 `lib/references.ts`로 구현한다(원본 명세: `registered_reference_platforms.md`).
- 도메인 힌트(marketing-web / dashboard-ops / mobile-app / document / generic)별로 노출 플랫폼이 달라진다.
- 연동 방식은 "자동 검색 이동"과 "키워드 복사 전용" 두 가지.
- 분석 대상 브랜드(경쟁사·롤모델·벤치마킹 브랜드 포함) 실서비스 매칭은 크롤러를 쓰지 않는다 → **Gemini 검색 grounding**으로 실서비스 URL을 찾고, 결과는 "추천 + 출처 URL"로 표기하며 사용자가 최종 확인한다.

---

## 8. 화면 구조 (셸)

**두 가지 레이아웃 모드:**
- **랜딩 모드** (업로드 전): LNB 없음. 중앙 업로드 UI만.
- **워크스페이스 모드** (업로드 후): 좌측 LNB + 우측 현재 단계 작업 영역.

**LNB = 상태를 가진 스텝퍼** (사용자 언어):
```
① 업로드        (완료된 진입)
② 마스킹 검수    ← Phase 1
③ 분석 결과      ← Phase 2 (도메인·페이지·섹션 확정)
④ 레퍼런스·무드  ← Phase 3
⑤ 컨셉 3안       ← Phase 4
⑥ 디자인 MD     ← Phase 5
```
- 각 단계 상태: **완료(✓) / 현재(●) / 잠김(비활성)**.
- 앞 단계 미완료 시 뒷 단계 **잠김** — 보안 게이트(마스킹 안 하면 분석 불가)가 UI에도 물리적으로 반영.
- 완료한 단계는 다시 눌러 **재방문/수정 가능**.

**페이지 전환:** 라우트 이동이 아니라 **같은 페이지에서 상태 전환**(메모리 유지 = 민감 데이터 보존·보안). URL은 `?step=` 정도로 표시 가능하나 데이터는 메모리 유지. 잠긴 단계 접근은 **`canAccessStep(target, state)` 가드**로 차단(UI 잠금 + 로직 검증 이중).

**Phase 1 범위 = 셸 전체 + 마스킹:** 랜딩 업로드 + 워크스페이스 셸 + LNB 스텝퍼 + 마스킹 모듈. 셸이 토대이며, Phase 2~5는 우측 작업 영역만 채운다.

---

## 9. UI/UX 원칙

- 폰트 최소 14px, 시원시원한 여백.
- 진행 단계(LNB 스텝퍼)를 워크스페이스에서 항상 노출 — 사용자가 지금 어느 단계인지 보이게.
- 분석 결과(도메인·태그·구성페이지·섹션·브랜드컬러)는 **자동 도출하되 셀렉트/편집으로 수정 가능**하게. 분류 신뢰도가 낮으면 사용자 선택을 우선.
- 후보 Section은 **사용자가 병합/삭제/수정해 confirmed로 확정**한 뒤에만 다음 단계로.
- 결과물은 텍스트 설명보다 시각적 미리보기 우선.
