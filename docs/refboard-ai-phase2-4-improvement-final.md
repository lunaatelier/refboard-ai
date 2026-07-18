# RefBoard AI 레퍼런스·컨셉 개선 확정 지시서

> 작성일: 2026-07-18  
> 대상 저장소: `C:\Users\boon\workspace\refboard-ai`  
> 대상 작업자: Claude Code / Codex  
> 상태: 구현 착수용 확정본  
> 기준: 현재 작업 트리의 실제 코드, 실행 결과 스크린샷, 기존 제품 스펙, Morphic 벤치마크, Inspo AI 공개 정보와 API 운영 리스크를 함께 재검토한 결과  
> 개정: 2026-07-18 — Claude Code 코드 대조 검증 + 교차 피드백 반영판. 미커밋 변경 처리, 업로드 용량 한도, 누락 타입(`VerifiedSource`/`ImageNeedDecision`/`SafeConceptAnalysisInput`), `ConceptJson` 버전 전략, 팔레트 모드 스냅샷, 기존 콘텐츠 변형과 컨셉 3안의 관계(온디맨드 확정), `maskedText` 저장 범위를 이번 개정에서 확정했다.

---

## 0. 문서 목적

이 문서는 RefBoard AI의 마스킹 검수, 레퍼런스·무드, 컨셉 3안 단계에서 확인된 문제를 정리하고, 바로 구현에 착수할 수 있는 작업 순서와 데이터 계약을 확정한다.

이번 개선의 목적은 화면을 단순히 보기 좋게 정리하는 것이 아니다. 최종 목표는 다음 한 문장으로 정의한다.

> **사용자가 선택하거나 채택한 디자인 결정은 출처와 적용 범위를 가진 데이터로 저장되고, 반드시 컨셉 생성과 프리뷰에 반영되어야 한다.**

현재 제품은 AI가 만든 중간 결과를 탭별로 나열하지만, 디자이너가 무엇을 채택했는지 기록하지 못한다. 그 결과 레퍼런스 단계에서 많은 정보를 생성해도 컨셉 단계에는 팔레트, 무드 키워드, 일부 레이아웃 값만 전달되고, 결과는 레퍼런스가 반영된 디자인 방향이 아니라 일반적인 와이어프레임에 가깝게 보인다.

---

## 1. 단계 명칭 정리

기존 문서와 실제 화면에서 Phase 번호가 다르게 사용되어 혼동이 있다. 이 문서에서는 번호보다 화면 이름을 우선 사용한다.

| 실제 화면 단계 | 이 문서에서 사용하는 명칭 | 주요 개선 범위 |
|---|---|---|
| 2. 마스킹 검수 | 마스킹 검수 | 전체 텍스트 덤프 제거, 검수 중심 요약 |
| 3. 분석 결과 | 설계 데이터 | 선택 페이지와 섹션의 입력 근거 제공 |
| 4. 레퍼런스·무드 | 레퍼런스 결정 | 글로벌 방향, 페이지별 레퍼런스 채택 |
| 5. 컨셉 3안 | 컨셉 생성 | 확정된 결정과 실데이터 반영 |
| 6. 디자인 MD | 산출물 렌더링 | `ConceptJson` 기반 파생 유지 |

---

## 2. 현재 확인된 문제와 실제 원인

### 2.1 마스킹 검수: 확정 후 전체 텍스트가 기본 노출됨

**현재 문제**

- 확정 후 `마스킹된 텍스트 (외부로 나가는 유일한 텍스트)` 영역에 전체 텍스트가 긴 스크롤 형태로 노출된다.
- 사용자가 실제로 확인해야 할 것은 어떤 정보가 가려졌고, 공개 유지됐으며, 제외됐는지인데 전체 문서를 다시 읽게 한다.
- 마스킹 그룹 요약과 전체 텍스트가 함께 노출되어 정보 우선순위가 불분명하다.

**실제 원인**

- `components/MaskingReview.tsx`가 확정 후에도 `maskedText` 전체를 기본 `<pre>` 영역에 렌더링한다.
- 현재 `maskingSummary`는 종류, 개수, 토큰 중심이라 발생 위치와 주변 문맥을 보여줄 수 없다.

**영향**

- 검수 화면이 확인 도구가 아니라 텍스트 표시 화면처럼 보인다.
- 민감정보 누락 여부를 빠르게 판단하기 어렵다.

### 2.2 레퍼런스 단계: 네 개 탭이 각각 생성되고 하나의 결정으로 합쳐지지 않음

**현재 문제**

- 컬러·무드, 섹션별 레퍼런스, 분석 대상 브랜드, 이미지 힌트가 서로 독립적으로 동작한다.
- 사용자가 어떤 항목을 최종적으로 채택했는지 한 화면에서 확인할 수 없다.
- 탭에서 만든 데이터가 다음 탭의 입력이나 컨셉 생성의 명확한 근거로 이어지지 않는다.

**실제 원인**

- `ReferenceResult`는 탭별 작업 결과를 누적하는 편집 상태일 뿐, 확정된 디자인 결정을 표현하는 별도 객체가 없다.
- 레퍼런스 단계의 다음 버튼은 현재 팔레트와 무드 선택 여부만 검사한다.
- 수집한 `ReferenceItem`에는 `적용`, `참고`, `제외` 상태나 적용 요소가 없다.

**영향**

- “선택한 것은 반드시 반영된다”는 제품 규칙을 보장할 수 없다.
- 컨셉 생성 시 수집한 레퍼런스 자체는 거의 사용되지 않는다.

### 2.3 섹션 레퍼런스: 페이지 맥락이 사라지고 요소가 과도하게 분절됨

**현재 문제**

- 메인 페이지와 서브 페이지에서 선택한 섹션이 한 개의 긴 목록으로 표시된다.
- 페이지의 목적과 전체 흐름보다 섹션별 검색어, 플랫폼 링크, 이미지가 먼저 보인다.
- 플랫폼 수와 검색 링크 수가 많아 디자이너가 결과를 비교하기보다 검색 작업을 반복하게 된다.

**실제 원인**

- 선택된 페이지의 섹션을 `flatMap`으로 평탄화한 후 섹션 단위로 렌더링한다.
- 도메인에 해당하는 플랫폼을 모두 노출하고 플랫폼당 하나의 쿼리를 만든다.
- 검색 결과를 저장할 수는 있지만, 해당 결과에서 어떤 요소를 채택할지는 기록하지 않는다.

**영향**

- 설계서에서 선택한 페이지와 레퍼런스 간 관계가 보이지 않는다.
- 데이터가 많아질수록 유용성보다 탐색 비용이 더 커진다.

### 2.4 히어로·무드 이미지: 디자인 검색어와 사진 검색어가 혼용됨

**현재 문제**

- `cinematic hero section` 같은 UI 레이아웃 검색어가 Unsplash/Pexels에 전달된다.
- 사진 검색 API는 `hero`와 `cinematic`을 영화관, 간판, 영화 이미지로 해석한다.
- 결과가 웹사이트 히어로에 쓰일 이미지 방향과 맞지 않는다.

**실제 원인**

- 디자인 플랫폼 검색과 사진 API 검색이 동일한 검색어 흐름을 공유한다.
- `/api/mood-images`는 단일 `query`만 받고 이미지 제공자별 맥락이나 팔레트 필터를 받지 않는다.

**영향**

- 사용자는 이미지의 선정 기준을 이해할 수 없다.
- 다시 불러오기를 해도 동일한 검색어가 유지되어 결과 개선 가능성이 낮다.

### 2.5 무드보드: 컬러, 타이포, 이미지가 하나의 디자인 방향으로 보이지 않음

**현재 문제**

- 팔레트 후보와 무드 후보가 별도 영역에 존재한다.
- 선택 무드의 이미지는 하단 그리드로 따로 노출된다.
- 컬러, 이미지, 타이포의 조합이 실제 화면에서 어떤 인상을 만드는지 한 번에 비교하기 어렵다.

**실제 원인**

- 팔레트와 무드가 독립 후보로 생성되고 선택된다.
- 현재 `MoodBoard` 타입에는 팔레트와 타이포 방향이 포함되지 않는다.

**영향**

- 무드보드가 디자인 방향 보드가 아니라 키워드 카드와 사진 목록처럼 보인다.
- 조합의 일관성보다 개별 요소 선택에 집중하게 된다.

### 2.6 브랜드 분석: 출처를 신뢰할 수 없고 분석 근거가 보이지 않음

**현재 문제**

- 브랜드와 관계없는 기사나 보도자료가 대표 출처로 표시된다.
- 이미지나 페이지 미리보기가 없어 실제 사이트를 분석했는지 확인하기 어렵다.
- 긴 분석 문장이 먼저 노출되고 출처 신뢰 상태는 구분되지 않는다.

**실제 원인**

- Gemini grounding을 호출하지만 `generateGroundedJson`이 응답 본문의 JSON만 반환한다.
- 실제 grounding citation 메타데이터를 버리고, 모델이 JSON에 작성한 `sourceUrl`을 신뢰한다.
- URL 형식 외에 공식 도메인 여부와 응답 검증이 없다.

**영향**

- 분석 결과 전체의 신뢰도가 떨어진다.
- 잘못된 분석이 컨셉의 벤치마킹 시사점으로 들어갈 수 있다.

### 2.7 이미지 힌트: 대표 페이지 역할과 이미지 생성 목적이 불명확함

**현재 문제**

- 시각 대표와 내용 대표가 같은 페이지로 추천되는 경우가 많다.
- 두 필드가 왜 필요한지, 동일한 값이어도 되는지 설명이 부족하다.
- 표지 이미지와 섹션 이미지의 프롬프트가 고정되어 있어 다시 생성해도 방향 수정이 어렵다.

**실제 원인**

- 역할은 분리되어 있지만 추천 이유와 실제 사용 위치가 UI에서 보이지 않는다.
- 이미지 재생성은 같은 프롬프트를 다시 호출한다.
- 이미지 힌트가 확정된 페이지별 디자인 결정과 연결되지 않는다.

**영향**

- 사용자는 대표 페이지와 이미지 힌트를 형식적인 입력으로 인식한다.
- 생성 이미지가 마음에 들지 않을 때 수정할 수 있는 수단이 부족하다.

### 2.8 컨셉 프리뷰: 실데이터 일부가 연결됐지만 여전히 와이어프레임처럼 보임

**현재 문제**

- 실제 `maskedContent`와 팔레트가 전달돼도 `카드 1/2/3`, `지표 1/2/3` 같은 플레이스홀더가 남는다.
- 선택한 무드 이미지와 수집한 레퍼런스의 적용 요소가 프리뷰에 보이지 않는다.
- 세 가지 컨셉이 컬러와 설명만 달라지고, 페이지별 디자인 결정 차이가 충분히 드러나지 않는다.

**실제 원인**

- `designBasis`의 팔레트, 무드 키워드, 타이포 방향은 이미 구현되어 있다.
- `ConceptPreview`의 일부 layout renderer가 실제 콘텐츠 구조를 해석하지 않고 정적인 반복문으로 카드를 생성한다.
- 컨셉 API에는 섹션별 `layoutPattern`과 채택한 브랜드 시사점만 전달되며, 채택 레퍼런스와 선택 이미지가 전달되지 않는다.

**영향**

- 현재 문제는 단순한 `designBasis` 미연결이 아니라 입력 근거 부족과 렌더러 표현력 부족의 결합이다.

### 2.9 단계 되돌아가기와 비동기 응답이 최신 결정을 덮어쓸 수 있음

현재 단계 이동은 가능하지만 상위 결정을 수정했을 때 하위 결과를 무효화하는 기준이 없다. 또한 무드 이미지처럼 요청 전 상태 전체를 복사해 두었다가 응답 후 `ReferenceResult` 전체를 교체하는 방식은, 사용자가 그 사이 다른 탭에서 수정한 값을 늦게 도착한 응답이 덮어쓸 수 있다.

**결론:** 상태를 통째로 교체하지 말고 reducer/action 기반 원자적 패치로 변경한다. 분석, 방향, 확정 브리프마다 hash와 최신성 상태를 두고, 이전 요청은 취소하거나 requestId/version이 현재와 일치할 때만 반영한다.

### 2.10 전체 워크플로가 메모리 중심이며 API 호출 예산이 없음

현재는 일부 분석 캐시를 제외하면 새로고침 복구가 어렵고, API route별 rate limit이나 프로젝트 단위 호출 상한도 없다. 모든 섹션을 같은 깊이로 처리하면 한 프로젝트에서 검색·분석·생성 호출이 급격히 늘고 사용자는 검토 피로를 느끼게 된다.

**결론:** 안전 데이터만 IndexedDB에 자동 저장하고, 고영향 섹션 3~5개만 심층 탐색한다. 제공자별 캐시, in-flight 중복 제거, 서버 rate limit, 프로젝트 호출 예산을 제품 규칙으로 둔다.

---

## 3. 확정 제품 원칙

### 3.1 생성보다 결정이 우선이다

AI가 많은 후보를 만드는 것보다 사용자가 무엇을 채택했는지를 기록하는 것이 우선이다. 채택 상태가 없는 결과는 참고 자료일 뿐 다음 단계 입력으로 사용하지 않는다.

### 3.2 글로벌 방향과 페이지별 적용을 분리한다

- 글로벌 방향: 프로젝트 전체의 컬러, 타이포, 이미지 톤, 밀도, 금지 방향
- 페이지별 적용: 각 페이지와 섹션에 적용할 레이아웃, 레퍼런스 요소, 이미지 필요 여부

글로벌 무드를 선택했다고 모든 페이지가 동일한 구도와 이미지를 사용해서는 안 된다.

### 3.3 선택하지 않은 데이터는 컨셉에 영향을 주지 않는다

검색 결과, 미채택 브랜드 분석, 제외한 이미지가 컨셉 프롬프트에 들어가지 않도록 한다. 전체 `ReferenceResult`를 API에 전달하지 않고, 확정된 스냅샷만 전달한다.

### 3.4 조합은 가능한 한 결정론적으로 수행한다

무드 키워드 주입, 팔레트 색 필터, 채택 항목 병합은 로컬 규칙으로 처리한다. 이를 위해 별도 Aggregator Gemini 호출을 추가하지 않는다.

**이유:** 추가 AI 호출은 비용과 변동성을 늘리며, 이미 사용자가 확정한 결정을 다시 AI가 해석하게 만든다.

### 3.5 출처는 AI 문장이 아니라 실제 응답 메타데이터로 검증한다

모델이 작성한 URL 문자열을 신뢰 근거로 사용하지 않는다. grounding citation, 공식 도메인 관계, 안전한 서버 조회 결과를 각각 저장한다.

### 3.6 외부 전송은 명시적인 안전 DTO만 허용한다

`ProjectAnalysis` 전체나 `ReferenceResult` 전체를 외부 API에 그대로 넘기지 않는다. API별 입력 DTO를 만들고 허용 필드만 구성한다.

### 3.7 ConceptJson은 컨셉 확정 이후의 SSoT를 유지한다

Phase 4 이후 렌더러는 계속 `ConceptJson`만 읽는다. 다만 컨셉이 어떤 확정 레퍼런스 결정에서 나왔는지 추적할 수 있도록 `sourceBasis` 스냅샷을 포함한다.

### 3.8 모든 섹션을 같은 깊이로 분석하지 않는다

히어로, 핵심 기능, 데이터 시각화처럼 방향을 좌우하는 3~5개 섹션만 `고영향`으로 지정해 심층 레퍼런스를 찾는다. 나머지 섹션은 글로벌 방향과 기본 레이아웃을 상속하고, 필요할 때만 사용자가 심층 탐색으로 승격한다.

### 3.9 이전 결과를 조용히 삭제하거나 최신 결과처럼 보여주지 않는다

상위 결정이 바뀌면 영향을 받는 하위 결과에 `최신 아님` 상태를 표시한다. 수동으로 저장한 레퍼런스는 보존하되 다시 확인 또는 재생성이 필요함을 알린다.

### 3.10 API 호출은 사용자 가치와 비용을 함께 기준으로 제한한다

정상 흐름의 Gemini 호출은 분석, 글로벌 방향, 컨셉 생성의 약 3회를 기준으로 한다. 검색어 조합과 이미지 힌트는 로컬 규칙을 기본으로 하며, 외부 디자인 검색과 이미지 생성은 명시적 사용자 액션에서만 호출한다.

### 3.11 외부 디자인 검색 제공자는 교체 가능해야 한다

Inspo AI를 포함한 외부 제공자는 어댑터 뒤에 두고 기능 플래그, 캐시, fallback을 제공한다. 제공자 장애나 계약 변경이 프로젝트의 핵심 흐름을 막아서는 안 된다.

---

## 4. 목표 사용자 흐름

```text
설계 데이터 확인
    ↓
글로벌 방향 3안 비교
컬러 + 타이포 + 이미지 + 스타일 규칙 + 금지 방향
    ↓
글로벌 방향 1안 확정
    ↓
고영향 섹션 3~5개 선택
히어로 + 핵심 기능 + 데이터 시각화 등
    ↓
선택 섹션만 심층 레퍼런스 탐색
Inspo/디자인 플랫폼 + 채택 요소 + 수동 URL
    ↓
나머지 섹션은 글로벌 방향과 기본 레이아웃 상속
    ↓
브랜드 분석 선택 사용
최대 3개 + 출처 + 가져올 점 + 피할 점
    ↓
확정 검토
프로젝트 전체 결정 + 고영향 결정 + 상속 결정 + 미결정 항목
    ↓
ConfirmedReferenceBrief 생성
    ↓
동일 글로벌 방향 안에서 구조 적용 3안 생성
구조·신뢰형 / 비주얼·몰입형 / 균형형
    ↓
실데이터 프리뷰 및 출력
```

---

## 5. 목표 화면 구조

### 5.1 레퍼런스·무드 메인 화면

현재의 네 개 동등 탭 대신 다음 구조를 기본으로 한다.

#### 상단: 글로벌 방향 스트립

- 선택한 방향명
- 팔레트 6역할
- 타이포 방향
- 선택 이미지 최대 4장
- 핵심 키워드
- 금지 방향
- `방향 변경` 버튼

#### 왼쪽: 선택 페이지 내비게이션

- 메인 페이지
- 선택한 서브 페이지
- 페이지별 결정 상태: `미시작 / 진행 중 / 완료`
- 페이지별 고영향/상속/선택 섹션 수
- 최신 아님 결정 수

#### 중앙: 현재 페이지 디자인 보드

- 설계 데이터 요약: 페이지 목적, 대상 사용자, 핵심 콘텐츠
- 페이지 섹션 순서
- 섹션 우선순위: 고영향 / 상속 / 선택
- 섹션별 레이아웃 후보
- 저장한 디자인 레퍼런스 썸네일
- 채택한 레퍼런스와 적용 요소
- 필요한 이미지의 역할과 방향

#### 오른쪽: 적용 결정 패널

- 현재 페이지에 적용된 결정
- 가져올 요소
- 피할 요소
- 출처 상태
- 되돌리기와 편집

#### 하단: 확정 검토

- 글로벌 방향 완료 여부
- 선택 페이지별 완료 여부
- 출처 미확인 항목 수
- 이미지 미결정 영역 수
- `레퍼런스 결정 확정` CTA

### 5.2 보조 기능 배치

- 플랫폼 검색 경로는 기본 화면의 주 콘텐츠가 아니라 섹션별 `레퍼런스 찾기` 패널에 배치한다.
- 브랜드 분석은 독립 탭으로 유지할 수 있지만, 채택 결과는 오른쪽 결정 패널에 합쳐져야 한다.
- 이미지 힌트는 독립 탭에서 제거하고 `새 이미지 필요`로 지정한 섹션의 후속 액션으로 이동한다.

### 5.3 Morphic 무드보드 벤치마크 적용 원칙

[Morphic 무드보드 예시](https://morphic.com/kr/resources/images/mood-board-images)는 사진을 같은 크기로 나열하는 이미지 갤러리가 아니다. 하나의 시각 방향을 설명하기 위해 이미지, 컬러, 소재, 서체를 위계 있게 조합한다.

확인된 대표 레이아웃은 다음 네 가지다.

1. `그리드 콜라주 보드`: 비슷한 무게의 이미지를 균형 있게 배치해 전체 방향을 빠르게 비교한다.
2. `히어로 이미지와 스와치 띠`: 대표 이미지 하나가 초점을 만들고, 컬러와 디테일이 보조 단서가 된다.
3. `컬러 스토리 팔레트 보드`: 색 블록이 중심이고 소수의 이미지가 컬러가 실제로 쓰이는 맥락을 보여준다.
4. `텍스처와 서체 보드`: 소재와 표면, 서체 견본을 결합해 톤과 마감을 정의한다.

RefBoard AI는 이 구조를 그대로 복제하지 않고 웹 디자인 의사결정에 맞게 다음처럼 번역한다.

| 페이지/결정 목적 | 권장 보드 구조 | 포함 요소 |
|---|---|---|
| 메인 히어로 방향 | 히어로 이미지 + 스와치 띠 | 대표 이미지, 팔레트, 헤드라인 타이포, 조명/재질 단서 |
| 서브 페이지 전체 방향 | 그리드 콜라주 | 레이아웃 레퍼런스, 콘텐츠 밀도, 이미지 톤, 컴포넌트 단서 |
| 브랜드 톤 정리 | 컬러 스토리 팔레트 | 역할 컬러, 실제 적용 이미지, 대비 규칙, 금지 색 조합 |
| 디테일·마감 정리 | 텍스처와 서체 | 타이포 견본, 아이콘/선 스타일, 표면·패턴, radius와 border |

각 보드는 다음 규칙을 지킨다.

- 모든 이미지를 같은 크기로 나열하지 않는다.
- 대표 이미지 또는 대표 UI 레퍼런스 하나에 가장 높은 시각적 비중을 준다.
- 이미지 옆에 팔레트와 타이포를 실제 견본으로 배치한다.
- 각 조각은 `대표`, `보조`, `디테일`, `텍스처`, `레이아웃` 역할을 가진다.
- 사용자는 조각을 선택, 제외, 교체하고 역할을 바꿀 수 있다.
- 프롬프트와 검색어는 언제든 수정할 수 있어야 한다.
- 하나의 선택 이미지나 확정 팔레트를 잠금 기준으로 사용해 나머지 결과의 톤을 유지한다.
- 완전한 자유 배치 Canvas는 1차 구현 범위에서 제외하고, 검증된 보드 템플릿 안에서 순서와 역할만 편집한다.

**적용하지 않을 것:** Morphic 페이지의 검은 마케팅 사이트 스타일, 가격·쇼케이스 구성, 이미지 생성 제품의 홍보 흐름은 RefBoard AI 작업 화면과 관계없으므로 차용하지 않는다. 차용 대상은 무드보드의 조합 방식과 편집 원리뿐이다.

### 5.3.1 무드보드의 제품 역할과 1차 완료 기준

무드보드는 보기 좋은 중간 갤러리가 아니라, 이후 섹션 레퍼런스와 컨셉 생성이 읽는 `디자인 결정 보드`다. 따라서 글로벌 방향 3안은 텍스트 카드가 아니라 아래 요소가 결합된 편집 가능한 보드 템플릿으로 제시한다.

- 대표 이미지 1장: 보드의 시각적 초점을 만든다.
- 보조 이미지 2~3장: 피사체, 공간감, 재질, 조명 등 톤의 근거를 보강한다.
- 역할별 팔레트: 실제 색상 스와치와 사용 목적을 함께 보여준다.
- 타이포 견본: 제목과 본문 역할의 예시를 함께 보여준다.
- UI 질감: 선, icon, radius, 대비, 밀도, 정보 위계 같은 웹 디자인 단서를 보여준다.
- 금지 방향: 선택한 보드가 피해야 할 이미지·표현 방향을 명시한다.

1차 구현은 AI가 한 장의 자유형 콜라주 이미지를 생성하는 방식이 아니다. 대표·보조 이미지, 컬러, 타이포, UI 레퍼런스를 검증된 템플릿에 자동 배치하고 사용자가 교체·제외·순서 변경·역할 변경할 수 있게 한다. 이 방식이어야 수정 내용이 확정 브리프와 컨셉 입력까지 안정적으로 추적된다.

무드보드 1차 완료 기준은 다음 네 가지다.

1. 대표 이미지, 보조 이미지, 컬러, 타이포, UI 질감이 한 보드에서 함께 보인다.
2. 이미지를 교체하거나 제외하면 선택 방향과 컨셉 입력에 반영된다.
3. 채택한 실제 웹 레퍼런스는 어느 섹션에 어떤 요소를 적용하는지 연결된다.
4. 모든 이미지를 같은 크기로 나열하지 않고, 역할과 위계에 따라 배치한다.

### 5.4 Inspo AI 검증 상태와 도입 판단

2026-07-18 기준 [Inspo AI 공식 사이트](https://www.inspoai.io/)에서 디자인 검색, 업종·스타일·컬러·폰트 필터, Developer API/MCP 제공 표기는 확인했다. 그러나 실제 구현에 필요한 공식 공개 API 문서, endpoint, 인증 예제, 응답 schema, 썸네일 사용권, API 전용 rate limit은 확인하지 못했다.

따라서 도입 판단은 `조건부 승인`이다.

- 제품 적합성: 고영향 섹션의 실제 웹 디자인 사례 탐색에는 유용할 가능성이 높다.
- 핵심 흐름 적합성: 제공자가 없어도 수행 가능한 보조 기능이어야 한다.
- 기술 확정 상태: vendor 문서와 계약 확인 전에는 spike 외 구현 금지다.
- 비용 판단: 공개 앱 플랜의 검색 횟수를 API 한도로 간주하지 않는다.
- 최종 결정: 기능 플래그가 있는 adapter로만 도입하고, 수동 URL과 기존 플랫폼 링크를 항상 유지한다.

---

## 6. 확정 데이터 계약

### 6.1 편집 상태와 확정 상태를 분리한다

- `ReferenceResult`: 검색, 생성, 편집 중인 전체 작업 상태
- `ConfirmedReferenceBrief`: 사용자가 최종 확정한 결정만 가진 불변 스냅샷
- `ConceptJson.sourceBasis`: 컨셉 생성 시 사용한 `ConfirmedReferenceBrief` 복사본

### 6.2 신규 타입 제안

실제 코드 컨벤션에 맞춰 이름은 조정할 수 있지만 의미는 유지한다.

```typescript
type AdoptionStatus = "applied" | "reference-only" | "excluded";

type AdoptionAspect =
  | "layout"
  | "color"
  | "typography"
  | "image-tone"
  | "interaction"
  | "content-density";

type SectionReferencePriority = "high-impact" | "inherited" | "optional";
type DecisionSource = "user" | "inherited" | "ai";
type Freshness = "current" | "stale";

interface ReferenceCandidate {
  provider: "inspo" | "manual";
  providerId?: string;
  title?: string;
  sourceUrl: string;
  thumbnailUrl?: string;
  patterns: string[];
  colors: string[];
  usage: "inspiration-only";
  fetchedAt: string;
}

interface DecisionMeta {
  source: DecisionSource;
  freshness: Freshness;
  basedOnHash: string;
}

interface WorkflowRevision {
  analysisHash: string;
  directionHash?: string;
  briefHash?: string;
  promptVersion: string;
}

interface ReferenceAdoption {
  adoptionId: string;
  pageId: string;
  sectionId: string;
  reference: ReferenceCandidate;
  status: AdoptionStatus;
  aspects: AdoptionAspect[];
  note: string;
  decision: DecisionMeta;
}

interface DirectionOption {
  directionId: string;
  label: string;
  paletteOptionId: string;
  moodOptionId: string;
  imageCandidates: MoodImage[];
  selectedImageUrls: string[];
  avoidDirections: string[];
}

interface BrandDecision {
  targetId: string;
  name: string;
  adoptedPatterns: string[];
  avoidedPatterns: string[];
  verifiedSources: VerifiedSource[];
}

interface PageReferenceDecision {
  pageId: string;
  pageTitle: string;
  purposeSummary: string;
  sections: Array<{
    sectionId: string;
    sectionTitle: string;
    priority: SectionReferencePriority;
    layoutPattern: string;
    decision: DecisionMeta;
    adoptions: ReferenceAdoption[];
    imageNeed?: ImageNeedDecision;
  }>;
}

interface ConfirmedReferenceBrief {
  version: "2.0";
  confirmedAt: string;
  revision: WorkflowRevision;
  direction: {
    paletteOptionId: string; // 최초 후보의 출처 (어느 팔레트 세트에서 시작했는지)
    editedPaletteOption: PaletteOption; // 사용자가 역할을 재배치한 최종 light/dark 쌍
    paletteMode: "light" | "dark"; // 확정한 기본 모드
    moodId: string;
    moodKeywords: string[];
    typographyDirection: string;
    selectedMoodImages: MoodImage[];
    styleAttributes: MoodOption["styleAttributes"];
    avoidDirections: string[];
  };
  pages: PageReferenceDecision[];
  brandDecisions: BrandDecision[];
}
```

**팔레트 모드 규칙:** `paletteOptionId`만 저장하면 사용자가 역할을 재배치한 편집 결과가 사라진다. 그래서 브리프는 출처(`paletteOptionId`), 편집 결과(`editedPaletteOption`), 확정 모드(`paletteMode`) 세 가지를 모두 보관한다. 컨셉 API에 전달하는 최종 적용 팔레트는 항상 `editedPaletteOption[paletteMode]`로 계산한다.

### 6.2.1 P0 논의로 추가 확정된 타입

문서 초안에서 참조만 되고 정의가 없던 타입 세 가지를 확정한다.

```typescript
// P6 브랜드 분석 출처 검증의 저장 단위. 모델이 JSON에 쓴 sourceUrl 문자열이 아니라
// 이 구조로만 신뢰 상태를 표현한다 (§P6, §3.5).
interface VerifiedSource {
  url: string;
  status: "official" | "supporting" | "unverified";
  groundingCited: boolean; // 실제 Gemini grounding citation 포함 여부
  domainVerified: boolean; // 대상 목록 저장 URL과 host 관계 검증 여부
  fetchedAt: string;
}

// 이미지 생성 결과의 data URL을 워크플로 JSON에 직접 넣지 않는다는 §6.6 규칙을
// 지키기 위해 generatedImageAssetId만 보유한다. 실제 바이너리는 별도 Blob store(IndexedDB)에 둔다.
interface ImageNeedDecision {
  required: boolean;
  role: "hero" | "section" | "icon";
  prompt?: string;
  generatedImageAssetId?: string;
}

// ConceptRequest.analysis에 들어가는 안전 파생 DTO. ProjectAnalysis 전체를
// 그대로 전달하지 않는다(§3.6) — 선택 페이지·확정 섹션의 마스킹 콘텐츠만 포함.
interface SafeConceptAnalysisInput {
  title: string;
  description: string;
  domain: string;
  businessDomains?: string[];
  projectType: string;
  targetUser: string;
  pages: Array<{
    pageId: string;
    pageTitle: string;
    sections: Array<{
      sectionId: string;
      sectionTitle: string;
      contentType: string;
      maskedContent: string;
    }>;
  }>;
}
```

### 6.3 기존 타입 변경

```typescript
interface ReferenceResult {
  // 기존 필드 유지
  directionOptions?: DirectionOption[];
  selectedDirectionId?: string;
  referenceAdoptions?: Record<string, ReferenceAdoption>;
  selectedMoodImageUrls?: string[];
  avoidDirections?: string[];
  confirmedBrief?: ConfirmedReferenceBrief;
  revision?: WorkflowRevision; // 마이그레이션 기간 optional. 신규 확정 브리프 생성 시 builder가 채워 넣는다.
  baseContentVariantId?: string; // §6.7 — 콘텐츠 변형이 2개 이상일 때 사용자가 고른 기준 변형
}

interface ConceptJson {
  projectTitle: string;
  version?: "2.0"; // 없으면 구버전(sourceBasis 없음)으로 취급 — 타입을 나누지 않고 필드로만 구분
  sourceBasis?: ConfirmedReferenceBrief; // 타입은 optional이지만, 컨셉 생성 builder는 version "2.0" 결과에서 이 필드를 필수로 강제한다
  options: ConceptOption[];
  outputSelection: ConceptOutputSelection;
}

// ConceptOption(기존 label, designBasis, conceptKeywords, uiStructure, keyVisual, pages, platforms는 유지)에 추가되는 필드
interface ConceptOptionContentVariantFields {
  basedOnVariantLabel?: string; // 구조 3안 생성에 사용한 "기준" 콘텐츠 변형 라벨로 의미 재정의(§6.7)
  contentVariantMappings?: Record<string, ConceptPage[]>; // key: contentVariantId — 온디맨드로 생성한 비기준 변형의 페이지만 누적
}

interface DesignBasis {
  palette: Palette;
  moodKeywords: string[];
  moodImages: MoodImage[];
  typographyDirection: string;
  avoidDirections: string[];
}
```

**버전 전략을 택한 이유:** `ConceptJsonV1`/`V2`로 타입을 분리하면 기존 fixture(`mockConceptJson`)·테스트 3종·`docs/samples/DESIGN-*.md` 샘플과 Phase 5 소비자 양쪽에 이중 유지 비용이 생긴다. 대신 타입은 하나로 두고 `version` 필드 + 생성 함수 레벨 강제만으로 "기존 데이터 보존"과 "신규 데이터 추적성 강제"를 동시에 만족시킨다. `lib/state/recycle.ts`의 `format + version + 로드 시 normalize` 선례와 같은 패턴이다.

### 6.4 스냅샷 생성 규칙

`레퍼런스 결정 확정`을 누를 때 다음을 수행한다.

1. 선택된 글로벌 방향을 복사한다.
2. `status === "applied"`인 레퍼런스만 페이지 결정에 포함한다.
3. `high-impact` 섹션은 사용자가 확정한 결정을, `inherited` 섹션은 글로벌 방향과 기본 레이아웃에서 파생한 결정을 기록한다.
4. 브랜드 분석은 사용자가 작성하거나 체크한 `가져올 점/피할 점`만 포함한다.
5. 선택되지 않은 검색 결과와 미채택 분석은 제외한다.
6. 원문, 복원 매핑, `Detection.raw`는 포함하지 않는다.
7. 현재 `analysisHash`, `directionHash`, `briefHash`, `promptVersion`을 기록한다.
8. 생성된 스냅샷을 `references.confirmedBrief`에 저장한다.
9. 컨셉 API에는 `analysis`의 안전 파생 DTO와 `confirmedBrief`만 전달한다.

**왜 이렇게 하는가:** 편집 중인 전체 상태와 다음 단계의 확정 입력을 분리해야 미선택 데이터가 결과에 섞이지 않고, 사용자가 무엇을 결정했는지 재현할 수 있다.

### 6.5 하위 결과 무효화 규칙

데이터를 즉시 삭제하지 않고 보존한 채 `freshness: "stale"`로 바꾼다.

Hash는 정렬된 안전 DTO를 canonical JSON으로 직렬화한 뒤 계산한다. `confirmedAt`, cache metadata, `revision.briefHash` 자체는 `briefHash` 입력에서 제외해 순환 의존을 막는다. hash는 변경 감지용이며 민감정보를 안전하게 만드는 수단으로 사용하지 않는다.

| 변경 입력 | 최신 아님으로 표시할 결과 | 보존할 항목 | 사용자 액션 |
|---|---|---|---|
| 선택 페이지/섹션 | 영향받는 페이지 결정, 확정 브리프, 컨셉 | 영향 없는 페이지 결정, 수동 URL | 페이지 결정 재확인 |
| 글로벌 방향 | 검색·이미지 기반 결정, 확정 브리프, 컨셉 | 수동 레퍼런스와 메모 | 방향 적용 재확인 |
| 레퍼런스 채택/브랜드 결정 | 확정 브리프, 컨셉 | 검색 결과와 수동 입력 | 브리프 재확정 |
| 대표 페이지/출력 설정 | 렌더 설정만 변경 | 컨셉 내용 전체 | 재생성 없이 다시 렌더링 |

상위 hash가 현재 값과 일치하지 않는 응답은 화면 상태에 병합하지 않는다. `최신 아님` 항목은 사용자가 재확인하거나 재생성하기 전까지 확정 브리프에 새 입력처럼 포함하지 않는다.

### 6.6 자동 저장 허용 범위

- IndexedDB에 분석 결과의 안전 파생 데이터, 사용자 선택, 채택 메모, 검색 캐시, 확정 브리프를 자동 저장한다.
- 원본 PPT, 추출 원문, 복원 mapping, `Detection.raw`는 저장하지 않는다.
- 생성 이미지의 data URL을 워크플로 JSON에 직접 넣지 않는다. 필요하면 별도 Blob store에 저장하고 id만 참조한다(`ImageNeedDecision.generatedImageAssetId`, §6.2.1).
- 프로젝트를 다시 열 때 저장된 hash를 재계산해 오래된 결과를 구분한다.
- `maskedText`는 기본적으로 자동 저장하지 않는다. 새로고침 후에는 분석 이후 단계(분석·레퍼런스·확정 브리프·컨셉)만 복구되고, 재분석이나 마스킹 재편집이 필요하면 원본을 다시 업로드한다. 컨셉 재생성은 `maskedText` 없이도 `analysis`의 마스킹 콘텐츠(`buildSourceMaterial`)만으로 동작하므로 기능 손실이 없다. UI는 "어디까지 복구되고 어디부터 재업로드가 필요한지"를 명시적으로 안내한다. 완전 복구가 필요해지면 사용자 동의 기반 저장 정책을 별도로 설계한다(현재 범위 아님).

### 6.7 기존 콘텐츠 변형과 컨셉 3안의 관계 (온디맨드 확정)

기존 콘텐츠 변형(`existingContentVariants`, 예: `Main1`/`Main2`/`Main3`처럼 같은 화면의 원고·순서·강조점이 다른 시안)은 컨셉 3안의 디자인 차별화 축으로 사용하지 않는다. 구조·신뢰형/비주얼·몰입형/균형형과 원고 차이가 뒤섞이면, A/B/C안이 다른 이유가 디자인 구조 때문인지 원고 차이 때문인지 구분할 수 없게 된다.

**검토한 대안과 기각 사유**

- 변형별 1:1 매핑(A안=Main1, B안=Main2, C안=Main3): 디자인 축과 원고 축이 뒤섞여 §P9의 3안 정의와 정면 충돌한다.
- 단일 배치로 9개 조합(구조 3안 × 변형 3개) 전부 생성: 호출은 한 번이지만 응답이 커져 파싱 실패 위험이 커지고, 실제로 보지 않을 조합까지 매번 생성한다.

**확정 흐름 — 온디맨드**

1. 콘텐츠 변형이 2개 이상 감지되면 컨셉 생성 전에 기준 변형 하나를 사용자가 선택한다(`baseContentVariantId`). 선택하지 않으면 첫 번째 변형을 기본값으로 하되 사용자가 언제든 바꿀 수 있다.
2. 선택한 기준 변형의 콘텐츠로 동일 글로벌 방향의 구조 3안(구조·신뢰형/비주얼·몰입형/균형형)을 생성한다. `basedOnVariantLabel`에는 이때 사용한 기준 변형 라벨을 기록한다.
3. 사용자가 디자인 안(A/B/C) 하나를 선택한다.
4. 다른 콘텐츠 변형은 선택된 디자인 안에만 온디맨드로 `contentMapping`을 추가 생성한다. 이 요청은 이미 확정된 `uiStructure`, `keyVisual`, `designBasis`, 섹션별 `layoutPattern`을 그대로 재사용하고 다시 생성하지 않는다 — 재생성 대상은 `contentMapping`뿐인 경량 프롬프트다(전체 컨셉 생성 API를 그대로 재호출하지 않는다).
5. 생성 결과는 `ConceptOption.contentVariantMappings[contentVariantId]`에 누적하고, `conceptOptionId + contentVariantId + briefHash` 조합으로 캐시한다. 같은 조합을 다시 요청하면 API를 재호출하지 않는다.

**하지 않는 것**

- 콘텐츠 변형 3개 × 디자인 안 3개 = 9개 조합을 한 번에 배치 생성하지 않는다.
- 온디맨드 요청에서 `uiStructure`/`keyVisual`/`layoutPattern`을 함께 재생성하지 않는다.
- 콘텐츠 변형 선택을 디자인 3안 비교 화면과 같은 단계에 두어 두 결정을 섞지 않는다.

**호출 예산:** 콘텐츠 변형 온디맨드 적용은 사용자 액션당 1회, 캐시 적중 시 0회. 프로젝트 상한은 `(변형 수 − 1) × 선택한 디자인 안 1개` 기준으로 둔다(§P4 호출 효율 기준 표 참고).

---

## 7. 단계별 구현 지시

## P0. 코드 기준선과 스펙 정합성 확정

### 목표

현재 구현을 기준으로 완료된 기능, 수정할 기능, 새로 만들 기능을 구분한다.

### 작업

1. 현재 미커밋 변경을 보존하고 `git status --short`를 기록한다.
2. 다음 파일을 기준으로 실제 흐름을 다시 확인한다.
   - `components/MaskingReview.tsx`
   - `components/reference/ReferenceWorkspace.tsx`
   - `components/reference/PaletteMoodTab.tsx`
   - `components/reference/SectionRefsTab.tsx`
   - `components/reference/TargetsTab.tsx`
   - `components/reference/ImageHintsTab.tsx`
   - `components/concept/ConceptWorkspace.tsx`
   - `components/concept/ConceptPreview.tsx`
   - `lib/reference/types.ts`
   - `lib/reference/platforms.ts`
   - `lib/concept/types.ts`
   - `lib/concept/normalize.ts`
   - `lib/ai/client.ts`
   - 관련 API route 전체
3. `docs/specs/data-model.md`, `docs/design-system-schema.md`, `CLAUDE.md`에 신규 계약을 먼저 반영한다.
4. `designBasis`가 이미 구현된 사실을 스펙과 작업 트래커에 반영한다.
5. 기존 지시서의 `A1~A6` 오기를 `A1~A3` 또는 실제 검증 항목 수로 정정한다.
6. 현재 미커밋 변경 중 `components/MaskingReview.tsx`, `components/reference/SectionRefsTab.tsx`, `lib/masking/entity.ts`(라벨 축약 + 툴팁)는 이번 작업과 무관하므로 검증 후 별도 커밋으로 먼저 분리한다. `app/api/parse/route.ts`의 20MB→200MB 변경은 아래 7번 업로드 구조 결정 전까지 커밋하지 않고 보류한다.
7. 업로드 용량·파싱 위치 구조를 다음 중 하나로 확정한다. Vercel Function 요청 본문 한도(약 4.5MB)에서는 20MB든 200MB든 실제로 보장되지 않는다.
   - (a) pptx는 브라우저 파싱으로 이관하고 pdf만 서버 유지 — CLAUDE.md §4.2 브라우저 파싱 원칙과 가장 정합적인 선행 후보
   - (b) Blob Storage에 직접 업로드 후 서버가 읽기
   - (c) 파싱 API를 Vercel Function이 아닌 별도 런타임에 배치
   - (d) 업로드 한도를 실제 배포 환경 한도에 맞게 축소
8. `VerifiedSource`, `ImageNeedDecision`, `SafeConceptAnalysisInput` 타입을 §6.2.1에 확정 정의한다(P1 착수 전 선행 조건).
9. `ConceptJson.sourceBasis`는 별도 버전 타입(V1/V2) 분리 대신, 단일 타입에 `sourceBasis?` optional 필드와 `version` 필드를 추가하고 생성 함수(builder) 레벨에서 `version === "2.0"`이면 필수로 강제하는 방식으로 마이그레이션한다.
10. 기존 콘텐츠 변형(`existingContentVariants`)을 컨셉 3안의 디자인 차별화 축에서 제외하고, §6.7의 온디맨드 콘텐츠 매핑 규칙으로 역할을 재정의한다.
11. `ImageHint.generatedImageUrl`(data URL)을 `generatedImageAssetId` 참조 + IndexedDB Blob store로 마이그레이션하는 계획을 세운다(실제 구현은 P1).

### 완료 기준

- 이미 구현된 `designBasis`를 다시 만드는 작업이 계획에서 제거된다.
- `ReferenceResult → ConfirmedReferenceBrief → ConceptJson` 흐름이 스펙에 명시된다.
- 구현 대상 파일과 테스트 대상이 확정된다.
- 미커밋 변경이 별도 커밋으로 분리되고, 업로드 용량 변경은 구조 결정과 함께 커밋된다.
- 업로드 파싱 구조(브라우저 이관 여부 포함)가 결정되고 `app/api/parse/route.ts`의 한도가 그 결정과 일치한다.
- `VerifiedSource`, `ImageNeedDecision`, `SafeConceptAnalysisInput` 타입이 확정된다.
- 기존 콘텐츠 변형과 컨셉 3안의 관계가 §6.7 규칙으로 정리된다.

### 왜 먼저 진행하는가

현재 저장소에는 이미 `designBasis`와 실데이터 프리뷰 일부가 구현되어 있다. 이를 확인하지 않고 작업하면 기존 코드를 중복하거나 회귀시킬 가능성이 높다.

---

## P1. 확정 결정 데이터 계약과 상태 안전성 기반 구현

### 목표

사용자가 채택한 디자인 결정이 페이지와 섹션 단위로 저장되고, 되돌아가기·새로고침·비동기 요청 중에도 최신 상태가 보존되도록 한다.

### 작업

1. `ReferenceAdoption`, `BrandDecision`, `PageReferenceDecision`, `ConfirmedReferenceBrief` 타입을 추가한다.
2. `ReferenceResult`에 편집 중인 채택 상태와 확정 브리프를 추가한다.
3. 레퍼런스 확정 함수를 순수 함수로 구현한다.
   - 입력: `ProjectAnalysis`, `ReferenceResult`
   - 출력: `ConfirmedReferenceBrief`
4. 다음 검증을 추가한다.
   - 선택된 팔레트와 무드 존재
   - 선택 이미지 최대 4장
   - 모든 adoption의 `pageId/sectionId`가 분석 결과에 존재
   - 제외한 레퍼런스가 브리프에 포함되지 않음
   - 민감 원문 필드가 포함되지 않음
   - 최종 적용 팔레트는 `editedPaletteOption[paletteMode]`로 계산해 스냅샷한다(§6.2 팔레트 모드 규칙)
5. `ConceptJson`에 `sourceBasis`(optional) + `version: "2.0"`을 추가하고, 컨셉 생성 builder 함수에서 `version === "2.0"`이면 `sourceBasis`를 필수로 강제한다(타입 자체는 분리하지 않는다, §6.3).
6. 워크플로 상태 업데이트를 reducer/action 기반 원자적 패치로 변경한다.
   - 페이지 결정 패치
   - 방향 선택 패치
   - 레퍼런스 채택 패치
   - 비동기 검색 결과 병합
7. `analysisHash`, `directionHash`, `briefHash`, `promptVersion`을 계산하고 6.5의 무효화 규칙을 구현한다.
8. 각 비동기 요청에 `AbortController`, `requestId`, 요청 기준 hash를 연결한다.
9. 안전한 워크플로 상태를 IndexedDB에 자동 저장하고 복구한다(`maskedText`는 제외 — §6.6).
10. `VerifiedSource`, `ImageNeedDecision`, `SafeConceptAnalysisInput` 타입을 §6.2.1대로 구현한다.
11. `ImageHint.generatedImageUrl`(data URL)을 제거하고 `generatedImageAssetId` + IndexedDB Blob store로 마이그레이션한다. 기존 저장 데이터가 있으면 로드 시 1회 변환한다.
12. §6.7의 온디맨드 콘텐츠 매핑 생성 함수와 `conceptOptionId + contentVariantId + briefHash` 캐시를 구현한다.

### 테스트

- 적용/참고/제외 상태별 스냅샷 테스트
- 존재하지 않는 pageId/sectionId 차단 테스트
- 선택하지 않은 레퍼런스가 브리프에서 제외되는 테스트
- 마스킹 토큰은 유지되고 원문/복원 매핑은 포함되지 않는 테스트
- 늦게 도착한 이전 방향의 이미지 응답이 최신 상태를 덮어쓰지 않는 테스트
- 상위 결정 변경 시 하위 결과가 삭제되지 않고 `stale`로 전환되는 테스트
- 자동 저장 데이터에 원문, 복원 mapping, `Detection.raw`, `maskedText`가 없는 테스트
- `editedPaletteOption[paletteMode]` 계산이 역할 재배치 편집 결과를 반영하는 테스트
- `version` 없는 구버전 `ConceptJson`을 builder가 그대로 통과시키고, `version: "2.0"` 생성 시 `sourceBasis` 누락이면 throw하는 테스트
- 동일 `conceptOptionId + contentVariantId + briefHash` 재요청이 캐시를 재사용하고 API를 재호출하지 않는 테스트

### 완료 기준

- 같은 입력과 선택 상태에서 동일한 `ConfirmedReferenceBrief`가 생성된다.
- 컨셉 단계가 전체 `ReferenceResult` 없이 확정 브리프만으로 필요한 결정을 받을 수 있다.
- 새로고침 후 안전한 선택 상태가 복구되고 오래된 결과는 `최신 아님`으로 표시된다.

### 왜 이 단계가 가장 중요한가

UI를 먼저 바꾸면 채택 상태를 임시 컴포넌트 state로 만들게 되고, 이후 컨셉 연결 시 다시 구조를 바꿔야 한다. 먼저 데이터 계약을 확정해야 모든 화면이 같은 의미를 공유한다.

---

## P2. 마스킹 검수 화면 개선

### 목표

전체 문서를 다시 읽는 화면에서, 위험 항목과 적용 결과를 빠르게 확인하는 화면으로 전환한다.

### 작업

1. 상단 상태를 다음 네 가지로 분리한다.
   - 탐지됨
   - 마스킹 적용
   - 공개 유지
   - 제외
2. `공개 유지`와 `제외`를 무조건 경고로 표시하지 않는다.
3. 다음 경우에만 경고 상태를 사용한다.
   - 불확실 탐지인데 공개 유지됨
   - 검토되지 않은 항목이 존재함
   - 이미지 전용 입력인데 분석 요약이 없음
4. 토큰별 컨텍스트 요약을 추가한다.
   - 토큰
   - 정보 종류
   - 발생 슬라이드
   - 발생 횟수
   - 마스킹된 주변 문장
5. 확정 후 전체 텍스트는 기본 닫힘 아코디언으로 이동한다.
6. `마스킹본 TXT 다운로드`를 클라이언트에서 제공한다.
7. 기존 그룹 요약은 상단 요약과 토큰 카드에 통합하고 중복 장문을 제거한다.

### 안전한 컨텍스트 생성 규칙

- 확정 전에 원문 위치를 기준으로 문맥을 추출한다.
- 저장할 때는 해당 문맥에도 동일한 마스킹을 적용한다.
- 확정 후에는 마스킹된 excerpt만 남기고 원문 위치와 raw 값은 폐기한다.

### 이미지 분석 정리

- 슬라이드별 그룹과 전체 선택을 제공한다.
- 작은 이미지나 아이콘을 자동 제외하지 않고 `장식 가능성 높음` 접힘 그룹으로만 분류한다.
- 사용자가 언제든 분석 대상으로 다시 포함할 수 있어야 한다.
- 선택 상태 변경 시 이전 분석 에러를 초기화한다.

### 완료 기준

- 확정 후 첫 화면에 전체 마스킹 텍스트가 노출되지 않는다.
- 사용자는 어떤 토큰이 어디에 적용됐는지 전체 문서를 읽지 않고 확인할 수 있다.
- 의도적인 공개 유지가 오류처럼 보이지 않는다.

### 왜 이렇게 진행하는가

마스킹 검수의 목적은 텍스트 열람이 아니라 외부 전송 전 위험 판단이다. 요약과 문맥을 먼저 보여주고 전체 문서는 필요할 때만 열어야 검수 속도와 신뢰도가 함께 올라간다.

---

## P3. 글로벌 디자인 방향 보드 구현

### 목표

팔레트, 타이포, 이미지, 스타일 규칙을 하나의 비교 가능한 방향안으로 보여준다.

### 작업

1. `DirectionOption`을 도입하고 방향 옵션 1개를 다음 요소가 조합된 무드보드 템플릿으로 렌더링한다.
   - 방향명과 한 줄 설명
   - 팔레트 역할 6개
   - 제목/본문 타이포 샘플
   - 이미지 후보 최대 6장, 선택 최대 4장
   - 키워드 최대 5개
   - radius/density/contrast
   - 추천 방향과 금지 방향
   - 방향 3안을 비교한 뒤 정확히 1안을 선택하는 액션
   - 대표 이미지 1장, 보조 이미지 2~3장, 컬러, 타이포, UI 질감의 위계 있는 배치
2. 팔레트 옵션과 무드 옵션을 독립 선택하지 않고 `DirectionOption`에서 1:1로 연결한다.
   - `/api/mood`는 현재 팔레트 후보의 id와 역할 색상을 입력으로 받는다.
   - 각 무드 옵션은 `paletteOptionId`를 하나 선택해 반환한다.
   - 세 방향이 가능한 한 서로 다른 팔레트 후보를 사용하도록 정규화한다.
   - 사용자가 팔레트만 바꾸면 해당 방향 카드의 이미지 검색 색상도 함께 갱신한다.
3. 이미지마다 선택, 제외, 교체 상태를 제공한다.
   - 역할: 대표, 보조, 디테일, 텍스처, 레이아웃
   - 선택 이미지의 순서 변경
4. 다시 생성 시 다음 제어를 제공한다.
   - 검색어 편집
   - 컬러 유지
   - 피사체 유지
   - 제외 키워드 추가
5. 선택 결과는 `selectedDirectionId`, `selectedMoodImageUrls`, `avoidDirections`에 즉시 반영한다.
6. 이미지 교체·제외·역할 변경은 해당 `DirectionOption`과 이후 `ConfirmedReferenceBrief` 입력에 반영한다.
7. 채택한 실제 웹 레퍼런스는 고영향 섹션의 적용 요소와 연결하고, 무드보드에서는 레이아웃 또는 UI 질감 단서로 표시한다.

### 완료 기준

- 사용자가 카드 하나만 봐도 컬러와 이미지가 결합된 전체 방향을 이해할 수 있다.
- 무드 이미지 전체가 자동 채택되지 않고 최대 4장만 명시적으로 선택된다.
- 같은 고정 프롬프트를 반복 호출하는 `다시 생성`이 사라진다.
- 메인 히어로, 서브 페이지, 브랜드 톤 등 목적에 맞는 보드 템플릿이 적용된다.
- 대표·보조 이미지, 팔레트, 타이포, UI 질감이 같은 보드 안에서 역할과 위계를 갖고 보인다.
- 무드보드에서 바꾼 선택이 확정 브리프와 컨셉 요청에 추적된다.

### 왜 이렇게 진행하는가

디자이너가 판단하는 것은 개별 색상이나 사진이 아니라 조합에서 생기는 인상이다. 요소를 분리해 고르면 서로 어울리지 않는 선택이 생기므로 최소한 화면과 확정 데이터에서는 하나의 방향으로 묶어야 한다.

---

## P4. 검색어와 이미지 검색 파이프라인 분리

### 목표

UI 레퍼런스 검색과 사진 소재 검색이 서로 다른 언어와 제공자 규칙을 사용하도록 한다.

### 데이터 구조

```typescript
interface SectionQueryIntent {
  axis: "pattern" | "mood" | "industry";
  label: string;
  query: string;
}

interface SectionQuerySet {
  designIntents: SectionQueryIntent[];
  imageQueries: string[];
}
```

### 작업

1. 디자인 검색어는 다음 3개 의도 축으로 생성한다.
   - 패턴축: layoutPattern 중심
   - 무드축: 확정 무드 중심
   - 업종축: 도메인과 비즈니스 업종 중심
2. 플랫폼마다 3개씩 생성하지 않는다.
3. 사용자가 의도 축 하나를 선택하면 관련도 상위 3~5개 플랫폼의 검색 액션을 보여준다.
4. 나머지 플랫폼은 `더 보기`에 둔다.
5. 이미지 검색어에는 UI 용어를 넣지 않는다.
   - 금지: hero, section, card, grid, layout, website, page, dashboard
   - 허용: 피사체, 환경, 재질, 색상, 조명, 분위기
6. Unsplash와 Pexels 요청 DTO를 분리한다.
   - Unsplash: 지원되는 제한 색상 이름으로 매핑
   - Pexels: 지원 색상 이름 또는 hex 사용
7. 결과는 후보 최대 8장, 확정 최대 4장으로 제한한다.
8. 쿼리와 결과를 세션 캐시해 동일 요청을 반복하지 않는다.

### Inspo AI 처리

- 역할은 `선택형 디자인 레퍼런스 공급자`로 한정한다.
- Unsplash/Pexels의 사진 소재 검색, 브랜드 공식 출처 검증, 컨셉 생성을 대체하지 않는다.
- 사용자가 `디자인 사례 찾기`를 실행한 고영향 섹션에서만 호출한다.
- 실제 API 문서가 공개 확인되지 않은 상태에서 endpoint, 일일 15회, `uxPatterns`, `colors`, `thumbnail`을 확정 계약처럼 하드코딩하지 않는다.
- 구현 전 별도 vendor spike에서 다음을 확인한다.
  - 공식 문서와 endpoint, 인증 방식, 응답 schema
  - 요금, rate limit, 상업적 사용 조건
  - 썸네일 저장·프록시·hotlink 허용 범위
  - 전송 데이터의 보관, 로깅, 개인정보 정책
  - SLA, 장애 응답, 계약 변경 정책
- 검증 성공 시 `InspoClient` 어댑터와 기능 플래그를 추가하고 응답을 `ReferenceCandidate`로 정규화한다.
- `patterns`와 `colors`는 선택 필드처럼 취급해 누락 시 빈 배열로 정규화한다.
- 모든 항목은 `usage: "inspiration-only"`, 원본 `sourceUrl`, `fetchedAt`을 보존한다.
- 썸네일은 PPT/PDF/컨셉 결과에 자동 삽입하지 않는다.
- 프로젝트당 기본 3회, 최대 5회까지만 허용하며 vendor 계약 확인 후 설정으로 조정한다.
- 검색 입력은 업종, 패턴, 무드 같은 일반화된 intent만 사용한다. 전체 `maskedText`, 회사 토큰, 문서 문장과 수치를 보내지 않는다.
- 실패, 미설정, 한도 초과 시 플랫폼 검색 링크와 수동 URL 입력으로 즉시 fallback한다.

### 호출 효율 기준

| 기능 | 기본 호출 정책 | 프로젝트 기준 상한 |
|---|---|---|
| Gemini 분석 | 업로드 후 명시적 분석 | 1회 + 실패 재시도 |
| 선택 이미지 OCR/분석 | 사용자가 고른 이미지만 batch 처리 | 선택 시 1회 + 실패 재시도 |
| Gemini 글로벌 방향 | 분석 결과 기준 batch 생성 | 1회 + 사용자 재생성 |
| 사진 검색 | 방향안별 대표 query | 약 3회 |
| 섹션 검색어 | 로컬 intent 조합 | AI 0회, 선택적 향상 1회 |
| Inspo AI | 고영향 섹션에서 사용자 실행 | 기본 3회, 최대 5회 |
| 브랜드 목록 | 선택 기능 | 최대 1회 |
| 브랜드 심층 분석 | 사용자가 고른 대상 | 최대 3개 |
| 이미지 힌트 | 로컬 템플릿 | 선택적 batch AI 1회 |
| 이미지 생성 | 명시적 opt-in | 최대 3장 |
| Gemini 컨셉 | 확정 브리프 기준 batch 생성 | 1회 + 사용자 재생성 |
| 콘텐츠 변형 온디맨드 적용 | 사용자가 선택한 디자인 안 + 비기준 변형 조합만 생성 (§6.7) | 사용자 액션당 1회, 캐시 적중 시 0회 · 프로젝트 상한 (변형 수−1)×선택 안 1개 |

동일 provider + 정규화 query + filter 조합은 캐시하고, debounce와 in-flight dedupe로 중복 요청을 막는다. 프로젝트 예산을 초과하면 자동 호출하지 않고 사용자가 어떤 기능을 실행하면 추가 호출이 발생하는지 먼저 보여준다.

이미지 OCR/분석, 브랜드 분석, 이미지 힌트, 이미지 생성은 선택 기능이므로 핵심 3회 기준에 포함하지 않는다. 다만 실제 실행 시에는 동일 프로젝트 예산과 서버 rate limit에 합산한다.

### 완료 기준

- 사진 API 요청에 UI 레이아웃 용어가 포함되지 않는다.
- `cinematic hero section`이 그대로 사진 API에 전달되지 않는다.
- 섹션 하나에 수십 개 링크가 동시에 노출되지 않는다.
- Inspo AI가 없어도 레퍼런스 확정과 컨셉 생성까지 완료할 수 있다.
- 같은 검색을 연속 실행해도 provider 호출은 한 번만 발생한다.

### 왜 이렇게 진행하는가

디자인 플랫폼은 레이아웃과 인터랙션 언어를 이해하지만 사진 API는 피사체와 태그를 중심으로 검색한다. 두 검색을 같은 쿼리로 처리하면 제공자 특성상 잘못된 결과가 반복될 수밖에 없다.

---

## P5. 페이지별 디자인 보드와 레퍼런스 채택 구현

### 목표

설계서에서 선택한 메인/서브 페이지를 기준으로 레퍼런스를 정리하고, 클릭한 결정이 즉시 적용 패널에 반영되도록 한다.

### 작업

1. `confirmedSections.flatMap` 기반 단일 목록을 페이지별 그룹 구조로 변경한다.
2. 왼쪽 페이지 내비게이션을 추가한다.
3. 중앙에는 현재 선택 페이지 하나만 집중해서 보여준다.
4. 페이지 상단에 설계 실데이터를 표시한다.
   - 페이지 목적
   - 핵심 대상
   - 선택 섹션 수
   - 핵심 콘텐츠 요약
5. 섹션마다 레퍼런스 처리 우선순위를 지정한다.
   - `고영향`: 심층 레퍼런스 탐색과 명시적 적용 결정 필요
   - `상속`: 글로벌 방향과 기본 layoutPattern을 자동 적용
   - `선택`: 필요할 때만 탐색하며 미사용이어도 진행 가능
6. AI는 히어로, 핵심 기능, 데이터 시각화 등 3~5개를 고영향 후보로 추천하되 사용자가 변경할 수 있게 한다.
7. 고영향 섹션에서만 Inspo/플랫폼 심층 탐색 CTA를 기본 노출한다.
8. 섹션별 레퍼런스 카드에 다음 액션을 추가한다.
   - 적용
   - 참고만
   - 제외
9. `적용` 시 가져올 요소를 선택한다.
   - 레이아웃
   - 컬러
   - 타이포
   - 이미지 톤
   - 인터랙션
   - 정보 밀도
10. 적용 메모를 작성할 수 있게 한다.
11. 각 결정에 `source: user | inherited | ai`를 저장하고 화면에서 구분한다.
12. 적용 결과는 오른쪽 결정 패널에 즉시 반영한다.
13. 같은 레퍼런스를 여러 섹션에 적용할 경우 adoption을 섹션별로 분리한다.
14. URL 붙여넣기 시 OG 미리보기를 제공하되 실패하면 텍스트 링크로 유지한다.

### 완료 기준

- 메인 페이지와 서브 페이지의 섹션이 섞이지 않는다.
- 사용자가 레퍼런스에서 무엇을 가져오는지 데이터로 확인할 수 있다.
- 적용 해제 시 결정 패널과 확정 브리프에서 즉시 제거된다.
- 검색 결과를 많이 생성하지 않아도 수동 URL로 동일한 채택 흐름을 사용할 수 있다.
- 13개 이상의 섹션이 있어도 심층 검토 대상은 기본 3~5개로 제한된다.
- 상속 섹션은 왜 해당 방향과 레이아웃이 적용됐는지 확인하고 필요하면 고영향으로 승격할 수 있다.

### 왜 이렇게 진행하는가

검색 결과 자체는 디자인 결정이 아니다. `어느 섹션에 무엇을 적용할지`가 있어야 컨셉 생성기가 레퍼런스를 실제 방향으로 사용할 수 있다.

---

## P6. 브랜드 분석 출처와 채택 구조 개선

### 목표

브랜드 분석을 검증 가능한 근거와 실제 적용 결정으로 전환한다.

### 작업

1. `generateGroundedJson`이 다음을 함께 반환하도록 변경한다.

```typescript
interface GroundedResult<T> {
  data: T;
  sources: Array<{
    url: string;
    title?: string;
    supportText?: string;
  }>;
}
```

2. Gemini 응답의 실제 grounding metadata에서 URL을 수집한다.
3. 모델이 JSON에 작성한 `sourceUrl`은 참고값으로만 취급한다.
4. 출처를 다음 상태로 구분한다.
   - `official`: 분석 대상의 공식 페이지
   - `supporting`: 주장을 뒷받침하는 기사/문서
   - `unverified`: 실제 grounding이나 도메인 관계를 확인하지 못함
5. 공식 페이지 검증은 다음을 조합한다.
   - 대상 목록에 저장된 URL과 host 관계
   - grounding citation 포함 여부
   - 안전한 서버 fetch 성공 여부
6. OG title의 브랜드명 일치만을 절대 조건으로 사용하지 않는다.
   - 다국어 제목, 모회사명, 제품명 때문에 정상 페이지가 실패할 수 있다.
7. OG 조회는 기존 SSRF 방어 로직을 재사용하거나 공용 안전 fetch helper로 통합한다.
   - private/loopback/link-local 차단
   - redirect 단계마다 재검증
   - timeout
   - 최대 응답 크기
   - content-type 제한
8. 분석 UI는 다음 순서로 표시한다.
   - 공식 사이트 썸네일/링크
   - 출처 검증 상태
   - 우리 프로젝트에서 가져올 점
   - 피할 점
   - 상세 7개 분석축은 기본 접힘
9. 사용자가 `가져올 점`과 `피할 점`을 직접 선택/편집하게 한다.

### 완료 기준

- 실제 grounding citation에 없는 URL이 검증 출처로 표시되지 않는다.
- 관련 없는 기사 하나가 브랜드 공식 출처처럼 보이지 않는다.
- 출처 미확인 분석은 기본 접힘과 회색 상태로 표시된다.
- 컨셉에는 사용자가 확정한 가져올 점/피할 점만 전달된다.

### 왜 이렇게 진행하는가

프롬프트에서 공식 URL만 요구해도 모델은 잘못된 URL을 만들 수 있다. 신뢰는 문장 지시가 아니라 실제 citation과 서버 검증으로 만들어야 한다.

---

## P7. 대표 페이지와 이미지 필요 영역 재구성

### 목표

대표 페이지 선택을 출력 역할과 연결하고, 이미지 힌트를 페이지별 실제 필요 영역에서 생성한다.

### 작업

1. 내부 데이터는 시각 대표와 내용 대표 두 필드를 유지한다.
2. UI 라벨을 다음처럼 변경한다.
   - `표지·키비주얼 기준 페이지`
   - `본문 레이아웃 기준 페이지`
3. 같은 페이지가 추천되는 것을 오류로 취급하지 않는다.
4. 추천 이유를 한 줄로 보여준다.
5. 두 값이 같으면 기본 UI를 하나로 접고 `역할별로 다르게 지정` 옵션을 제공한다.
6. 페이지 수가 3개 이하라는 이유만으로 내부 역할을 합치지 않는다.
7. 이미지 힌트는 다음 조건을 만족한 섹션에서만 생성한다.
   - 페이지와 섹션이 확정됨
   - `새 이미지 필요`가 선택됨
   - 글로벌 무드와 팔레트가 확정됨
8. 이미지 힌트 프롬프트 편집 기능을 제공한다.
9. 재생성 시 고정 프롬프트를 다시 보내지 않고 사용자의 편집값과 제외 방향을 반영한다.

### 완료 기준

- 대표 페이지가 실제 표지와 본문 프리뷰 역할에 연결된다.
- 사용자는 동일 추천의 이유를 이해하고 필요할 때만 분리한다.
- 이미지 힌트가 관계없는 모든 섹션에 일괄 생성되지 않는다.

### 왜 이렇게 진행하는가

대표 역할의 차이는 페이지 개수가 아니라 출력 목적에서 생긴다. UI는 단순화할 수 있지만 데이터 의미를 없애면 이후 PPT/PDF 구성에서 다시 문제가 생긴다.

---

## P8. 확정 검토와 ConfirmedReferenceBrief 생성

### 목표

다음 단계로 넘어가기 전에 사용자가 실제 반영될 결정을 한 화면에서 검토한다.

### 작업

1. 레퍼런스 단계의 마지막에 `결정 검토` 화면을 추가한다.
2. 다음 내용을 요약한다.
   - 글로벌 방향
   - 선택 이미지
   - 페이지별 레이아웃
   - 섹션별 적용 레퍼런스
   - 브랜드 가져올 점/피할 점
   - 이미지 필요 영역
3. 미결정 상태를 구분한다.
   - 필수 미결정: 다음 단계 차단
   - 선택 기능 미사용: 진행 가능
   - 최신 아님: 이전 결과는 보존되지만 재확인 필요
4. 필수 조건은 다음으로 제한한다.
   - 팔레트와 무드 확정
   - 글로벌 방향 1안 확정
   - 고영향 섹션 3~5개의 layoutPattern 또는 명시적 적용 결정 존재
   - 나머지 필수 섹션은 상속 결정 또는 사용자 결정 존재
   - 출처 미확인 항목을 사용자가 인지하거나 제외함
5. 레퍼런스 수집과 브랜드 분석 자체를 의무화하지 않는다.
6. 확정 시 P1의 순수 함수로 `ConfirmedReferenceBrief`를 생성한다.
7. 현재 hash와 다른 `stale` 결정을 브리프에 넣으려 하면 재확인 대상을 보여주고 확정을 차단한다.

### 완료 기준

- 다음 버튼을 누르기 전에 실제 컨셉 입력이 무엇인지 볼 수 있다.
- 선택 기능을 사용하지 않았다는 이유로 불필요하게 진행이 막히지 않는다.
- 확정 후 편집 상태가 바뀌어도 이미 생성된 컨셉의 `sourceBasis`는 변하지 않는다.
- 모든 섹션을 개별 심층 분석하지 않아도 상속 근거가 있으면 진행할 수 있다.

### 왜 이렇게 진행하는가

모든 탭 사용을 강제하면 제품이 무거워지고, 아무 검토 없이 넘어가게 하면 선택이 누락된다. 필수 결정과 선택 도구를 구분하는 검토 단계가 필요하다.

---

## P9. 컨셉 생성 입력과 프리뷰 개선

### 목표

설계 실데이터와 확정 레퍼런스 결정을 결합해 컨셉 3안을 만들고, 프리뷰에서 그 차이를 확인한다.

### API 입력 변경

현재의 개별 입력인 `paletteOption`, `moodKeywords`, `layoutBySection`, `targetImplications`를 장기적으로 제거하고 다음 계약으로 통합한다.

```typescript
interface ConceptRequest {
  analysis: SafeConceptAnalysisInput;
  directives: ProjectDirective[];
  referenceBrief: ConfirmedReferenceBrief;
  representative: RepresentativePages;
  baseContentVariantId?: string; // §6.7 — 콘텐츠 변형이 있을 때 구조 3안 생성에 쓸 기준 변형. 기존 useVariants(1:1 매핑 플래그)는 폐기한다.
}

// 온디맨드 콘텐츠 매핑 전용 — 구조 3안 생성 API와 별도 경량 요청
interface ContentVariantMappingRequest {
  conceptOptionId: string;
  contentVariantId: string;
  briefHash: string; // 캐시 키의 일부 — 동일 조합 재요청 시 API를 재호출하지 않는다
}
```

### 작업

1. API route에서 `referenceBrief`의 pageId/sectionId를 분석 결과와 교차 검증한다.
2. 프롬프트에는 다음만 전달한다.
   - 선택 페이지와 확정 섹션의 마스킹 콘텐츠
   - 확정 글로벌 방향
   - `applied` 레퍼런스의 적용 요소와 메모
   - 확정 브랜드 가져올 점/피할 점
   - 이미지 필요 영역과 선택 이미지
3. URL과 썸네일 전체를 무조건 모델에 전달하지 않는다.
4. 레퍼런스에서 파생한 적용 메모를 우선 사용한다.
5. `normalizeConcept`가 `sourceBasis`와 옵션별 `designBasis`를 스냅샷한다.
6. `DesignBasis`에 선택 무드 이미지와 금지 방향을 추가한다.
7. `ConceptPreview`의 layout renderer를 실제 콘텐츠 기반으로 변경한다.
   - card-grid: maskedContent를 항목 단위로 분리
   - stat-band: 분석 결과에서 수치/라벨을 매핑
   - hero: 선택 키비주얼 또는 이미지 방향 적용
   - tech-stack-diagram: 실제 항목명 배치
   - carousel/marquee: 실제 섹션 항목 사용
8. 데이터가 구조화되지 않은 경우에만 명시적인 `데이터 없음` 상태를 표시한다.
9. `카드 1/2/3`, `지표 1/2/3` 문자열을 제거한다.
10. 세 컨셉의 차이를 다음 축으로 명확히 만든다.
    - `구조·신뢰형`: 정보 위계, 설명 가능성, 안정적인 구조를 우선
    - `비주얼·몰입형`: 대표 이미지, 공간감, 인터랙션 인상을 우선
    - `균형형`: 정보 전달과 시각적 몰입을 균형 있게 적용
11. 세 안은 서로 다른 글로벌 무드가 아니다. 확정 팔레트, 무드, 금지 방향, 필수 콘텐츠는 공통으로 유지한다.
12. 차이는 정보 밀도, 레이아웃 대담함, 이미지 사용 방식, 인터랙션 강조도에서 만든다.
13. 대표 페이지나 PPT/PDF 출력 설정 변경은 컨셉 재생성을 호출하지 않고 렌더 설정만 변경한다.
14. `useVariants`/`existingContentVariants`를 3안 생성 프롬프트의 1:1 매핑 축(현재 `app/api/concept/route.ts`의 `variantBlock`)으로 사용하지 않는다. 콘텐츠 변형이 2개 이상 감지되면 3안 생성 전에 기준 변형을 선택하는 UI 단계를 추가하고, 이후 §6.7의 온디맨드 규칙을 따른다.

### 완료 기준

- 프리뷰에 실제 마스킹 콘텐츠가 카드와 지표 내부에 배치된다.
- 선택 이미지가 히어로나 지정 이미지 영역에 표시된다.
- 적용 레퍼런스 메모가 생성 프롬프트와 `ConceptJson.sourceBasis`에서 추적된다.
- 미채택 레퍼런스는 결과에 영향을 주지 않는다.
- 컨셉 3안이 동일한 와이어프레임의 색상 변형으로 보이지 않는다.
- 세 안 모두 사용자가 고른 동일 글로벌 방향의 적용 변형임을 화면에서 명확히 알 수 있다.

### 왜 이렇게 진행하는가

현재 컨셉 단계는 데이터가 전혀 없는 상태가 아니라, 일부 데이터만 사용하고 renderer가 이를 충분히 표현하지 못하는 상태다. 입력 계약과 렌더러를 함께 바꿔야 결과가 실제로 달라진다.

---

## P10. 구조 정리, 호출 예산, 실패 격리, 관측성

### 목표

기능이 안정된 뒤 중복 로직을 정리하고 외부 서비스 실패나 호출 폭증이 전체 단계를 막지 않게 한다.

### 방침

- 처음부터 대규모 `PipelineSkill` 구조로 재작성하지 않는다.
- P1~P9 구현 과정에서 실제로 반복되는 경계만 모듈화한다.
- 별도 Aggregator AI 호출은 추가하지 않는다.

### 권장 모듈 경계

```text
lib/reference/
  confirmBrief.ts       # 확정 스냅샷 생성
  queryIntents.ts       # 디자인/이미지 쿼리 생성
  sourceVerification.ts # 출처 상태 판정
  imageSearch.ts        # 제공자별 검색 DTO/정규화
  adoption.ts           # 채택 상태 업데이트 순수 함수
  invalidation.ts       # hash와 최신성 판정
  providerBudget.ts     # 프로젝트 호출 예산과 rate limit 상태
  persistence.ts        # 안전 상태 IndexedDB 저장
```

### 부분 실패 규칙

- 무드 이미지 실패: 텍스트 방향과 팔레트 편집은 계속 가능
- 플랫폼 검색 실패: 수동 URL 입력 가능
- 브랜드 분석 실패: 해당 대상만 재시도
- OG fetch 실패: 텍스트 링크 유지
- 이미지 생성 실패: 프롬프트 복사 가능
- 컨셉 생성 실패: 확정 브리프는 보존

### 캐시 규칙

- 무드 이미지: provider + query + color + orientation
- 플랫폼 검색: provider + query intent
- 브랜드 분석: normalized target URL + project domain + prompt version
- OG 메타: normalized URL

### 비동기 안전 규칙

- 동일 cache key의 실행 중 요청은 하나의 Promise를 공유한다.
- 새 요청이 이전 요청을 대체하면 `AbortController`로 이전 요청을 취소한다.
- 취소할 수 없는 제공자는 응답의 requestId와 기준 hash가 현재 상태와 일치할 때만 병합한다.
- 컴포넌트가 `ReferenceResult` 전체를 캡처해 되쓰지 않도록 reducer action 또는 필드 단위 updater만 허용한다.
- 탭 이동과 방향 변경 중 도착한 늦은 응답이 최신 선택을 덮어쓰지 않는 통합 테스트를 둔다.

### 서버 호출 제한

- provider별 서버 rate limit과 프로젝트별 요청 예산을 함께 적용한다.
- 클라이언트 제한만 신뢰하지 않는다.
- 429 응답은 재시도 가능 시점과 대체 경로를 반환한다.
- 자동 재시도는 지수 backoff와 짧은 상한을 두고, 동일 작업을 무한 반복하지 않는다.
- Gemini 보조 키 fallback은 전체 제품 예산을 우회하는 수단으로 사용하지 않는다.

### 관측성과 개인정보 보호

다음 운영 지표만 구조화해 기록한다.

- provider별 호출 수, 성공/실패, latency
- cache hit와 in-flight dedupe 횟수
- rate limit 잔여 상태와 프로젝트 예산 사용량
- stale 응답 폐기 횟수와 오류 코드

프롬프트 전문, 문서 문장, 마스킹 전후 콘텐츠, 회사 토큰, 사용자 메모는 로그에 남기지 않는다. 요청 상관관계는 비식별 project/request id로만 추적한다.

### 라이선스·출처 메타데이터

- 모든 외부 후보에 provider, sourceUrl, usage, fetchedAt을 저장한다.
- Inspo 후보는 항상 `inspiration-only`이며 결과물에 자동 삽입하지 않는다.
- Unsplash/Pexels는 각 제공자의 attribution과 source metadata를 보존한다.
- 수동 URL도 출처 링크를 필수로 하고 썸네일 권한이 불명확하면 링크 카드만 표시한다.

### 완료 기준

- 한 외부 모듈의 실패가 레퍼런스 단계 전체를 초기화하지 않는다.
- 동일 입력에 대한 불필요한 AI/API 재호출이 없다.
- 재시도 버튼은 실패한 모듈에만 표시된다.
- 프로젝트 예산을 넘는 자동 호출이 서버에서 차단된다.
- 제공자 호출·실패·캐시 적중을 민감 내용 없이 확인할 수 있다.
- 늦은 비동기 응답이 최신 사용자 결정을 덮어쓰지 않는다.

### 왜 마지막에 진행하는가

사용자 결정 흐름이 확정되기 전에 구조부터 크게 바꾸면 잘못된 경계를 고정하게 된다. 먼저 실제 동작을 완성하고 반복되는 로직을 확인한 뒤 모듈화하는 편이 안전하다.

---

## 8. 보안 및 외부 전송 불변 제약

1. Gemini에 전달되는 콘텐츠는 마스킹된 분석 데이터와 확정 브리프의 안전 필드로 제한한다.
2. `parsedText`, 복원 mapping, `Detection.raw`, 원문 컨텍스트는 네트워크 요청과 로그에 포함하지 않는다.
3. 공개 브랜드명과 공개 URL은 별도 출처 데이터로 전달할 수 있지만, 사용자 문서에서 추출한 비공개 정보와 구분한다.
4. 모든 API 키는 서버 전용 환경변수로 유지한다.
5. 외부 URL fetch는 공용 SSRF 방어 helper를 반드시 통과한다.
6. 외부 디자인 검색에는 일반화된 업종, 패턴, 무드 intent만 전달한다.
7. 프로젝트명 토큰, 마스킹 텍스트, 문서 문장, 수치, 사용자 메모는 Inspo를 포함한 검색 제공자에 전달하지 않는다.
8. 운영 로그에는 provider, 비식별 request id, 상태 코드, latency, cache 여부만 기록하고 prompt/content 필드는 기록하지 않는다.
9. redirect를 자동 follow하지 않고 각 hop을 검증한다.
10. 외부 API 에러 본문을 그대로 클라이언트에 반환하지 않는다.
11. 실명 복원은 기존대로 클라이언트 메모리에서만 수행한다.
12. `ConceptJson.sourceBasis`에는 마스킹본과 공개 출처만 저장한다.

---

## 9. 하지 말아야 할 것

- 이미 구현된 `designBasis`를 처음부터 다시 만들지 않는다.
- 팔레트와 무드만 선택하면 모든 레퍼런스 결정이 완료된 것으로 처리하지 않는다.
- 플랫폼마다 3개 쿼리를 전부 펼쳐 수백 개 링크를 만들지 않는다.
- 모델이 JSON에 쓴 URL을 검증 출처로 그대로 사용하지 않는다.
- OG title 불일치만으로 정상 공식 사이트를 차단하지 않는다.
- 작은 이미지와 아이콘을 휴리스틱만으로 자동 제외하지 않는다.
- 페이지가 3개 이하라는 이유만으로 시각 대표와 내용 대표의 데이터 의미를 제거하지 않는다.
- 이미지 다시 생성에서 동일한 고정 프롬프트만 반복하지 않는다.
- 확정되지 않은 레퍼런스 전체를 컨셉 프롬프트에 넣지 않는다.
- 사용자 흐름이 확정되기 전에 Phase 3 전체를 대규모 파이프라인으로 재작성하지 않는다.
- 모든 섹션에 Inspo/브랜드/이미지 생성 호출을 자동 실행하지 않는다.
- 확인되지 않은 Inspo endpoint, 응답 필드, 일일 한도를 제품 계약으로 하드코딩하지 않는다.
- Inspo 썸네일을 출처 링크와 사용 조건 없이 결과물에 삽입하지 않는다.
- 컴포넌트가 비동기 요청 전의 `ReferenceResult` 전체를 응답 후 다시 저장하지 않는다.
- 상위 결정 변경 시 하위 결과를 조용히 삭제하거나 최신 결과처럼 유지하지 않는다.
- 원본 PPT, 원문, 복원 mapping, `Detection.raw`를 자동 저장소나 운영 로그에 넣지 않는다.
- 콘텐츠 변형과 디자인 구조 3안을 같은 차별화 축으로 섞지 않는다(9조합 배치 생성 금지, §6.7).
- 온디맨드 콘텐츠 매핑 생성 시 이미 확정된 `uiStructure`/`keyVisual`/`layoutPattern`을 다시 생성하지 않는다.
- `maskedText`를 IndexedDB 자동 저장 대상에 포함하지 않는다.

---

## 10. 전체 완료 기준

### 데이터 추적성

- [ ] 적용한 레퍼런스는 pageId, sectionId, 적용 요소, 메모와 함께 저장된다.
- [ ] 참고만/제외 항목은 컨셉 입력에서 제외된다.
- [ ] 확정 화면에서 본 결정과 `ConceptJson.sourceBasis`가 일치한다.
- [ ] 컨셉 옵션의 `designBasis`에 팔레트, 무드, 선택 이미지, 타이포, 금지 방향이 존재한다.
- [ ] 모든 섹션 결정에 `user / inherited / ai` 출처와 기준 hash가 존재한다.
- [ ] 글로벌 방향·확정 브리프·컨셉 사이의 hash 관계를 추적할 수 있다.
- [ ] 확정 브리프의 팔레트는 `paletteOptionId`(출처) + `editedPaletteOption`(편집 결과) + `paletteMode`(확정 모드)를 모두 보유하고, 컨셉에는 `editedPaletteOption[paletteMode]`가 전달된다.

### 마스킹

- [ ] 확정 후 전체 텍스트는 기본 닫힘이다.
- [ ] 토큰별 적용 위치와 마스킹된 문맥을 확인할 수 있다.
- [ ] 의도적인 공개 유지와 위험 상태가 구분된다.
- [ ] 네트워크 요청에 원문, 복원 mapping, raw detection이 없다.

### 레퍼런스 UX

- [ ] 메인/서브 페이지가 페이지별로 구분된다.
- [ ] 현재 페이지 하나에 집중해 섹션과 결정 내용을 볼 수 있다.
- [ ] 레퍼런스 카드를 클릭해 적용 요소를 선택할 수 있다.
- [ ] 적용 결과가 오른쪽 결정 패널에 즉시 반영된다.
- [ ] 글로벌 방향 카드 안에서 컬러, 타이포, 이미지가 함께 보인다.
- [ ] 글로벌 방향은 텍스트 카드가 아닌 대표·보조 이미지, 팔레트, 타이포, UI 질감이 결합된 편집 가능한 무드보드로 제시된다.
- [ ] 무드보드에서 교체·제외한 이미지와 채택한 UI 레퍼런스가 확정 브리프까지 추적된다.
- [ ] 방향 3안 중 1안을 확정한 뒤에만 페이지 적용 단계로 이동한다.
- [ ] 기본 심층 탐색 대상은 고영향 섹션 3~5개이며 나머지는 상속 또는 선택 상태다.
- [ ] 사용자는 상속 섹션을 고영향으로 승격하거나 고영향 섹션을 변경할 수 있다.

### 검색 품질

- [ ] 디자인 검색어와 이미지 검색어가 분리된다.
- [ ] 사진 API에 hero/section/layout 같은 UI 용어가 전달되지 않는다.
- [ ] 제공자별 color 파라미터 계약이 다르게 처리된다.
- [ ] 사용자는 이미지 후보를 선택, 제외, 교체할 수 있다.
- [ ] 섹션 검색어는 로컬 intent 조합이 기본이며 AI 향상은 선택적 1회다.
- [ ] Inspo 미설정·실패·한도 초과 시 플랫폼 링크와 수동 URL로 계속 진행할 수 있다.
- [ ] 동일 검색은 캐시와 in-flight dedupe로 중복 호출되지 않는다.

### 출처 신뢰

- [ ] 실제 Gemini grounding metadata를 보존한다.
- [ ] 공식 출처, 보조 출처, 미확인 출처가 구분된다.
- [ ] 안전한 URL fetch와 redirect 검증이 적용된다.
- [ ] 출처 미확인 분석은 기본 접힘이다.
- [ ] 모든 외부 후보에 provider, sourceUrl, usage, fetchedAt이 남는다.
- [ ] Inspo 후보는 `inspiration-only`로 표시되고 PPT/PDF에 자동 삽입되지 않는다.
- [ ] Unsplash/Pexels attribution과 원본 출처 메타데이터가 유지된다.

### 컨셉 결과

- [ ] `카드 1/2/3`, `지표 1/2/3` 플레이스홀더가 사라진다.
- [ ] 실제 마스킹 콘텐츠가 layout renderer 내부에 배치된다.
- [ ] 선택 이미지가 지정된 프리뷰 영역에 반영된다.
- [ ] 채택 레퍼런스의 적용 메모가 컨셉 생성에 반영된다.
- [ ] 세 컨셉이 컬러만 다른 동일 와이어프레임으로 보이지 않는다.
- [ ] 컨셉 3안은 동일 글로벌 방향 안의 구조·신뢰형, 비주얼·몰입형, 균형형으로 구분된다.
- [ ] 대표 페이지와 출력 설정 변경은 불필요한 컨셉 재생성을 호출하지 않는다.
- [ ] 콘텐츠 변형은 디자인 3안의 차별화 축으로 쓰이지 않고, 기준 변형으로 구조 3안을 생성한 뒤 비기준 변형은 선택된 안에만 온디맨드로 추가된다(§6.7).
- [ ] `ConceptJson.sourceBasis`는 `version: "2.0"` 생성 결과에서 항상 존재하고, `version` 없는 구버전 로드 시에는 없어도 되는 것으로 구분된다.

### 상태와 복구

- [ ] 새로고침 후 안전한 프로젝트 선택과 확정 상태가 IndexedDB에서 복구된다. `maskedText`는 복구 대상이 아니며, 재분석·마스킹 재편집이 필요하면 원본을 다시 업로드한다는 것이 UI에 안내된다.
- [ ] 원본 PPT, 원문, 복원 mapping, `Detection.raw`, `maskedText`는 IndexedDB에 없다.
- [ ] 생성 이미지 바이너리는 워크플로 JSON과 분리되고 `generatedImageAssetId`로만 참조된다.
- [ ] 상위 결정 변경 시 영향받는 하위 결과에 `최신 아님`이 표시된다.
- [ ] 늦게 도착한 이전 요청의 응답이 최신 방향이나 채택 결정을 덮어쓰지 않는다.

### API 운영

- [ ] 정상 흐름의 Gemini 핵심 호출은 분석, 글로벌 방향, 컨셉 batch를 중심으로 구성된다.
- [ ] 프로젝트별 요청 예산과 provider별 서버 rate limit이 적용된다.
- [ ] 호출 수, 실패, cache hit, rate limit, stale 응답 폐기를 민감 내용 없이 관측할 수 있다.
- [ ] 429와 부분 장애가 전체 워크플로 상태를 초기화하지 않는다.

### 안정성

- [ ] `npm run test` 통과
- [ ] `npm run build` 통과
- [ ] 외부 서비스별 부분 실패 테스트 통과
- [ ] 데스크톱과 모바일 레이아웃에서 텍스트 겹침과 가로 넘침 없음
- [ ] 대표 사용자 흐름을 실제 PPT 입력으로 끝까지 재실행

---

## 11. 권장 구현 커밋 순서

0. (선행) `fix: masking review & section refs entity label tooltip` — 현재 미커밋 상태인 `components/MaskingReview.tsx`, `components/reference/SectionRefsTab.tsx`, `lib/masking/entity.ts`의 라벨 축약 + 툴팁 변경을 검증 후 이 작업과 무관하게 먼저 커밋한다. `app/api/parse/route.ts`의 20MB→200MB 변경은 P0 7번(업로드 구조 결정) 전까지 이 커밋에 포함하지 않는다.
1. `docs: 확정 데이터 흐름 및 스키마 반영`
2. `feat: reference decision types and confirmed brief builder`
3. `feat: workflow reducer revision hashes invalidation and safe autosave`
4. `feat: masking review summary and collapsed masked text`
5. `feat: composite direction board and selectable mood images`
6. `feat: local query intents and optional reference provider adapter`
7. `feat: priority-based page reference board and adoption controls`
8. `feat: grounded source verification and brand decisions`
9. `feat: representative roles and section-scoped image needs`
10. `feat: reference decision review and confirmation snapshot`
11. `feat: concept source basis and on-demand content variant mapping`
12. `feat: provider budgets rate limits caching and observability`
13. `test: end-to-end reference to concept traceability`

각 커밋은 독립적으로 테스트 가능해야 하며, 기존 미커밋 변경을 덮어쓰거나 되돌리지 않는다.

---

## 12. 구현 착수 시 첫 작업

구현자는 바로 UI 수정부터 시작하지 않는다. 첫 작업은 다음 세 가지다.

1. `ConfirmedReferenceBrief` 타입과 스냅샷 생성 함수의 테스트를 먼저 작성한다.
2. reducer/action, revision hash, 무효화 matrix, 안전 자동 저장의 단위 테스트를 작성한다.
3. 현재 `ReferenceResult`에서 컨셉 API로 실제 전달되는 필드를 표로 정리하고, 신규 브리프 계약과 비교한다.

이 세 작업이 완료되면 이후 UI, 검색, 브랜드 분석, 컨셉 프리뷰가 모두 같은 데이터 계약과 최신성 규칙 위에서 진행될 수 있다.
