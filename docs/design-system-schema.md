# 표준 디자인 MD 스키마 (design-system-schema) — v1.1

> **이 문서는 계약(contract)이다.**
> RefBoard AI(제품 A)의 Phase 5 출력과 Design Canon(제품 B)의 스킬 4종
> (`md-extract-from-screen` / `md-extract-partial` / `md-extract-from-figma` / `md-apply-to-screens`)이
> 공유하는 단일 기준이며, 모든 디자인 MD 인스턴스는 이 스키마를 따른다.

> **문서 상태: draft.**
> 확정 절차: **제품 B에서 초안 계약을 먼저 확정(현 단계) → 제품 A Phase 4의 실제 Concept JSON 샘플로 검증 → 통과 시 confirmed.**
> 제품 A 문서의 "Phase 4 완료 후 스키마 확정" 문구와 제품 B 문서의 "B에서 먼저 확정" 문구는 이 절차로 통합 해석한다. (양쪽 CLAUDE.md 갱신 필요)

> **설계 원칙 (전 축 공통):**
> 1. **실재 우선** — 소스에 존재하는 값만 기록한다. 없는 값은 지어내지 않고 Known Gaps에 기록한다.
> 2. **역할 기반** — 값이 아니라 역할(semantic)로 계약한다. 값이 바뀌어도 이름은 거짓말하지 않는다.
> 3. **단일 원천** — 후미 JSON 블록이 값의 SSoT다. MD 프로즈는 해설이며, 충돌 시 JSON이 이긴다.
> 4. **확신 없으면 사람에게** — 매핑 실패·파생 생성은 자동 확정하지 않고 리포트로 올린다(on-fail: report).
> 5. **도구 중립** — 스키마는 특정 에이전트 문법에 의존하지 않는다. Claude Code 스킬은 이 계약의 실행기 중 하나일 뿐이다.
> 6. **필수 토큰 슬롯 충족 우선순위** — 필수 토큰 슬롯(컬러·타이포·spacing·radius)은 ① 실재값(`extracted`) → ② 실재 토큰 매핑(`mapped`) → ③ 계산 파생(`derived`, 명시 요청 시) 순으로 반드시 채운다. ②·③으로 채운 슬롯은 source 표기 + Known Gaps 기록. **컴포넌트에는 이 원칙을 적용하지 않는다** — 컴포넌트 필수 셋의 예외 처리는 §6.2.

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
- 고정 8섹션 뒤에 **확장 섹션 허용** (Voice & Tone, Iconography, Motion 해설 등). 단 확장 섹션도 값은 JSON에 두고 프로즈는 해설만 담는다.

---

## 1. Frontmatter — 메타데이터 (7필드 필수)

```yaml
---
name: 프로젝트명
schema-version: "1.1"        # 이 계약 문서의 버전. apply 실행 전 첫 검증 대상.
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

**source: concept 인스턴스의 완화 규칙 (제품 A Phase 5 출력):**
컨셉 기반 인스턴스는 실측 기반보다 상세도가 낮은 것이 정상이다. 별도 fidelity 필드를 두지 않고 source가 그 사실을 표현한다.
- 필수 컴포넌트 4종(§6.2) 미충족 허용 — Known Gaps에 사유 기록으로 대체.
- 상태 변형 체크리스트(§6.5) 순회 의무 면제 — 미포함분은 Known Gaps 일괄 기록.
- **confirmed 여부와 무관하게 fix 모드 입력 불가, check 모드만 가능.** 실측으로 보강되어 source가 바뀌기 전까지 유지.

---

## 2. Colors

### 2.1 계층 구조
- **semantic (필수)** — 역할 토큰. 컴포넌트와 rules가 참조하는 유일한 기준.
- **primitive (선택)** — 원시 스케일(예: `indigo-100~900`). **소스에 실재할 때만** 기록한다 (Figma variables 등). 화면 추출에서 스케일이 안 보이면 만들지 않는다.

### 2.2 semantic 필수 7종 (최소 계약)

| 토큰 | 역할 |
|---|---|
| `primary` | 브랜드 인터랙션 컬러 |
| `on-primary` | primary 등 채움 배경 위 텍스트/아이콘 |
| `canvas` | 페이지 최하단 배경 |
| `surface` | 카드 등 canvas 위 한 단계 표면 |
| `text` | 기본 텍스트 |
| `text-muted` | 보조 텍스트 |
| `border` | 기본 테두리/구분선 |

### 2.3 권장 토큰 (있으면 기록, 없으면 Known Gaps에 기록)
`error` `success` `warning` `link` `primary-hover` `primary-active`
- 소스에 실재하지 않는 권장 토큰을 **지어내지 않는다**.

### 2.4 상태 변형 표기
- 접미사 토큰 방식: `{base}-{state}` (예: `primary-hover`, `primary-active`). 허용 상태 접미사는 §6.5와 동일.

### 2.5 쌍(pair) 원칙
배경 토큰과 그 위 텍스트 토큰은 항상 쌍으로 계약한다:
`primary ↔ on-primary` / `canvas ↔ text` / `surface ↔ text`.
렌더러·apply는 배경 위 텍스트 색을 임의 판단하지 않고 쌍을 따른다.

### 2.6 값의 출처 표기 — source (5종)
- **extracted** (기본, 생략 가능) — 소스에서 직접 확인된 실재값.
- **mapped** — 다른 실재 토큰의 값을 복사·매핑해 슬롯을 채운 것 (예: link가 별도 색 없이 primary와 동일). **필수 슬롯 충족 목적에 한해 추출 스킬도 허용** (원칙 6).
- **derived** — 계산으로 생성한 값 (예: primary에서 hover 색 산출). **추출 스킬은 생성 금지.** 명시적 요청 시에만.
- **proposed** — AI가 제안한 값 (제품 A 컨셉 팔레트 등 생성 산출물). 사용자가 편집·선택한 뒤에도 proposed를 유지한다 — 승인 사실은 토큰이 아니라 인스턴스 `status: confirmed`가 표현한다.
- **fallback** — 소스에서 판별 불가하여 계약 기본값을 사용한 것 (예: 폰트 미판별 시 Pretendard 스택 §3.4).

```json
"link":          { "value": "#6366F1", "source": "mapped", "from": "primary" },
"primary-hover": { "value": "#4F46E5", "source": "derived" },
"primary":       { "value": "#6366F1", "source": "proposed" }
```

- extracted 외의 모든 값은 검수 대상이며 Known Gaps에도 기록한다. derived·proposed는 승인(confirmed) 전까지 잠정값이다.

### 2.7 다크모드
- **파일 1개 = 테마 1개.** `-on-dark` 같은 모드 혼합 토큰을 두지 않는다.
- 다크 테마는 `mode: dark`인 별도 인스턴스 파일로 관리한다.
- 한 소스에 두 테마가 실재하면(다크 토글이 있는 화면, Figma의 light/dark 컬렉션) **mode별로 인스턴스 파일 2개를 생성**한다.

### 2.8 semantic 확장 규칙
필수·권장 외의 역할이 실재하면 다음 규칙으로만 추가한다 (임의 명명 금지):
- **변형 접미사**: `{base}-{변형}` — 허용: `-light` `-weak` `-strong` `-alt` `-placeholder` `-inverse`
  (예: `primary-light`, `primary-weak`, `surface-alt`, `border-strong`, `text-placeholder`, `surface-inverse`)
- **독립 역할 토큰**: `foreground` `secondary` `accent` `neutral` `info` `locked` — 반드시 `use` 설명 필수.
- semantic 값은 primitive 참조 가능: `"primary": "{primitive.indigo-500}"` (Figma alias 대응).
- 색값은 hex 외 `rgba()` 알파값 허용 (틴트 배경 등 실재 표현을 단색으로 뭉개지 않는다).

### 2.9 gradients (선택 블록)
그라디언트가 실재하면 shadow와 같은 방식 — 완성된 CSS 문자열로 기록한다:

```json
"gradients": {
  "hero": { "value": "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)", "use": "히어로 배경 전용" }
}
```

- 단색 semantic으로 분해·근사하지 않는다. 그라디언트는 그 자체가 하나의 실재값이다.

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
- 필수 7종 밑으로는 줄일 수 없다. 소스에 실재하지 않는 슬롯은 원칙 6에 따라 mapped로 채운다.
  예: "caption류 축소 표기 금지"가 정책인 프로젝트는 `caption`을 body-sm 값으로 mapped 처리하고 use에 정책을 기록한다.

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
- **기본값(fallback)** — 소스에서 폰트 판별 불가 시에만 사용하며, 사용 시 `source: fallback` 표기:

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
- `section`이 마케팅형 대여백으로 실재하지 않는 경우(워크스페이스 앱 등)는 "그룹 간 분리 간격" 실재값으로 mapped 처리하고 use에 기록한다.

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

- 선택 확장: `xs` `xl` 허용.

### 5.2 shadow — none 필수 + 실재 레벨만

```yaml
shadow:
  none: "none"                                      # 필수
  subtle: "0px 1px 3px rgba(0,0,0,0.06)"            # 실재할 때만
  standard: "0px 2px 8px rgba(0,0,0,0.08)"          # 실재할 때만
  elevated: "0px 4px 12px rgba(0,0,0,0.12)"         # 실재할 때만
  modal: "0px 8px 24px rgba(0,0,0,0.16)"            # 실재할 때만
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
- 소스에 정말 없으면 Known Gaps에 사유를 기록한다. **`source: concept` 인스턴스는 이 대체를 기본 허용**한다 (§1 완화 규칙).
- 권장: `button-tertiary` `button-danger` `badge-default` `nav-main` `footer`
- 원칙 6(mapped 충족)은 컴포넌트에 적용하지 않는다 — 존재하지 않는 컴포넌트를 매핑으로 만들지 않는다.

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

- 발견하면 기록, 소스에서 확인 불가면 Known Gaps에 기록. (`source: concept` 인스턴스는 순회 의무 면제 — §1)

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
```

### 6.7 구조·크기 변형

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

- **크기 변형**: 허용 크기 접미사 `-sm` `-lg` `-xl` (기본 엔트리 = 표준 크기). 기하 diff만 기록:

```yaml
button-primary-sm: { height: 32px, padding: "0 12px" }
```

- **텍스트만**: 별도 type(`text-link`)으로 존재.
- 상태 접미사는 구조·크기 변형 위에도 동일하게 얹힌다. diff 없으면 엔트리 생략(베이스 상태 규칙 상속).

---

## 7. Rules — apply 실행 계약

### 7.1 2계층 구조

```yaml
rules:
  # ── 1층: normalize — 기계적 치환 (고정 전략 어휘, 결정론적) ──
  normalize:
    color:     { strategy: nearest-semantic, threshold: null }   # threshold: Step 2에서 실측 확정
    font-size: { strategy: snap-to-slot, threshold: null }
    spacing:   { strategy: snap-to-base-unit, threshold: null }
    radius:    { strategy: snap-to-scale, threshold: null }
    on-fail:   report               # 매칭 실패 시: 임의 변환 금지, 리포트로 상신
    exceptions: []                  # 치환 제외 영역 (예: 마스킹 토큰 하이라이트, 서드파티 임베드, 코드 블록)

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
- normalize의 `threshold` 구체 수치와 실행 우선순위(축 간 순서)는 **Step 2(apply 구현)에서 실측 기반으로 확정**한다. 자리만 계약에 둔다.

### 7.2 apply 스킬의 두 모드

| 모드 | 동작 | 용도 |
|---|---|---|
| **fix** | 화면을 실제로 교정 + 위반 리포트 | Claude Code 내 신규 페이지 생성·기존 페이지 정규화. `status: confirmed`이고 `source ≠ concept`인 MD만 입력 가능. |
| **check** | 교정 없이 위반 리포트만 (lint) | V0·Cursor 등 외부에서 만들어온 산출물 검수. draft·concept MD도 입력 가능. |

**실행 전 검사(공통):** apply는 실행 전에 다음을 확인하고, 불일치 시 실행하지 않고 보고한다:
1. `schema-version` 일치 (모르는 계약 버전이면 중단)
2. 대상 화면의 mode(밝음/어두움) 추정 ↔ MD의 `mode` 일치 (light MD로 다크 화면을 교정하는 사고 방지)
3. fix 모드인 경우: `status: confirmed` + `source ≠ concept`

### 7.3 위반 리포트 규격 (apply 출력 의무)

```json
{
  "mode": "check",
  "applied":    [{ "rule-id": "...", "location": "...", "action": "..." }],
  "violations": [{ "rule-id": "...", "severity": "must", "location": "...", "found": "...", "expected": "..." }],
  "on-fail":    [{ "kind": "color-mapping", "found": "#8B5CF6", "nearest": "primary(거리 초과)", "confidence": "low", "proposal": "..." }]
}
```

- `on-fail` 항목에는 `confidence`(high | medium | low)를 표기해 사람 검수의 우선순위 근거를 제공한다.
- `on-fail` 항목과 derived·proposed 후보는 사람 승인 후에만 MD에 반영된다.

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

## 9. 선택 축 — Motion / Layout

토큰으로 실재하면 기록하는 선택 축. 없으면 생략 가능 (필수 축이 아니므로 Known Gaps 기록도 불필요).

```json
"motion": {
  "durations": { "fast": "150ms", "standard": "250ms" },
  "easings":   { "standard": "cubic-bezier(0.4, 0.0, 0.2, 1)" }
},
"layout": {
  "baseline": "1440px",
  "container-max": "1600px",
  "breakpoints": { "desktop": "1024px" }
}
```

- layout 축이 있어야 apply가 컨테이너 폭·브레이크포인트 위반을 검사할 수 있다 (프로즈에만 있으면 기계가 못 읽는다).

---

## 10. Known Gaps — 정형 포맷

```json
"known-gaps": [
  { "category": "form", "type": "date-picker", "reason": "분석 화면에 미등장" },
  { "category": "colors", "type": "link", "reason": "primary와 동일값 mapped 처리" }
]
```

- **필수 섹션.** 갭이 없으면 빈 배열 + 본문에 "없음" 명시 ("확인 안 함"과 구분).
- 컴포넌트 미등장뿐 아니라 **mapped·derived·proposed·fallback으로 채운 토큰 슬롯**도 여기에 기록한다.
- 다음 추출·작업 시 기계가 읽는 "채워야 할 목록"으로 동작한다. 갭이 채워지면 `instance-version`을 올린다.

---

## 11. 후미 JSON 블록 — 최상위 구조

```json
{
  "meta":       { "name": "...", "schema-version": "1.1", "instance-version": "0.1",
                  "mode": "light", "source": "v0-screen", "extracted": "YYYY-MM-DD", "status": "draft" },
  "colors":     { "semantic": { }, "primitive": { } },
  "gradients":  { },
  "typography": { "family": { }, "slots": { } },
  "spacing":    { },
  "rounded":    { },
  "shadow":     { },
  "components": { },
  "motion":     { },
  "layout":     { },
  "rules":      { "normalize": { }, "constraints": [ ] },
  "known-gaps": [ ]
}
```

- frontmatter와 `meta`는 동일 값을 가진다. 충돌 시 JSON(`meta`)이 진실.
- `gradients` / `motion` / `layout`은 선택 — 실재할 때만 포함.
- 토큰 참조 문법은 JSON 내에서도 문자열 `"{colors.primary}"` 그대로 유지한다.

---

## 12. 제품 A 연결 계약 — Phase 5 입력 요건

제품 A의 Phase 5(컨셉 → 표준 MD)가 `source: concept` 인스턴스를 생성하기 위한 입력 요건.

**문제:** 현행 제품 A 데이터 모델에서 컬러 팔레트·무드는 `ConceptJson`이 아니라 `ReferenceResult`(섹션 단위)에 있다. "Phase 5 입력 = ConceptJson"인 현 구조로는 `colors.semantic`을 안정적으로 채울 수 없다.

**해법 (SSoT 유지):** Phase 5 입력을 여러 객체로 늘리지 않는다. 대신 **컨셉 확정 시점에 선택된 팔레트·무드·타이포 방향을 `ConceptJson` 안에 `designBasis` 스냅샷으로 굳힌다.**

```typescript
interface ConceptOption {
  // ...기존 필드 (uiStructure, keyVisual, pages)...
  designBasis: {                    // 확정 시 ReferenceResult에서 스냅샷
    palette: Palette;               // 역할별 hex — semantic 매핑의 원천
    moodKeywords: string[];
    typographyDirection?: string;
  };
}
```

- 이로써 Phase 5는 계속 ConceptJson 하나만 읽는다 (단일 원천 원칙 유지).
- 컨셉 팔레트의 semantic 매핑: `palette.background → canvas`, `palette.text → text`. `on-primary`·`border`처럼 컨셉에 없는 필수 슬롯은 원칙 6(derived, 대비 계산 등)으로 채우고 `source: proposed | derived` 표기.
- **제품 A 측 반영 필요 (액션):** `data-model.md` §6 ConceptOption에 designBasis 추가, CLAUDE.md의 스키마 확정 시점 문구를 본 문서 상단의 확정 절차로 갱신.

---

## 부록 A. 추출 스킬 공통 의무 요약

1. category 7종 전 순회 — 발견 기록 or Known Gaps 기록, 둘 중 하나 필수. (concept 인스턴스는 면제)
2. category별 상태 체크리스트 순회 — 동일 규칙.
3. 실재 우선 기록. derived·proposed 생성 금지(추출 스킬). 필수 토큰 슬롯 충족은 mapped 허용(원칙 6). 판별 불가는 Known Gaps로.
4. 필수 슬롯(컬러 7 / 타이포 7 / spacing 6+base-unit / radius 5 / 컴포넌트 4) 충족 확인.
5. 산출 인스턴스는 `status: draft`로 시작. 후보 여러 버전 → 비교 → 사람 확정 후 `confirmed`.

## 부록 B. 미결로 남긴 것 (Step 2에서 확정)

- normalize 각 전략의 `threshold` 구체 수치(색 거리, 스냅 허용 오차) — 실측 기반 확정. 자리는 §7.1에 마련됨.
- normalize 축 간 실행 우선순위(priority) — apply 구현과 함께 확정.
- `exceptions` 표기 문법(셀렉터 기반인지 영역 기반인지) — 실사용 사례로 확정.
- constraints `scope` 문법의 상세 어휘(복수 scope, 제외 표현).
- 대체 폰트 가이드(브랜드 폰트 → 오픈소스 매핑 노트) — 선택 프로즈 섹션 도입 여부.

## 부록 C. 변경 이력

- **v1.1 (2026-07-09)** — 제품 A DESIGN.md 변환 검증 + 4케이스 시뮬레이션 + 외부 시뮬레이션 피드백 반영:
  semantic 확장 규칙(2.8) / gradients(2.9) / source 5종 체계(2.6: +mapped·proposed·fallback) / 필수 토큰 슬롯 충족 우선순위(원칙 6) /
  radius `xl` / 컴포넌트 크기 접미사(6.7) / motion·layout 선택 축(9) / 복수 테마 소스 규칙(2.7) / apply 실행 전 검사(7.2) /
  확장 섹션 허용(0) / source: concept 완화 규칙(1, 6.2) / normalize 객체 구조 + exceptions + confidence(7.1, 7.3) /
  Phase 5 입력 계약 — designBasis 스냅샷(12) / 스키마 확정 절차 명시(상단).
- **v1.0 (2026-07-09)** — 최초 확정.
