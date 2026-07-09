# 표준 디자인 MD 스키마 (design-system-schema) — v1.0

> **이 문서는 계약(contract)이다.**
> RefBoard AI(제품 A)의 Phase 5 출력과 Design Canon(제품 B)의 스킬 4종
> (`md-extract-from-screen` / `md-extract-partial` / `md-extract-from-figma` / `md-apply-to-screens`)이
> 공유하는 단일 기준이며, 모든 디자인 MD 인스턴스는 이 스키마를 따른다.
>
> **설계 원칙 (전 축 공통):**
> 1. **실재 우선** — 소스에 존재하는 값만 기록한다. 없는 값은 지어내지 않고 Known Gaps에 기록한다.
> 2. **역할 기반** — 값이 아니라 역할(semantic)로 계약한다. 값이 바뀌어도 이름은 거짓말하지 않는다.
> 3. **단일 원천** — 후미 JSON 블록이 값의 SSoT다. MD 프로즈는 해설이며, 충돌 시 JSON이 이긴다.
> 4. **확신 없으면 사람에게** — 매핑 실패·파생 생성은 자동 확정하지 않고 리포트로 올린다(on-fail: report).
> 5. **도구 중립** — 스키마는 특정 에이전트 문법에 의존하지 않는다. Claude Code 스킬은 이 계약의 실행기 중 하나일 뿐이다.

---

## 0. 문서 구조 (인스턴스 고정 목차)

모든 디자인 MD 인스턴스는 아래 구조를 따른다. **섹션 생략 금지** (내용이 없어도 섹션은 존재해야 한다).

```
--- (YAML frontmatter: 메타데이터 7필드)
1. Overview          — 테마·분위기 요약 서술
2. Colors            — semantic 역할 해설
3. Typography        — 슬롯 사용 지침
4. Layout            — base-unit, spacing 철학
5. Shape & Elevation — radius·shadow 사용 지침
6. Components        — 컴포넌트 내부 구조·배치 프로즈
7. Rules             — constraints에서 파생 렌더링한 Do's / Don'ts
8. Known Gaps        — 미확인 항목 (빈 경우 "없음" 명시 — "확인 안 함"과 구분)
--- (후미 JSON 블록: 값의 SSoT)
```

- **후미 JSON 블록** = 기계 소비용 단일 원천. frontmatter를 포함한 모든 토큰·컴포넌트·rules 값을 담는다.
- **MD 프로즈** = 사람·에이전트용 해설. 프로즈에는 hex를 직접 쓰지 않고 토큰명(`{colors.primary}`)으로 언급한다.
- MD 프로즈와 JSON이 충돌하면 **JSON이 진실**이다.

---

## 1. Frontmatter — 메타데이터 (7필드 필수)

```yaml
---
name: 프로젝트명
schema-version: "1.0"        # 이 계약 문서의 버전. apply 실행 전 첫 검증 대상.
instance-version: "0.1"      # 인스턴스 성장 버전. 갭이 채워질 때마다 올린다.
mode: light                  # light | dark. 파일 1개 = 테마 1개. 다크 테마는 별도 파일.
source: v0-screen            # v0-screen | figma | internal-md | concept
extracted: "YYYY-MM-DD"
status: draft                # draft | confirmed
---
```

**status 규칙:**
- `draft` = 후보 상태. **apply의 fix 모드 입력 불가** (check 모드는 가능).
- `confirmed` = 후보 비교 → 사람 승인 완료. fix 모드 입력 가능.
- "화면 1개로 바로 확정 금지" 원칙을 이 필드가 강제한다.

---

## 2. Colors

### 2.1 계층 구조
- **semantic (필수)** — 역할 토큰. 컴포넌트와 rules가 참조하는 유일한 기준.
- **primitive (선택)** — 원시 스케일(예: `indigo-100~900`). **소스에 실재할 때만** 기록한다 (Figma variables 등). 화면 추출에서 스케일이 안 보이면 만들지 않는다.

### 2.2 semantic 필수 7종 (최소 계약)
모든 인스턴스가 반드시 보유해야 하는 토큰:

| 토큰 | 역할 |
|---|---|
| `primary` | 브랜드 인터랙션 컬러 |
| `on-primary` | primary 배경 위 텍스트/아이콘 |
| `canvas` | 페이지 최하단 배경 |
| `surface` | 카드 등 canvas 위 한 단계 표면 |
| `text` | 기본 텍스트 |
| `text-muted` | 보조 텍스트 |
| `border` | 기본 테두리/구분선 |

### 2.3 권장 토큰 (있으면 기록, 없으면 Known Gaps에 기록)
`error` `success` `warning` `link` `primary-hover` `primary-active`

- 소스에 실재하지 않는 권장 토큰을 **지어내지 않는다**. (예: 마케팅 페이지에 error 색이 없으면 없다고 기록)

### 2.4 상태 변형 표기
- 접미사 토큰 방식: `{base}-{state}` (예: `primary-hover`, `primary-active`).
- 허용 상태 접미사는 §6.5와 동일.

### 2.5 쌍(pair) 원칙
배경 토큰과 그 위 텍스트 토큰은 항상 쌍으로 계약한다:
`primary ↔ on-primary` / `canvas ↔ text` / `surface ↔ text`.
렌더러·apply는 배경 위 텍스트 색을 임의 판단하지 않고 쌍을 따른다.

### 2.6 derived (파생값) 규칙
- **추출 스킬은 derived를 생성하지 않는다.** 실재만 기록.
- 파생 생성(예: primary에서 hover 색 산출)은 **명시적 요청 시에만** 수행하며, 반드시 출처를 표기한다:

```json
"primary-hover": { "value": "#4F46E5", "source": "derived" }
```

- `source` 생략 시 기본값은 `extracted`. derived 값은 검수 대상이며, 승인(confirmed) 전까지 잠정값이다.

### 2.7 다크모드
- **파일 1개 = 테마 1개.** `-on-dark` 같은 모드 혼합 토큰을 두지 않는다.
- 다크 테마는 `mode: dark`인 별도 인스턴스 파일로 관리한다.

---

## 3. Typography

### 3.1 필수 슬롯 7종 (최소 계약)

| 슬롯 | 역할 |
|---|---|
| `display` | 최대 제목 (히어로) |
| `heading` | 섹션 제목 |
| `title` | 카드/항목 제목 |
| `body` | 기본 본문 |
| `body-sm` | 보조 본문 |
| `caption` | 메타 정보·라벨 |
| `button` | 버튼 전용 |

### 3.2 확장 규칙
- 프로젝트 실재에 따라 슬롯을 늘린다. 단 **허용 접미사로만**: `-hero` `-lg` `-sm` `-xs`
- 예: body가 3사이즈 실재 → `body-lg` / `body` / `body-sm`
- 필수 7종 밑으로는 줄일 수 없다. 소스에서 판별 불가한 슬롯은 Known Gaps에 기록하되 슬롯 자체는 채운다(가장 근접한 실재값으로, source 표기).

### 3.3 토큰 필드 (5필드 + use 전부 필수)

```yaml
body:
  fontFamily: "{typography.family.sans}"   # family 블록 참조
  fontSize: 16px                            # px 명시
  fontWeight: 400
  lineHeight: 1.5                           # 무단위 배수
  letterSpacing: 0                          # 없으면 0 명시. 생략 금지.
  use: "기본 본문, 설명 텍스트"              # apply의 판단 근거. 생략 금지.
```

### 3.4 family 블록
- 폰트는 상단 `family:` 블록에 정의하고 토큰은 참조한다 (폰트 교체 = 한 줄 수정).
- **기본값(fallback)** — 소스에서 폰트 판별 불가 시에만 사용:

```yaml
family:
  sans: "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
  mono: "JetBrains Mono, D2Coding, monospace"
```

- 소스에 실재하는 폰트가 판별되면 **실재값이 기본값에 우선**한다.

### 3.5 단위 규칙
- 크기·간격: **px 명시** (`16px`). 숫자만 쓰지 않는다.
- lineHeight: 무단위 배수 (`1.5`).

---

## 4. Spacing

### 4.1 필수 슬롯 6종 + base-unit

```yaml
spacing:
  base-unit: 8px      # 그리드 기준. normalize의 스냅 기준값. 필수.
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  section: 80px       # 섹션 수직 여백. 필수.
```

- **선택 확장**: `xxs` `base` `xxl` (정해진 이름만).
- 값은 인스턴스가 실재대로 정한다. 비정형 값(예: 17px)도 정규화하지 않고 그대로 기록한다.

---

## 5. Radius & Shadow

### 5.1 radius 필수 5종

```yaml
rounded:
  none: 0px           # "라운딩 안 함"은 생략이 아니라 선언이다.
  sm: 4px
  md: 12px
  lg: 20px
  full: 9999px        # pill 별칭 금지. 9999는 full 하나로 통일.
```

- 선택 확장: `xs`만 허용.

### 5.2 shadow — none 필수 + 실재 레벨만

```yaml
shadow:
  none: "none"                                      # 필수
  subtle: "0px 1px 3px rgba(0,0,0,0.06)"            # 실재할 때만
  standard: "0px 2px 8px rgba(0,0,0,0.08)"          # 실재할 때만
  elevated: "0px 4px 12px rgba(0,0,0,0.12)"         # 실재할 때만
```

- 값은 완성된 CSS box-shadow 문자열로 기록한다 (분해 필드 금지).
- 레벨을 지어내지 않는다. UI 그림자가 없는 시스템은 `none`만 존재한다.
- "그림자를 어디에 쓰지 말라" 같은 원칙은 토큰이 아니라 **rules(constraints)** 로 기록한다.

---

## 6. Components

### 6.1 2계층 분류 — category(대분류) / type(소분류)

**category 7종 (고정 — 추출 스킬의 순회 의무 단위):**

```
action / form / data-display / feedback / navigation / overlay / layout
```

**type 어휘표 (초기값 — 확장 가능, misc 금지):**

| category | type |
|---|---|
| action | button, top-button, text-link |
| form | input, textarea, select, search, checkbox, radio, toggle, date-picker, time-picker, file-upload |
| data-display | table, text-list, accordion, carousel, card, badge, tag |
| feedback | alert, critical-alert, tooltip, progress-bar, step-indicator, spinner |
| navigation | nav, tab, breadcrumb, pagination, skip-link |
| overlay | modal, drawer, popover |
| layout | footer, header, divider |

**순회 의무:** 추출 스킬은 category 7종을 전부 순회하며, 각 category에서
(a) 발견한 type을 기록하거나 (b) 소스에 없음을 Known Gaps에 기록한다. 둘 중 하나는 반드시 수행한다.
어휘표에 없는 새 컴포넌트는 misc로 버리지 않고 **어휘표에 type을 추가**하는 방식으로 확장한다.

### 6.2 필수 컴포넌트 4종 (최소 계약)
`button-primary` / `button-secondary` / `input-default` / `card-default`
- 소스에 정말 없으면 Known Gaps에 사유를 기록한다.
- 권장: `button-tertiary` `button-danger` `badge-default` `nav-main` `footer`

### 6.3 네이밍
`{type}-{역할}` kebab-case 고정. (예: `button-weak-primary`, `input-search`)

### 6.4 필드 구성

```yaml
button-primary:
  category: action                          # 필수
  type: button                              # 필수 (어휘표 값)
  backgroundColor: "{colors.primary}"       # 토큰 참조 강제. hex 직접 기입 금지.
  textColor: "{colors.on-primary}"          # 토큰 참조 강제
  typography: "{typography.button}"         # 토큰 참조 강제
  rounded: "{rounded.md}"                   # 토큰 참조 강제
  shadow: "{shadow.none}"                   # 선택. 쓰면 토큰 참조.
  border: "1px solid {colors.border}"       # 선택. 색상만 참조.
  padding: "12px 20px"                      # 리터럴 허용 (px 명시). 실재 우선.
  height: 48px                              # 선택. 리터럴 허용.
  use: "화면당 1개, 핵심 행동 전용"          # 필수. apply의 선택 근거.
```

- **토큰 필드(color/typography/rounded/shadow)는 참조 강제, hex 금지.**
- padding/height 등 기하 값은 리터럴 허용 — 실재값을 정규화 없이 기록.

### 6.5 상태 변형 — 접미사 별도 엔트리 + diff만 기록

허용 상태 접미사:

```
-hover  -active  -focus  -disabled  -selected  -filled  -error  -readonly
```

```yaml
button-primary-hover:
  backgroundColor: "{colors.primary-hover}"   # 바뀐 필드만 기록. 나머지는 베이스 상속.
```

**category별 핵심 상태 체크리스트 (추출 스킬 순회 의무):**

| category | 순회 의무 상태 |
|---|---|
| form | default, hover, focus, filled, error, disabled |
| action | default, hover, active, disabled |
| navigation (tab 포함) | default, selected |

- 발견하면 기록, 소스에서 확인 불가면 Known Gaps에 기록.

### 6.6 복합 컴포넌트 — parts 블록

평면 필드로 표현 불가한 컴포넌트(checkbox, table, alert 등)는 `parts:`로 하위 요소를 분해한다.
parts 내부에도 토큰 참조 강제·상태 접미사 규칙이 동일하게 적용된다.

```yaml
checkbox-default:
  category: form
  type: checkbox
  parts:
    box:         { border: "1.5px solid {colors.border}", rounded: "{rounded.sm}", size: 20px }
    box-checked: { backgroundColor: "{colors.primary}", border: "none" }
    check-icon:  { color: "{colors.on-primary}" }
  use: "다중 선택"

table-default:
  category: data-display
  type: table
  parts:
    header:    { backgroundColor: "{colors.surface}", typography: "{typography.caption}", textColor: "{colors.text-muted}" }
    row:       { backgroundColor: "{colors.canvas}", borderBottom: "1px solid {colors.border}" }
    row-hover: { backgroundColor: "{colors.surface}" }
    cell:      { padding: "12px 16px", typography: "{typography.body-sm}" }
  use: "데이터 목록 표시"
```

### 6.7 구조 변형 — 아이콘·구성 차이

상태(state)와 구조 변형(structure)은 다른 메커니즘으로 처리한다:

- **아이콘 좌/우 동반**: 스타일 값이 같으므로 엔트리를 나누지 않는다. `parts.icon` 규격 하나로 커버:

```yaml
  parts:
    icon: { size: 16px, gap: 8px, color: "inherit" }
```

- **아이콘 전용(기하가 바뀜)**: 구조 접미사 `-icon-only`로 별도 엔트리, 기하 diff만 기록:

```yaml
button-primary-icon-only:
  padding: "12px"
  width: 48px
  use: "아이콘 단독 버튼. 라벨 없으므로 tooltip 필수"
```

- **텍스트만**: 별도 type(`text-link`)으로 존재.
- 상태 접미사는 구조 변형 위에도 동일하게 얹힌다. diff 없으면 엔트리 생략(베이스 상태 규칙 상속).

---

## 7. Rules — apply 실행 계약

### 7.1 2계층 구조

```yaml
rules:
  # ── 1층: normalize — 기계적 치환 (고정 전략 어휘, 결정론적) ──
  normalize:
    color:     nearest-semantic     # 임의 hex → 가장 가까운 semantic 토큰
    font-size: snap-to-slot         # 임의 크기 → 타이포 슬롯 값으로 스냅
    spacing:   snap-to-base-unit    # base-unit 배수로 스냅
    radius:    snap-to-scale        # radius 스케일 값으로 스냅
    on-fail:   report               # 매칭 실패 시: 임의 변환 금지, 리포트로 상신

  # ── 2층: constraints — 에이전트 판단 (정형화된 자연어) ──
  constraints:
    - id: single-interaction-color
      severity: must                # must | should
      scope: action                 # category | type | 토큰 축 | "*"
      rule: "모든 인터랙티브 요소는 {colors.primary} 계열만 사용. 제2 액센트 도입 금지"
    - id: contrast-minimum
      severity: must
      scope: colors
      rule: "모든 배경↔텍스트 쌍은 WCAG AA(4.5:1) 이상. 미달 시 report"
    - id: min-body-size
      severity: must
      scope: typography
      rule: "화면 표시 텍스트 최소 14px"
```

- **constraints 필드 4개 고정**: `id` / `severity` / `scope` / `rule`(자연어 한 문장).
- `must` 위반 = 수정 대상. `should` 위반 = 보고만.
- MD 본문 §7(Do's/Don'ts)은 constraints에서 **파생 렌더링**한다. 별도 작성 금지(drift 방지). constraints가 단일 원천.

### 7.2 apply 스킬의 두 모드

| 모드 | 동작 | 용도 |
|---|---|---|
| **fix** | 화면을 실제로 교정 + 위반 리포트 | Claude Code 내 신규 페이지 생성·기존 페이지 정규화. `status: confirmed` MD만 입력 가능. |
| **check** | 교정 없이 위반 리포트만 (lint) | V0·Cursor 등 외부에서 만들어온 산출물 검수. draft MD도 입력 가능. |

### 7.3 위반 리포트 규격 (apply 출력 의무)

apply는 실행 결과로 반드시 리포트를 출력한다:

```json
{
  "mode": "check",
  "applied":  [{ "rule-id": "...", "location": "...", "action": "..." }],
  "violations": [{ "rule-id": "...", "severity": "must", "location": "...", "found": "...", "expected": "..." }],
  "on-fail":  [{ "kind": "color-mapping", "found": "#8B5CF6", "nearest": "primary(거리 초과)", "proposal": "..." }]
}
```

- `on-fail` 항목과 derived 후보는 사람 승인 후에만 MD에 반영된다.

### 7.4 승인 게이트의 위치 (환경별)

| 환경 | MD 준수 | 승인 게이트 |
|---|---|---|
| Claude Code (스킬 실행) | rules 순회 의무 + 리포트 | 완전 (실시간 on-fail 상신) |
| Cursor / Antigravity 등 (MD를 컨텍스트 제공) | 에이전트 성실도 수준 | 부분 → 산출물을 check 모드로 사후 검증 |
| V0 등 생성 도구 (프롬프트 첨부) | 참고 수준 | 없음 → check 모드로 사후 검증 |

**원칙: 어디서 만들었든 최종 관문은 apply(check) 하나다.**

---

## 8. 타겟 스택 — 산출물 표준

**CSS 변수를 본체로, Tailwind는 매핑 테이블로.**

```css
:root {
  --color-primary: #6366F1;
  --color-on-primary: #FFFFFF;
  --rounded-md: 12px;
  /* 모든 semantic 토큰 1:1 */
}
```

```js
// tailwind.config — 토큰 1:1 매핑 (Tailwind 프로젝트에서만 얹는 층)
colors: { primary: "var(--color-primary)" }
```

- apply의 치환 기준은 CSS 변수다. 소스가 순수 CSS·인라인 스타일·Tailwind 어느 쪽이든 같은 전략이 통한다.

---

## 9. Known Gaps — 정형 포맷

```json
"known-gaps": [
  { "category": "form", "type": "date-picker", "reason": "분석 화면에 미등장" },
  { "category": "feedback", "type": "toast", "reason": "인터랙션 미발생으로 확인 불가" }
]
```

- **필수 섹션.** 갭이 없으면 빈 배열 + 본문에 "없음" 명시 ("확인 안 함"과 구분).
- 다음 추출·작업 시 기계가 읽는 "채워야 할 목록"으로 동작한다.
- 갭이 채워지면 `instance-version`을 올린다.

---

## 10. 후미 JSON 블록 — 최상위 구조

```json
{
  "meta":       { "name": "...", "schema-version": "1.0", "instance-version": "0.1",
                  "mode": "light", "source": "v0-screen", "extracted": "YYYY-MM-DD", "status": "draft" },
  "colors":     { "semantic": { }, "primitive": { } },
  "typography": { "family": { }, "slots": { } },
  "spacing":    { },
  "rounded":    { },
  "shadow":     { },
  "components": { },
  "rules":      { "normalize": { }, "constraints": [ ] },
  "known-gaps": [ ]
}
```

- frontmatter와 `meta`는 동일 값을 가진다. 충돌 시 JSON(`meta`)이 진실.
- 토큰 참조 문법은 JSON 내에서도 문자열 `"{colors.primary}"` 그대로 유지한다.

---

## 부록 A. 추출 스킬 공통 의무 요약

1. category 7종 전 순회 — 발견 기록 or Known Gaps 기록, 둘 중 하나 필수.
2. category별 상태 체크리스트 순회 — 동일 규칙.
3. 실재만 기록. derived 생성 금지. 판별 불가는 Known Gaps로.
4. 필수 슬롯(컬러 7 / 타이포 7 / spacing 6 / radius 5 / 컴포넌트 4) 충족 확인.
5. 산출 인스턴스는 `status: draft`로 시작. 후보 여러 버전 → 비교 → 사람 확정 후 `confirmed`.

## 부록 B. 미결로 남긴 것 (다음 단계에서)

- normalize 각 전략의 임계값(색 거리, 스냅 허용 오차) 구체 수치 — Step 2(apply 구현)에서 실측 기반 확정.
- 대체 폰트 가이드(예: 브랜드 폰트 → 오픈소스 매핑 노트) — 선택 프로즈 섹션으로 도입 여부.
- constraints scope 문법의 상세 어휘(복수 scope, 제외 표현) — Step 2에서 실사용 사례로 확정.
