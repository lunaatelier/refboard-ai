# design-system-schema.md v1.1.2 패치 — 추가/수정분만

> §7 Rules — constraints 배열에 아래 3개 신규 추가.
> 적용 대상: design-system-schema.md §7 예시/권장 constraints 세트 +
> DESIGN-refboard-ai.md 인스턴스 §7 프로즈 + 후미 JSON rules.constraints 양쪽.
> schema-version은 "1.1.1" → "1.1.2"로 변경 (마이너 패치, breaking change 아님).

---

## 추가 constraint 3종 (2026-07-11, RefBoard AI 3단계 화면 리뷰에서 발견)

**배경:** 화면 리뷰 중 "버튼 안에 부연설명 텍스트 삽입"(맞습니다/아닙니다 카드,
분석 중... 수십 초 소요 등), "페이지 CTA가 좌측에 있어 UX상 부자연스러움"
문제가 반복 발견됨. 개별 화면 수정만으로는 재발 방지가 안 되어 계약으로 명문화.

```yaml
constraints:
  - id: button-label-action-only
    severity: must
    scope: action
    rule: "버튼 라벨은 사용자가 취할 행동을 가리키는 짧은 문구여야 한다.
           표현 방식(다시보기/확인하기/다음으로/목록보기 등 어미·스타일)은
           자유. 단 소요시간·조건·부연설명 등 '정보성 텍스트'는 라벨에
           절대 포함하지 않고 버튼 옆/아래 helper text(body-sm, text-muted)로
           분리한다."

  - id: button-label-consistency
    severity: should
    scope: action
    rule: "같은 역할을 하는 버튼(상세 이동, 목록 이동, 재조회 등)은
           프로젝트 전체에서 하나의 표기 스타일로 통일한다. 예:
           '다시보기/목록보기'처럼 동사+보기 형태로 갈지, '목록'처럼
           명사형으로 갈지 초반에 정하고, 화면마다 스타일이 섞이지 않게 한다."

  - id: cta-placement
    severity: must
    scope: layout
    rule: "페이지 레벨 주 CTA는 하단 우측 배치, 크기 48px
           (button-primary-xl). 보조 액션은 주 CTA 좌측에 나란히
           (weak/neutral). 파괴적·역방향 액션이 함께 있으면 반대편
           (좌측)으로 분리한다."
```

### button-primary-xl 컴포넌트 신규 (또는 기존 xl 사이즈 변형 명시)

기존 §6.7 크기 변형 규칙(허용 크기 접미사 `-sm` `-lg` `-xl`)에 따라
`button-primary-xl`을 페이지 레벨 CTA 표준 크기로 명시:

```yaml
button-primary-xl:
  height: 48px
  padding: "0 24px"
  typography: "{typography.button-lg}"
  use: "페이지 레벨 주 CTA 전용(하단 우측 배치). 카드/인라인 액션은
        기존 button-primary(40px) 유지."
```

---

## DESIGN-refboard-ai.md 인스턴스 반영 사항

### §6 Components — page-layout 정의 수정 (⚠️ 계약 오류 정정)

**기존:**
> "banner(선택)→title+description→카드 스택→CTA(좌측 정렬) 고정 순서"

**수정:**
> "banner(선택)→title+description→카드 스택→CTA(우측 정렬) 고정 순서"

**사유:** 최초 인스턴스 추출 시 원본 화면에 우연히 존재하던 좌측 배치가
그대로 계약으로 굳어짐. cta-placement(신규 must 규칙)와 충돌하여 정정.
화면 코드만 고치고 이 인스턴스 값을 안 고치면 다음 추출/검증 시 재발함.

### 변환 노트 추가 (§1 Overview 하단, 기존 변환 노트 리스트에 추가)

- CTA 정렬 좌측→우측 정정(v1.1.2) — 최초 추출본의 우연한 배치가 계약으로
  잘못 고정되었던 것을 cta-placement 규칙 신설과 함께 바로잡음.

---

## 부록 C. 변경 이력 (추가분)

- **v1.1.2 (2026-07-11)** — RefBoard AI 3단계(분석 결과) 화면 리뷰에서
  반복 발견된 버튼/CTA 관례 문제를 계약으로 명문화:
  - `button-label-action-only`(must) — 버튼 라벨 내 정보텍스트 삽입 금지
  - `button-label-consistency`(should) — 동일 역할 버튼 표기 스타일 통일
  - `cta-placement`(must) — 페이지 레벨 CTA 하단 우측 배치, 48px
  - `button-primary-xl` 컴포넌트를 페이지 레벨 CTA 표준으로 명시
  - DESIGN-refboard-ai.md 인스턴스의 page-layout CTA 정렬 좌측→우측 정정
    (최초 추출 시 우연한 배치가 계약으로 잘못 고정되었던 오류 수정)
