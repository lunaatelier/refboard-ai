# Phase 1 — 마스킹 모듈 상세 명세

> 상위 컨텍스트: `CLAUDE.md`, 데이터 모델: `data-model.md`. 이 문서는 Phase 1 구현의 단일 기준이다.
> 목표: 셸(랜딩+워크스페이스+LNB)을 세우고, 기획서 업로드 시 외부 AI/API 전송 전에 민감정보를 100% 비식별화하는 하드 게이트를 만든다.

---

## 0. Phase 1 완료 기준 (Definition of Done)

Phase 1 = **셸 전체 + 마스킹 모듈**. Gemini 호출은 Phase 1 범위가 아니다.

> **용어 정리 (문서 간 통일):**
> - **Phase 1 Safe MVP** = `implementation-steps.md` Step 4까지. txt/md만. 가장 안전한 경로 하나가 완전히 동작. 첫 배포 가능 지점.
> - **Phase 1 File Upload Complete** = Step 5까지. pdf/pptx 텍스트 파싱 포함. 아래 DoD 전체(1~13)를 만족해야 이 단계.
> - 이미지 분석은 둘 다 포함하지 않는다(Step 9, 별도).

**셸 (Safe MVP 포함):**
1. 랜딩 모드(LNB 없이 중앙 업로드)가 표시되고, 업로드 후 워크스페이스 모드(좌 LNB + 우 작업영역)로 전환된다.
2. LNB가 6단계(업로드/마스킹/분석/레퍼런스·무드/컨셉/디자인MD)를 상태(완료✓/현재●/잠김)와 함께 표시한다.
3. 잠긴 단계는 `canAccessStep` 가드로 접근이 차단된다(마스킹 미완료 시 분석 이후 잠김).
4. 전환은 라우트 이동이 아니라 같은 페이지 상태 전환이며, 메모리(민감 데이터 포함)가 유지된다.

**마스킹 — txt/md (Safe MVP, Step 4):**
5a. txt/md는 **브라우저에서 파싱**되어 텍스트가 추출된다.
6. 추출 텍스트에서 규칙(정규식)으로 민감정보 후보가 자동 탐지된다.
7. 사용자 사전(회사명/고객사/제품명)이 추가로 매칭된다.
8. 탐지 결과가 검수 화면에 리스트로 표시되고, 사용자가 항목을 추가/해제한다.
9. 확정하면 원문이 토큰(`[회사A]`)으로 치환된 마스킹 텍스트가 생성·미리보기된다.
10. 마스킹 엔진은 **isomorphic 순수 함수**로, 서버/클라 양쪽에서 동일하게 동작한다.
11. 복원 매핑(토큰↔실명)은 **SecureClientMemory**에만 존재하며 어떤 네트워크 요청·스토리지·로그에도 포함되지 않는다.
12. **`parsedText`(원문)는 마스킹 확정 직후 즉시 폐기**된다.
13. 마스킹을 거치지 않은 텍스트는 다음 단계(Phase 2)로 넘어갈 수 없다.

**마스킹 — pdf/pptx 추가 (File Upload Complete, Step 5):**
5b. pdf/pptx는 **자사 서버에서 파싱**(메모리·무저장)되어 텍스트가 추출된다. 6~13은 동일하게 적용.

---

## 1. 디렉토리 구조 (Phase 1 범위)

```
/
├─ app/
│  ├─ page.tsx                      # 랜딩↔워크스페이스 모드 전환 (상태 기반)
│  ├─ api/
│  │  └─ parse/route.ts             # 서버 파싱 — 브라우저 Worker 파싱(§7.2)의 동등성 검증·
│  │                                 #   백업 경로. 앱의 기본 경로 아님(자동 폴백 없음)
│  └─ layout.tsx
├─ components/
│  ├─ shell/
│  │  ├─ LandingUpload.tsx          # 랜딩 모드 (LNB 없이 중앙 업로드)
│  │  ├─ Workspace.tsx              # 워크스페이스 모드 (좌 LNB + 우 작업)
│  │  └─ Lnb.tsx                    # 상태 스텝퍼 (완료/현재/잠김)
│  ├─ FileUpload.tsx                # 업로드 (drag&drop)
│  ├─ MaskingReview.tsx             # 검수 화면 (탐지 리스트 + 추가/해제)
│  ├─ MaskedPreview.tsx             # 마스킹 결과 미리보기
│  └─ DictionaryManager.tsx         # 내 사전 관리 UI
├─ lib/
│  ├─ state/
│  │  ├─ workflow.ts                # WorkflowState (전역, 마스킹된 것만)
│  │  ├─ secureMemory.ts            # SecureClientMemory (민감, 격리)
│  │  └─ guards.ts                  # canAccessStep 등 단계 가드
│  ├─ masking/
│  │  ├─ rules.ts                   # 정규식 규칙 세트
│  │  ├─ detect.ts                  # 탐지 엔진 (규칙+사전) — isomorphic 순수함수
│  │  ├─ apply.ts                   # 치환+복원매핑 생성 — isomorphic 순수함수
│  │  ├─ restore.ts                 # 복원 (렌더 시점, 클라 전용)
│  │  └─ types.ts                   # 타입 (data-model.md §3과 일치)
│  ├─ dictionary/
│  │  └─ store.ts                   # 사전 localStorage CRUD (마스킹된 단어목록만)
│  └─ parse/
│     ├─ txt.ts                     # 브라우저 파싱 (txt/md)
│     ├─ pdf.ts                     # pdf 파싱 (unpdf) — 서버 라우트·Worker 공용 순수 함수
│     ├─ pptx.ts                    # pptx 파싱 (jszip) — 서버 라우트·Worker 공용 순수 함수
│     ├─ zipGuard.ts                # zip bomb 방어 (엔트리 수·압축 해제 크기·압축률 상한)
│     ├─ parseDocumentLocally.ts    # 메인 스레드 진입점 — 파일당 Worker 1개, 타임아웃·취소
│     ├─ parse.worker.ts            # 실제 브라우저 Worker 엔트리
│     └─ createParseWorker.ts       # 실제 Worker 생성 (app/page.tsx 전용, import.meta.url)
└─ .env.local
```

**isomorphic 주의:** `lib/masking/detect.ts`·`apply.ts`는 브라우저(txt/md 경로)와 서버 양쪽에서 호출되므로, Node/브라우저 전용 API에 의존하지 않는 **순수 함수**로 작성한다. 복원(`restore.ts`)은 `mappings`를 다루므로 **클라이언트 전용**.

---

## 2. 데이터 타입 (lib/masking/types.ts)

> 전체 타입 정의는 `data-model.md §3`이 단일 기준. 여기서는 보안 주의점만 강조.

```typescript
export interface Detection {
  id: string;
  kind: SensitiveKind;
  raw: string;         // ⚠️ 민감 등급: 매칭된 원문 조각("가상전자"). SecureClientMemory 취급.
  start: number;
  end: number;
  source: "rule" | "dictionary" | "manual";
  enabled: boolean;    // 검수에서 켜고 끔 (기본 true)
}

// ⚠️ 복원키 — SecureClientMemory 전용. 직렬화·전송·스토리지·로그 금지.
export interface MaskMapping {
  token: string;       // "[회사A]"
  raw: string;         // "가상전자"
  kind: SensitiveKind;
}

// ── 검수 중: raw 포함(민감). 검수 UI에서만. WorkflowState에 넣지 말 것. ──
export interface DraftMaskResult {
  detections: Detection[];       // raw 포함
  numericDetections?: NumericDetection[];  // (Step 6에서 추가) Step 3/4엔 없음/미포함
  previewMaskedText: string;
}

// ── 확정 후: raw 없음. 이것만 다음 단계로. ──
export interface FinalMaskResult {
  maskedText: string;            // 외부로 나가는 유일한 텍스트
  mappings: MaskMapping[];       // → SecureClientMemory (WorkflowState 아님)
  // detections 없음 — 확정 시 Draft→Final 변환하며 raw 폐기.
}
```

> Draft/Final 분리 이유·전체 타입(엔티티 등급·수치 마스킹 포함)은 `data-model.md §3`이 단일 기준.
> `MaskResult`(단일 타입)는 폐기됨 — Draft/Final로 대체.

---

## 3. 정규식 규칙 세트 (lib/masking/rules.ts)

Security KPI 문서가 요구하는 탐지 대상을 규칙으로 변환한다. 한국 환경 기준.

| kind | 설명 | 패턴 방향 | 치환 토큰 |
| --- | --- | --- | --- |
| email | 이메일 | 표준 이메일 정규식 | `[이메일]` |
| phone | 전화번호 | `010-0000-0000`, `02-000-0000`, 하이픈/공백 변형 | `[전화]` |
| url | 내부/외부 URL | `http(s)://...`, 사내 도메인 후보 | `[URL]` |
| ip | IP 주소 | IPv4 | `[IP]` |
| apikey | API Key 후보 | 32자 이상 연속 영숫자/`sk-`,`AIza` 등 접두 | `[KEY]` |
| rrn | 주민등록번호 | `000000-0000000` | `[주민번호]` |
| businessRegNo | 사업자등록번호 (실사용#12) | `000-00-00000` | `[사업자번호]` |
| certificationNo | 인증·신용평가 발급번호 (실사용#16) | 영숫자 혼합 코드 (예: `GC1-2023-02618`) — 회사 사전 기반 보조 탐지 | `[인증번호]` |
| address | 도로명·상세주소 (실사용#17) | "OO시/도 + OO구/군 + 도로명 + 번지" 패턴, 우편번호 병기 | `[주소]` |
| personName | 개인 실명 (실사용#3/#5/#19) | 정규식으로 탐지 불가 — **사전 기반 전용** (§6 참조). 개정이력표·작성자란·리뷰코멘트 문맥에서 자주 등장 | `[담당자A]` |

**신규 kind는 정규식만으론 탐지 정확도가 낮다:**
- `certificationNo`는 형식이 발급기관마다 달라 정규식 하나로 못 잡음. **사전 등록(예: "GC1-" 접두 패턴)**을 병행.
- `address`는 오탐(일반 지명 언급과 실제 주소 구분)이 잦음 → 탐지는 하되 검수에서 확인 비중을 높게 둔다.
- `personName`은 반드시 사전 기반. §6 "내 사전"에 `person` 카테고리를 추가(아래 참조).

**더미 패턴 자동 구분 (실사용#13/#29):**
```
다음 패턴은 탐지하되 "likely-dummy" 배지를 달아 검수에서 기본 미체크로 둔다:
  phone:  010-0000-0000, 010-0000-XXXX(4자리 반복 아닌 순차값 포함)
  email:  none@..., noreply@..., no-reply@..., Norply@...
  businessRegNo: 123-12-12345, 123-34-01323 형태(순차적/반복적 숫자)
→ 이 배지는 확정이 아니라 힌트. 사용자가 최종 판단.
```

**URL 마스킹 예외 (실사용#1/#6/#7):**
```
기본: URL은 전부 가림 후보.
예외 1(유지 후보): 도메인이 AnalysisTargetKind=benchmarkBrand/competitor로
  태깅된 브랜드의 공식 도메인과 일치 → "사례분석 출처 URL"로 보고 유지 후보 표시.
  예: 가상아웃도어를 benchmarkBrand로 유지했다면, virtual-outdoor.example URL도 자동 유지 후보.
예외 2(가림 확정): 사내 협업툴 URL 패턴(atlassian.net, notion.so 등 워크스페이스 URL)
  → 항상 가림, 유지 후보로 표시하지 않음.
```

**구현 주의:**
- 각 규칙은 `{ kind, regex, token }` 형태로 export하고, `detect.ts`가 순회한다.
- 같은 토큰이 여러 번 나오면 `[회사A]`, `[회사A]`로 동일 토큰 재사용(같은 실명 = 같은 토큰). 서로 다른 실명은 `[회사A]`, `[회사B]`로 분리.
- apikey 규칙은 오탐(false positive)이 잦으므로, 탐지는 하되 검수 화면에서 사용자가 쉽게 해제할 수 있게 한다.
- 겹치는 매칭(예: URL 안의 IP)은 더 넓은 범위(URL) 우선. `detect.ts`에서 인덱스 겹침 처리.
- **파일명도 탐지 대상(실사용#32):** 업로드 시 원본 파일명을 `detect()`에 통과시킨다. 업로드 목록·다운로드 파일명 등 어디에도 원본 파일명을 그대로 노출하지 않고, 마스킹된 표시명(`UploadedFileMeta.displayName`)을 사용한다.

---

## 4. 탐지 엔진 (lib/masking/detect.ts)

```
입력: 원문 텍스트, 사전(dictionary)
처리:
  1) rules.ts의 모든 정규식으로 매칭 → Detection[] (source="rule")
  2) 사전의 각 단어를 원문에서 검색 → Detection[] (source="dictionary")
     - company / client / product 종류별로 분류
  3) 인덱스 겹침 제거 (넓은 범위 우선)
  4) 정렬 (start 오름차순)
출력: Detection[]
```

사전 매칭은 **부분 문자열 정확 매칭**으로 시작(정규식 이스케이프 처리). 추후 동의어/변형 처리는 Phase 1 이후.

---

## 5. 치환 + 복원 (lib/masking/apply.ts)

```
입력: 원문, enabled=true인 Detection[]
처리:
  1) 같은 raw 문자열 → 같은 토큰 부여 (kind별 알파벳 인덱싱: 회사A, 회사B...)
  2) 원문에서 해당 구간을 토큰으로 치환 (뒤에서 앞으로 치환해 인덱스 밀림 방지)
  3) MaskMapping[] 생성
출력: 확정 시 FinalMaskResult { maskedText, mappings } (검수 중엔 DraftMaskResult)
```

**복원 함수**도 같이 둔다: `restore(maskedText, mappings)` → 토큰을 실명으로 되돌림. 결과 화면 표시에만 사용.

---

## 6. 내 사전 (lib/dictionary/store.ts)

```typescript
export interface DictionaryEntry {
  id: string;
  value: string;                         // 예: "가상전자" / "가상담당자A"
  kind: "company" | "client" | "product" | "person";  // person = 실사용#3/#5/#19/#27
  scope: "project" | "global";           // person은 기본 global (아래 참조)
}

// localStorage 키:
//   "drg.dictionary.v1"         — 프로젝트 범위 (company/client/product)
//   "drg.dictionary.person.v1"  — 전역 범위 (person, 프로젝트 경계 넘어 유지)
// CRUD: list / add / remove / update
// 데이터는 JSON 배열. 추후 서버/DB 이전을 고려해 순수 JSON 유지.
```

**person 카테고리는 기본이 전역(global)이다 — 실사용 검증에서 발견된 이유(#27):**
같은 실무자(예: "가상담당자A")가 서로 다른 클라이언트 프로젝트 여러 개에 개정이력 작성자·리뷰어로 반복 등장하는 사례가 10개 문서 중 3건에서 확인됨. 프로젝트마다 매번 인명을 새로 등록하는 건 비효율적이라, **person만 프로젝트 경계를 넘어 재사용**한다. 한 프로젝트에서 "가상담당자A"를 등록하면 다음 프로젝트 마스킹 검수에서 자동으로 탐지 후보에 뜬다.

UI(`DictionaryManager.tsx`): 단어 추가/삭제, 종류 선택. 검수 화면에서 "이 단어 항상 가리기"로 사전에 바로 등록하는 동선도 제공. person 등록 시 "이 이름은 앞으로 모든 프로젝트에서 자동 탐지됩니다" 안내 표시.

> 보안 경계 주의: 사전은 "가릴 대상 단어 목록"이라 localStorage 저장이 허용되는 유일한 예외다. 단, 이는 **사용자가 직접 등록한 키워드**이지 문서 원문이 아니다. `parsedText`·`mappings`·`Detection.raw`(문서에서 추출된 민감 데이터)는 사전과 별개이며 localStorage에 절대 들어가지 않는다.

---

## 7. 파싱 (브라우저 / 서버 분기)

**보안 원칙: 원문이 PC를 떠나는 걸 최소화한다.**

### 7.1 브라우저 파싱 — txt/md (`lib/parse/txt.ts`)
- txt/md는 **브라우저에서 직접** 텍스트를 읽는다(`File.text()`). 원문이 PC를 떠나지 않음.
- 파싱 직후 마스킹도 클라이언트에서 수행(isomorphic 엔진). 가장 강한 보안 경로.

### 7.2 브라우저 Worker 파싱 — pdf/pptx (`lib/parse/parseDocumentLocally.ts`, P0 item 7 이관 완료)
pdf/pptx도 txt/md와 마찬가지로 **브라우저에서** 파싱한다. 원문이 자사 서버로도 올라가지 않는다.
```
parseDocumentLocally(file)
  1. 확장자·크기(20MB) 검증
  2. File → ArrayBuffer, 파일 하나당 Worker 1개 생성 (lib/parse/parse.worker.ts)
  3. transfer list로 버퍼 전달(복사 없음) → Worker 안에서 pdf: unpdf / pptx: jszip으로 파싱
  4. 성공·실패·타임아웃·취소 어느 경우든 즉시 worker.terminate() — 민감한 원문이 Worker
     메모리에 오래 남지 않게 한다
보안 (반드시 준수):
  - 추출 텍스트·파일 내용을 콘솔·에러 메시지로 노출하지 않는다(고정 문구만).
  - 외부(Gemini/Unsplash/Pexels)로 전송하지 않는다.
  - 실패 시 서버로 자동 폴백하지 않는다(그러면 원문이 다시 서버로 올라가고 Vercel
    Functions 4.5MB 요청 상한과 원문 무전송 원칙이 동시에 깨진다).
```
pptx는 zip이므로 `lib/parse/zipGuard.ts`가 압축 해제 전 메타데이터로 zip bomb을 방어한다
(엔트리 개수·단일/전체 압축 해제 크기·압축률 상한 + 실제 압축 해제 중 누적 재검사).

`app/api/parse/route.ts`(서버 파싱)는 **삭제하지 않고 유지**한다 — 브라우저 파싱과 동등성
검증·백업 경로 용도이며, 앱의 기본 경로가 아니다(자동 폴백으로 호출되지 않음).
라이브러리: `unpdf`(PDF), `jszip`(pptx unzip 후 slide XML 텍스트 추출) — 둘 다 순수 함수라
서버 라우트·Worker가 `lib/parse/pdf.ts`·`lib/parse/pptx.ts`를 그대로 공유한다.

### 7.3 공통
- 파싱 결과 텍스트는 `SecureClientMemory.parsedText`로 들어간다(민감 등급).
- 마스킹 확정 직후 `parsedText`는 즉시 폐기한다.

> 표현 주의: "외부로 전송하지 않는다"의 외부 = 제3자 AI/API. pdf/pptx는 파싱을 위해 자사 서버까지는 업로드되며, 서버는 메모리·무저장 원칙을 지킨다. (CLAUDE.md §4.1)

---

## 8. 화면 셸 + UI 흐름 (Phase 1)

### 8.1 레이아웃 모드
- **랜딩 모드** (업로드 전, `LandingUpload`): LNB 없음. 중앙 업로드 UI만.
- **워크스페이스 모드** (업로드 후, `Workspace`): 좌측 LNB(`Lnb`) + 우측 작업 영역.
- 전환은 **같은 페이지 상태 전환**(라우트 이동 X). 업로드 성공 → `currentStep` 변경 → 워크스페이스 렌더.

### 8.2 LNB (상태 스텝퍼)
```
① 업로드  ② 마스킹 검수  ③ 분석  ④ 레퍼런스·무드  ⑤ 컨셉 3안  ⑥ 디자인 MD
```
- 각 단계: 완료(✓) / 현재(●) / 잠김(비활성).
- Phase 1에서 활성은 ①②까지. ③~⑥은 잠김(`canAccessStep`이 false).
- 완료 단계 재방문 가능. 잠긴 단계 클릭은 가드로 차단.

### 8.3 작업 흐름
```
1. 업로드 (FileUpload)
   - drag&drop / 선택. txt/md/pdf/pptx.
   - txt/md → 브라우저 파싱 / pdf·pptx → /api/parse(서버) 호출.
   - 결과 텍스트 → SecureClientMemory.parsedText.

2. 마스킹 검수 (MaskingReview)
   - parsedText에 isomorphic 탐지 엔진 적용 → Detection[].
   - 종류별로 묶어 리스트. 각 항목: [원문 일부][종류 배지][켜기/끄기].
   - "단어 직접 추가" → manual Detection. "이 단어 항상 가리기" → 사전 등록.
   - 상단 요약: "민감정보 N건 탐지 · M건 적용 예정".

3. 마스킹 완료 (MaskedPreview)
   - 확정 시 처리 순서:
       a) apply로 FinalMaskResult 생성 (maskedText + mappings, raw 폐기)
       b) maskedText → WorkflowState
       c) mappings → SecureClientMemory
       d) parsedText = undefined  ← 원문 즉시 폐기
       e) Detection[] 정리 (raw 보유분 해제)
   - 마스킹 텍스트 미리보기(토큰 하이라이트).
   - "원문/마스킹 보기" 토글: 원문 표시는 폐기 전까지만, 로컬 표시 한정.
   - 미적용 항목 있으면 경고 배지.
   - "다음 단계" → maskedText만 Phase 2로. (③ 잠금 해제)
```

**UI 규칙:** 폰트 최소 14px. LNB 항상 노출(워크스페이스). 토큰은 시각적 구분(배경색/배지). 빈/실패 상태 안내 문구 명확. `mappings`는 영속화하지 않으므로 "새로고침 시 실명 복원 불가" 안내(결과 단계에서).

---

## 9. 테스트 시나리오 (구현 검증용)

**마스킹:**
1. 이메일/전화/URL이 섞인 txt → 전부 탐지·치환되는지.
2. 같은 회사명이 본문에 5번 등장 → 모두 같은 토큰 `[회사A]`로 통일되는지.
3. 서로 다른 회사 2곳 → `[회사A]`, `[회사B]`로 분리되는지.
4. apikey 오탐을 사용자가 해제 → 치환에서 빠지는지.
5. 사전에 "고객사명" 등록 후 재업로드 → 자동 매칭되는지.

**보안 (가장 중요):**
6. 마스킹된 텍스트·네트워크 요청 어디에도 실명·복원매핑이 없는지(네트워크 탭 확인).
7. txt/md 업로드 시 `/api/parse` 호출이 **발생하지 않는지**(브라우저 파싱 확인).
8. pdf/pptx 업로드 시에만 `/api/parse` 호출되고, 응답에 추출 텍스트만 있는지.
9. 마스킹 확정 후 `parsedText`가 폐기(undefined)되는지.
10. localStorage/sessionStorage에 원문·mappings·Detection.raw가 저장되지 않는지(사전 단어목록만 허용).

**셸:**
11. 업로드 전 LNB 없음 → 업로드 후 워크스페이스로 전환되는지.
12. 마스킹 미완료 상태에서 ③분석 단계 클릭 시 차단되는지(canAccessStep).
13. 완료한 ①②단계 재방문 가능한지.

---

## 10. 다음 Phase 연결점

Phase 2(Gemini 분석)는 **maskedText만** 입력으로 받는다. Phase 1의 `FinalMaskResult.maskedText`가 Phase 2의 유일한 입력이며, `mappings`는 결과 화면 복원용으로만 클라이언트에 남는다. 이 경계가 보안 게이트의 핵심이다.
