---
id: refboard-ai
name: RefBoard AI
country: KR
category: design-tool
homepage: internal
primary_color: "#6366F1"
verified: "2026-07-09"
omd: "0.1"
ds:
  name: RefBoard AI Design System
  type: internal
  description: "RefBoard AI(제품 A) 워크스페이스 UI — 마스킹 검수, 레퍼런스/무드보드, 컨셉 3안 화면에 쓰이는 토큰·컴포넌트 세트."
tokens:
  source: internal
  extracted: "2026-07-06"
  note: "Design Orchestrator 프로젝트의 제품 A(RefBoard AI) 자체 디자인 시스템. 외부 브랜드 추출 아님."
  colors:
    primary: "#6366F1"
    primary-hover: "#4F46E5"
    primary-light: "#EEF2FF"
    canvas: "#ffffff"
    foreground: "#0F172A"
    text-body: "#475569"
    text-muted: "#64748B"
    text-placeholder: "#94A3B8"
    surface: "#F8FAFC"
    surface-alt: "#F1F5F9"
    border: "#E2E8F0"
    border-strong: "#CBD5E1"
    on-primary: "#ffffff"
    error: "#EF4444"
    success: "#10B981"
    warning: "#F59E0B"
    info: "#0EA5E9"
    locked: "#94A3B8"
  typography:
    family: { sans: "Pretendard" }
    display-lg: { size: 28, weight: 700, lineHeight: 1.3, use: "랜딩 히어로 타이틀, 워크스페이스 대시보드 타이틀" }
    heading-lg: { size: 22, weight: 700, lineHeight: 1.35, use: "섹션 헤더, 모달/다이얼로그 타이틀" }
    heading:    { size: 18, weight: 600, lineHeight: 1.4, use: "카드 헤딩, LNB 스텝 라벨" }
    subtitle:   { size: 16, weight: 600, lineHeight: 1.5, use: "서브섹션 타이틀, 리스트 헤더" }
    body-lg:    { size: 16, weight: 400, lineHeight: 1.6, use: "설명 텍스트, 안내 문구" }
    body:       { size: 14, weight: 400, lineHeight: 1.6, use: "기본 본문 (프로젝트 최소 폰트 크기)" }
    body-sm:    { size: 14, weight: 400, lineHeight: 1.5, use: "보조 정보 — 14px 미만 사용 금지" }
    label:      { size: 14, weight: 600, lineHeight: 1.4, use: "버튼/배지 라벨" }
  spacing: { xs: 4, sm: 8, md: 12, base: 16, lg: 24, xl: 32, xxl: 48 }
  rounded: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 }
  shadow:
    subtle: "0px 1px 3px rgba(15,23,42,0.06)"
    standard: "0px 2px 8px rgba(15,23,42,0.08)"
    elevated: "0px 4px 16px rgba(15,23,42,0.12)"
  components_harvested: true
  components:
    button-fill-primary: { type: button, bg: "#6366F1", fg: "#ffffff", radius: 8, padding: "0 16px", font: "14/600", use: "카드/인라인 실행 액션. 40px 높이" }
    button-fill-primary-xl: { type: button, bg: "#6366F1", fg: "#ffffff", radius: 8, padding: "0 20px", font: "16/600", use: "페이지 하단 마감 CTA(PageCta) — 다음 단계, 확정하기. 48px 높이, 우측 정렬" }
    button-fill-neutral: { type: button, bg: "#334155", fg: "#ffffff", radius: 8, padding: "0 16px", font: "14/600", use: "강한 보조 액션 — 원문 폐기, 사전 등록" }
    button-fill-danger: { type: button, bg: "#EF4444", fg: "#ffffff", radius: 8, padding: "0 16px", font: "14/600", use: "되돌릴 수 없는 파괴적 확인 전용 — 프로젝트 삭제, 원문 폐기. 리스트 제외/닫기에는 쓰지 않음" }
    button-icon-neutral: { type: button, bg: "transparent", fg: "#64748B", radius: 8, padding: "0", use: "X/제외/닫기 — 리스트 항목 제거의 기본값. 32px 정사각, hover bg #E2E8F0" }
    input-box: { type: input, fg: "#1E293B", radius: 8, padding: "10px 12px", font: "14/400", use: "표준 폼 입력 — 사전 단어 추가, 검색" }
    card: { type: card, bg: "#ffffff", radius: 12, use: "기본 서피스 — 레퍼런스 카드, 컨셉 카드, 섹션 카드" }
---

## 1. Visual Theme & Atmosphere

RefBoard AI는 디자이너가 기획서를 업로드하면 분석 → 마스킹 → 레퍼런스/무드보드 → 컨셉 3안까지 자동으로 도출해주는 워크스페이스형 웹앱이다. 화면 톤은 밝고 조용한 화이트 캔버스(`#ffffff`)에 짙은 슬레이트 헤딩(`#0F172A`)과 인디고 액센트(`#6366F1`)로 구성된다. 소비자 앱처럼 감정을 자극할 필요가 없다 — 디자이너가 하루에도 몇 번씩 켜놓고 작업하는 도구이므로, 절제되고 신뢰가는 "작업용 캔버스" 느낌을 목표로 한다.

타이포는 **Pretendard** 단일 패밀리로 통일한다. 한글·영문·숫자가 한 화면에 섞여도 이질감이 없도록 설계된 국문 웹폰트로, 별도의 라틴 폴백 스택이 필요 없다. 웨이트는 400(본문)/600(강조·라벨)/700(헤딩)만 사용하며, 프로젝트 UI/UX 원칙(`CLAUDE.md` §9)에 따라 **모든 텍스트는 14px 이상**을 유지한다 — caption류의 12~13px 축소 표기는 이 프로젝트에서 쓰지 않는다.

색은 인디고 하나를 인터랙션 전용 액센트로 못박고, 나머지는 전부 중립(슬레이트) 톤으로 눌러 마스킹 검수·레퍼런스 비교 같은 정보 밀도 높은 화면에서도 시선이 분산되지 않게 한다.

**Key Characteristics:**
- Indigo(`#6366F1`)를 유일한 인터랙션 컬러로 사용 — CTA, 링크, 활성 스텝, 선택 상태
- Pretendard 단일 패밀리, 3웨이트(400/600/700)로 절제
- 프로젝트 규칙: 모든 텍스트 최소 14px
- 쿨톤 슬레이트 뉴트럴 스케일 (그레이가 아닌 slate — 차갑고 정돈된 느낌)
- 후보(candidate)/확정(confirmed)/잠김(locked) 상태를 색으로 명확히 구분
- 데스크톱 우선(1440px 기준), 좌측 LNB(240px 고정) + 우측 작업 영역 레이아웃
- 그림자는 단일 레이어 저채도 — 깊이감보다 명료함

## 2. Color Palette & Roles

### Primary
- **Indigo** (`#6366F1`): 주 인터랙션 컬러 — CTA, 링크, LNB 활성 스텝, 선택 하이라이트.
- **Indigo Hover** (`#4F46E5`): primary 요소의 hover/pressed 상태.
- **Indigo Light** (`#EEF2FF`): 안내 배경, 은은한 인디고 틴트 서피스 (예: 마스킹 확정 플래시).
- **Pure White** (`#ffffff`): 페이지 배경, 카드 서피스.
- **Slate 900** (`#0F172A`): 최상위 헤딩, 가장 강한 텍스트.

### Semantic
- **Error Red** (`#EF4444`): 오류 상태, **실제 파괴적 액션**(원문 폐기, 영구 삭제)에만 사용. 리스트에서 항목 하나를 빼는 "제외/닫기"류 액션에는 쓰지 않는다 — §4 Buttons·§7 참조.
- **Success Green** (`#10B981`): 마스킹 확정·컨셉 확정 등 완료 표시.
- **Warning Amber** (`#F59E0B`): 검수 필요, 미확정 후보 Section 배지.
- **Info Sky** (`#0EA5E9`): **작은 배지 전용** — 후보 유형 구분(예: 이미지 힌트 scale 배지), "분석이 찾아낸 참고 사실" 같은 보조 정보 라벨. 배너 배경색으로 반복 사용하지 않는다. 화면 사용법·다음 행동 안내 배너는 Sky가 아니라 Primary Light(`#EEF2FF` bg + `#6366F1`/`#4F46E5` text)를 기본으로 쓴다.
- **Locked Slate** (`#94A3B8`): LNB 잠긴 단계, 비활성 요소.

### Banner Color Decision
배너를 만들 때 다음 순서로 색을 고른다:
1. **"이 화면 어떻게 쓰는지" 안내, 다음 행동 유도** → Primary Light (`#EEF2FF` bg, `#6366F1` 아이콘/텍스트). 예: "섹션을 펼쳐서 검색어를 확인하세요", "구성 페이지를 확인하고 분석을 확정하세요".
2. **AI가 찾아낸 사실/발견 사항**(사용자 판단이 필요한 정보지만 사용법 안내는 아님) → 채도 없는 Slate 카드(`--surface-alt` bg, `--border` 테두리, `--text-strong` 헤딩)로 낮춰서 "보조 정보 카드"로 취급. 예: 부모-자식 사이트 관계 감지, 기존 사례분석 감지.
3. **작은 참고 배지 하나만 필요한 경우** → Info Sky를 배지 수준(pill, small text)으로만. 배너 전체를 sky로 채우지 않는다.
4. **검수 필요/미확정** → Warning Amber. **오류/파괴적 액션** → Error Red.

### Neutral Scale (Slate)
- **Slate 50** (`#F8FAFC`): 최소 밝은 배경, 워크스페이스 기본 캔버스 대비용 서피스.
- **Slate 100** (`#F1F5F9`): 보조 배경, 카드 채움, 비활성 서피스.
- **Slate 200** (`#E2E8F0`): 기본 보더, 구분선, 인풋 배경.
- **Slate 300** (`#CBD5E1`): 강조 보더, 활성 인풋 아웃라인.
- **Slate 400** (`#94A3B8`): 플레이스홀더 텍스트, 잠김 아이콘.
- **Slate 500** (`#64748B`): 보조 라벨, 메타 정보.
- **Slate 600** (`#475569`): 본문 텍스트, 설명.
- **Slate 800** (`#1E293B`): 강조 라벨, 내비게이션 텍스트.

### Surface & Borders
- **Border Default**: `#E2E8F0` (slate200). 카드 보더, 인풋 보더, 구분선.
- **Border Strong**: `#CBD5E1` (slate300). 강조 보더, 포커스 아웃라인.
- **Overlay Scrim**: `rgba(15,23,42,0.4)` ~ `rgba(15,23,42,0.6)`. 다이얼로그/드로어 배경 오버레이.

## 3. Typography Rules

### Font Family
- **Primary**: `"Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", Roboto, sans-serif`
- **Monospace**: `"Pretendard", "SF Mono", SFMono-Regular, Menlo, Consolas, monospace` (토큰/코드 표기용 — MaskMapping 토큰 `[회사A]` 등)

### Hierarchy

| Role | Font | Size | Weight | Line Height | Notes |
|------|------|------|--------|-------------|-------|
| Display Large | Pretendard | 28px | 700 | 36px (1.3) | 랜딩 히어로, 대시보드 타이틀 |
| Heading Large | Pretendard | 22px | 700 | 30px (1.35) | 섹션 헤더, 모달 타이틀 |
| Heading | Pretendard | 18px | 600 | 25px (1.4) | 카드 헤딩, LNB 스텝 라벨 |
| Subtitle | Pretendard | 16px | 600 | 24px (1.5) | 서브섹션, 리스트 헤더 |
| Body Large | Pretendard | 16px | 400 | 26px (1.6) | 설명, 안내 문구 |
| Body | Pretendard | 14px | 400 | 22px (1.6) | 표준 본문 (프로젝트 최소 크기) |
| Body Small | Pretendard | 14px | 400 | 21px (1.5) | 보조 정보 — 14px 미만 금지 |
| Label | Pretendard | 14px | 600 | 20px (1.4) | 버튼/배지 라벨 |

### Principles
- **최소 14px 규칙**: 이 프로젝트는 caption류 축소 표기를 쓰지 않는다. 보조 정보도 body-sm(14px)로 통일.
- **세 웨이트만 사용**: Pretendard는 100~900을 지원하지만 UI는 400(본문)/600(강조·라벨)/700(헤딩)만 쓴다.
- **한글-영문 혼용 안정성**: Pretendard는 한글·라틴·숫자 폭 비율이 조화롭게 설계되어 있어 별도 폴백 스택 없이 혼용 텍스트가 자연스럽다.
- **토큰 표기는 모노스페이스**: 마스킹 토큰(`[회사A]`), 코드/키 값은 모노스페이스로 구분해 가독성을 높인다.

## 4. Component Stylings

### Buttons

RefBoard AI `<Button>`은 **variant × size** 2축 컴포넌트. 기본 사이즈는 `large`(40px, 아래 값). 데스크톱 웹 기준이라 모바일 뱅킹 앱류의 56px 대형 버튼은 쓰지 않는다.

**Fill / Primary**
- Background: `#6366F1` / Text: `#ffffff` / Border: none
- Radius: 8px / Padding: 0 16px / Font: 14px / 600
- Use: 카드/인라인 실행 액션 (40px 높이). **페이지 하단 마감 CTA는 `xlarge`(48px) 사이즈를
  쓴다** — `PageCta`(§ Page Layout) 참조, 이 레시피 자체는 변경 없음

**Fill / Neutral**
- Background: `#334155` / Text: `#ffffff` / Border: none
- Radius: 8px / Padding: 0 16px / Font: 14px / 600
- Use: 인디고가 어울리지 않는 강한 보조 액션 — "원문 폐기", "사전에 등록"

**Fill / Danger**
- Background: `#EF4444` / Text: `#ffffff` / Border: none
- Radius: 8px / Padding: 0 16px / Font: 14px / 600
- Use: **되돌릴 수 없는 파괴적 확인만** — "프로젝트 삭제", "원문 폐기". Confirm Dialog 없이 단독으로 두지 않는다.
- **오용 금지**: 리스트에서 항목 하나를 빼는 "제외", "닫기", "지시 삭제" 같은 루틴 액션에는 절대 쓰지 않는다 → Icon/Neutral 또는 Weak/Danger 사용.

**Weak / Primary**
- Background: `rgba(99,102,241,0.12)` / Text: `#4F46E5` / Border: none
- Radius: 8px / Padding: 0 16px / Font: 14px / 600
- Use: Fill/Primary와 함께 쓰는 보조 액션 (예: "미리보기" 옆의 "다운로드")

**Weak / Neutral**
- Background: `#F1F5F9` / Text: `#475569` / Border: none
- Radius: 8px / Padding: 0 16px / Font: 14px / 600
- Use: 취소/닫기 등 중립 보조 액션

**Weak / Danger**
- Background: `rgba(239,68,68,0.12)` / Text: `#DC2626` / Border: none
- Radius: 8px / Padding: 0 16px / Font: 14px / 600
- Use: **영구 삭제이지만 파괴력이 낮은 것** — 내 사전 단어 삭제처럼 "확정 다이얼로그까지는 필요 없는 영구 제거". "검수에서 제외"처럼 원래부터 되돌릴 수 있는 액션에는 이것도 쓰지 않는다 → Icon/Neutral 사용.

**Icon / Neutral**
- Background: `transparent`(기본) / hover `#E2E8F0` / Icon color: `#64748B` (hover `#1E293B`)
- Size: 28~32px 정사각 / Radius: 8px / Border: none
- Use: **X 버튼의 기본값.** 리스트 항목 제외, 닫기, 태그 삭제 등 "삭제처럼 보이면 안 되는 제거 액션" 전부. aria-label은 기능에 맞게 "제외"/"닫기"/"항목 제거" 중 하나로 명시 — "삭제"라고 쓰지 않는다(실제 영구 삭제가 아니라면).

사이즈 스케일 (height · font · radius): `small` 32px · 14px/600 · 6px; `medium` 36px · 14px/600 · 8px; `large`(기본) 40px · 14px/600 · 8px; `xlarge` 48px · 16px/600 · 10px. CSS 변수: `--button-color`, `--button-background-color`, `--button-pressed-opacity`, `--button-disabled-opacity`, `--button-loader-color`.

### Button Hierarchy (화면 위계 규칙)
- **주요 CTA** (다음/확정/적용, 화면당 정확히 1개): Fill Primary. 선택 전에는 비활성(`--locked` 배경), 선택 완료 후에만 Primary 색으로 활성화 — 상태 차이가 색으로 명확히 보여야 한다.
- **보조 실행 액션** (다시 생성, 이미지 생성, 분석하기, 무드 3종 생성): Weak Primary. 주요 CTA와 동시에 노출되어도 시각적으로 절대 더 강해 보이면 안 된다.
- **낮은 우선순위 액션** (복사, 방문, 키워드 복사, 상세 보기): Ghost/Tertiary 또는 아이콘 버튼.
- **제외/닫기**: Icon/Neutral (위 참조).
- **실제 삭제**: Fill Danger 또는 Weak Danger + Confirm Dialog.
- 한 화면 하단에 "확정"과 "다음"을 동시에 Primary로 두지 않는다 — 확정 후에는 확정 상태를 배지/텍스트로 보여주고 다음 단계로 가는 CTA만 Primary로 남긴다.

### Inputs

`<TextField>` 4 variants: `box`(기본), `line`, `search`, `hero`. `hasError`로 오류 상태 토글.

**Box (기본)**
- Background: `#ffffff` / Text: `#1E293B` / Border: 1px solid `#E2E8F0`
- Radius: 8px / Padding: 10px 12px / Font: 14px / 400
- Placeholder: `#94A3B8` / Focus: border `#6366F1`
- Use: 표준 폼 입력 — 사전 단어 추가, 마스킹 예외 입력

**Line**
- Background: transparent / Border: 1px solid `#E2E8F0` (하단만)
- Radius: 0px / Padding: 0 0 4px / Font: 14px / 400
- Use: 인라인 편집형 입력 (검수 화면 내 즉시 수정)

**Search**
- Background: `#F1F5F9` / Border: none
- Radius: 8px / Padding: 8px 12px 8px 36px (좌측 아이콘 여백) / Font: 14px / 400
- Use: 레퍼런스/사전 검색

**Error**
- Background: `#ffffff` / Border: 1px solid `#EF4444`
- Radius: 8px / Padding: 10px 12px / Font: 14px / 400
- Use: `hasError` 상태 — 하단 `#EF4444` 14px 인라인 도움말과 함께

**Select** (`.select-box`, 2026-07-08 추가)
- Background: `#ffffff` / Border: 1px solid `#E2E8F0` / Text: 상속
- Radius: 8px / Padding: 8px 36px 8px 12px (우측 여백에 커스텀 셰브런) / Font: 14px / 400
- Hover: border `#CBD5E1` / Focus: border `#6366F1`
- 커스텀 SVG 셰브런(우측 12px 위치)로 네이티브 appearance를 리셋 — Box variant와 hover/focus 톤을 공유해 같은 컨트롤 패밀리로 읽히게 한다.
- Use: 사이트 전역 `<select>` — 엔티티 등급 드롭다운, 스코프 선택 등. 화면마다 제각각이던 인라인 패딩을 이 클래스 하나로 통일.

### Cards

**Standard**
- Background: `#ffffff` / Border: none / Radius: 12px / Padding: 20px
- Shadow: `0px 2px 8px rgba(15,23,42,0.08)`
- Use: 레퍼런스 카드, 무드보드 카드, 섹션 카드

**Featured**
- Background: `#ffffff` / Border: none / Radius: 16px / Padding: 24px
- Shadow: `0px 2px 8px rgba(15,23,42,0.08)`
- Use: 컨셉 3안 비교 카드 (선택된 안은 `#6366F1` 2px 보더 추가)

**Compact**
- Background: `#ffffff` / Border: 1px solid `#E2E8F0` / Radius: 8px / Padding: 12px / Shadow: none
- Use: 검수 리스트 항목, 사전 단어 리스트 등 인라인 리스트 아이템

### Badges

`<Badge>`는 **variant × color × size** 3축. Variants `fill | weak`. Colors `indigo | green | amber | red | sky | slate`. Sizes `small | medium`(기본).

**상태 배지 (마스킹/Section)**
- **후보(candidate)**: Weak/Amber — `rgba(245,158,11,0.15)` bg, `#B45309` text
- **확정(confirmed)**: Fill/Green — `#10B981` bg, `#ffffff` text
- **잠김(locked)**: Weak/Slate — `#F1F5F9` bg, `#64748B` text

**탐지 종류 배지 (Detection.kind)**
- **rule 탐지**: Weak/Amber — 정규식 자동 탐지 항목 (이메일/전화/URL 등)
- **dictionary 탐지**: Weak/Indigo — 사용자 사전 매칭 항목
- **manual 탐지**: Weak/Slate — 사용자 수동 추가 항목

사이즈 (height · font · padding): `small` 20px · 14px/600 · 3px 8px; `medium`(기본) 24px · 14px/600 · 4px 10px. Radius는 두 사이즈 모두 `9999`(pill).

### Tabs

**LNB 스텝 (활성)**
- Background: `#EEF2FF` / Text: `#4F46E5` / Radius: 8px
- 비활성 완료: `#0F172A` 텍스트 + `#10B981` 체크 아이콘
- 잠김: `#94A3B8` 텍스트, 클릭 비활성
- Font: 14px / 600
- Use: 좌측 LNB 6단계 스테퍼 (업로드/마스킹검수/분석/레퍼런스·무드/컨셉3안/디자인MD)

**Segmented**
- Background: `#F1F5F9` / Text: `#64748B` / Radius: 8px / Padding: 6px 12px
- Active: `#ffffff` 배경 + `#0F172A` 텍스트 + `0px 1px 3px rgba(15,23,42,0.08)` 그림자
- Font: 14px / 600
- Use: 레퍼런스/무드/스킨 프리뷰 뷰 전환

### Toasts

**Default**
- Background: `#0F172A` / Text: `#ffffff` / Radius: 8px / Padding: 12px 16px
- Shadow: `0px 4px 16px rgba(15,23,42,0.12)` / Font: 14px / 500
- Use: 자동 소멸 알림 — "저장되었습니다", "마스킹이 확정되었습니다". 원문 폐기처럼 되돌릴 수 없는 액션은 토스트가 아니라 전용 화면/다이얼로그로 처리.

### Dialogs

**Centered Modal**
- Background: `#ffffff` / Text: `#0F172A` / Radius: 12px / Padding: 24px
- Shadow: `0px 4px 16px rgba(15,23,42,0.12)`
- Use: 확정/파괴적 액션 컨펌 — "원문을 지금 폐기할까요? 되돌릴 수 없습니다."

**Side Drawer**
- Background: `#ffffff` / Text: `#0F172A` / Radius: 12px (좌측 모서리만) / Padding: 24px 20px
- Shadow: `-4px 0px 16px rgba(15,23,42,0.08)`
- Use: 데스크톱 우측에서 슬라이드되는 보조 패널 — 사전 관리(DictionaryManager), 상세 레퍼런스 출처 보기

### Toggles

**Default**
- Background: `#6366F1`(on) / `#CBD5E1`(off) / Radius: 9999px
- Thumb: `#ffffff` 18px 원, `0px 1px 2px rgba(15,23,42,0.1)` 그림자
- Use: 불리언 설정 — "실명 미리보기", "다크 모드"

### LNB Stepper (RefBoard AI 고유 컴포넌트)

- 6단계: ① 업로드 ② 마스킹 검수 ③ 분석 ④ 레퍼런스·무드 ⑤ 컨셉 3안 ⑥ 디자인 MD
- 각 단계 상태: **완료(✓, `#10B981` 아이콘)** / **현재(●, `#6366F1` 배경)** / **잠김(비활성, `#94A3B8`)**
- 잠긴 단계는 클릭 시 `canAccessStep` 가드로 차단 — 시각적으로도 커서 `not-allowed` + 툴팁("마스킹을 먼저 완료하세요")
- 항상 워크스페이스 좌측에 고정 노출(240px, ≥1024px). <1024px에서는 상단 바 + 슬라이드 드로어로 전환(§8 Responsive Behavior 참조)

### Page Layout (RefBoard AI 고유 컴포넌트, 2026-07-09 추가)

`components/shell/PageLayout.tsx` — 모든 단계 화면이 같은 "제품"처럼 보이도록 구조를 한 곳에서 강제하는 공통 셸. 각 화면(마스킹 검수/분석/레퍼런스/컨셉 등)은 자기 카드 스택만 채우고 이 틀을 재사용한다.

- **구조(고정 순서):** `banner`(선택) → `title`(22px/700) + `description`(선택, 16px/`--text-muted`) → `children`(화면 고유 카드 스택) → `cta`(선택, 카드 밖·맨 아래·우측 정렬). 전체 세로 gap은 `--space-base`.
- **타이틀 존은 박스로 감싸지 않는다** — "카드 안에 카드를 두르지 않는다" 원칙과 동일하게, 여백만으로 구분한다.
- **`pageCardStyle`**: 화면마다 제각각이던 카드 스타일(배경/보더/라운드/패딩)을 표준화한 공유 `CSSProperties` — `--surface` bg, `--border` 1px, `--radius-lg`, `--space-lg` 패딩, 세로 flex + `--space-md` gap.
- **`PageCta`**: 하단 CTA 버튼의 표준 컴포넌트. `button-fill-primary-xl`(48px·16px/600) 사이즈, 우측 정렬. `locked` prop이 true면 `--locked` 배경(완료/비활성 상태 표현), 기본은 `.btn-primary`. 보조 액션(임시저장류)은 주 CTA 바로 왼쪽에 Weak Primary로, 파괴적·역방향 액션은 반대편(좌측)에 분리 배치한다(게시판 관례).
- 신규 화면을 만들 때는 로컬로 타이틀/카드/CTA 스타일을 새로 잡지 말고 이 컴포넌트를 우선 재사용한다.

---

**Verified:** 2026-07-09 (내부 확정, 외부 소스 없음 — 7/8~7/9 레이아웃/컴포넌트 변경분 반영)
**출처:** `CLAUDE.md`, `data-model.md`, `phase1-masking-spec.md` (RefBoard AI 프로젝트 내부 문서). 외부 브랜드 벤치마킹 값 없음 — 이 디자인 시스템은 RefBoard AI 자체 산출물이다.

## 5. Layout Principles

### Spacing System
- Base unit: 8px
- Common values: 4px, 8px, 12px, 16px, 24px, 32px, 48px
- 카드 내부 패딩: 20px (Standard), 24px (Featured)
- 검수 리스트 항목 간격: 8px (밀도 높은 화면)

### Grid & Container
- Design baseline: 1440px 데스크톱 (RefBoard AI는 데스크톱 웹 워크스페이스가 1차 타겟)
- LNB: 240px 고정 폭(데스크톱, ≥1024px) / 작업 영역: 유동 폭, 최대 1600px 중앙 정렬, 패딩 40px
  (2026-07-08 변경 — 화면마다 다르던 hardcoded maxWidth 캡을 없애고 셸 전체 폭을 카드가 채우도록 통일. 컨셉 비교만 따로 좁히지 않는다.)
- 컨셉 3안 비교는 3열 그리드 고정, 레퍼런스 카드는 반응형 2~4열 그리드

### Whitespace Philosophy
- **단계별 밀도 차등**: 업로드/마스킹검수처럼 신중해야 하는 단계는 여백을 넉넉히 두고, 레퍼런스 비교처럼 많은 정보를 훑어야 하는 단계는 밀도를 높인다.
- **그룹 단위 분리**: 서로 다른 Section/기능 그룹은 24px+ 간격, 같은 그룹 내 항목은 8~12px 간격.
- **잠금 상태의 시각적 여백**: 잠긴 LNB 단계는 텍스트 대비를 낮추고 여백은 동일하게 유지해 레이아웃 흔들림 없이 상태만 바뀌게 한다.

### Border Radius Scale
- Compact (4px): 인라인 요소, 작은 구분선
- Standard (8px): 인풋, 버튼, 컴팩트 카드
- Comfortable (12px): 표준 카드, 다이얼로그 모서리
- Large (16px): 컨셉 비교 카드(Featured)
- Pill (9999px): 배지, 토글, LNB 스텝 인디케이터

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (Level 0) | No shadow | 페이지 배경, 인라인 요소 |
| Subtle (Level 1) | `0px 1px 3px rgba(15,23,42,0.06)` | 리스트 아이템 구분 |
| Standard (Level 2) | `0px 2px 8px rgba(15,23,42,0.08)` | 카드, 콘텐츠 패널 |
| Elevated (Level 3) | `0px 4px 16px rgba(15,23,42,0.12)` | 드롭다운, 팝오버, 토스트 |
| Modal (Level 4) | `0px 8px 24px rgba(15,23,42,0.16)` | 다이얼로그, 사이드 드로어 |

**Shadow Philosophy**: 정보 밀도가 높은 워크스페이스 툴이라 그림자는 최소한으로 유지한다. 시각적 노이즈는 검수 정확도를 떨어뜨린다 — 깊이감보다 항목 간 명확한 구분이 우선이다. 단일 레이어, 저채도 슬레이트 그림자만 사용하며 컬러 그림자는 쓰지 않는다.

### Blur Effects
- 사이드 드로어/드롭다운은 배경 블러 없이 스크림 오버레이만 사용 (성능·가독성 우선)

## 7. Do's and Don'ts

### Do
- 인터랙션 요소에는 Indigo(`#6366F1`)만 사용 — 링크, 버튼, 선택 상태, 활성 LNB 스텝
- 화면 사용법·다음 행동 안내 배너는 Primary Light(`#EEF2FF`+`#6366F1`)를 기본으로 사용
- 모든 텍스트 최소 14px 유지 (caption 축소 표기 금지)
- 후보(amber)/확정(green)/잠김(slate) 배지 색을 항상 구분해서 표시
- 파괴적 액션(원문 폐기, 삭제)은 반드시 Dialog로 컨펌 받은 후 실행
- X/제외/닫기 버튼은 Icon/Neutral(무채색) 사용 — "삭제"가 아니라 "제외"로 라벨링
- 한 화면의 하단 Primary CTA는 1개만 유지, 보조 버튼은 항상 그보다 낮은 위계로 표현
- 라운드는 8px(버튼/인풋)~12px(카드) 범위 유지

### Don't
- Indigo를 장식용으로 쓰지 않는다 — 인터랙션 불가능한 요소에 색을 입히지 않는다
- Sky/Info를 배너 배경으로 반복 사용하지 않는다 — 작은 배지·보조 정보 수준으로만 제한
- Red/Danger를 리스트 항목 제외·닫기 같은 되돌릴 수 있는 액션에 쓰지 않는다 — 실제 파괴적 액션·오류 전용
- 무거운 그림자로 깊이를 표현하지 않는다 — 배경색 레이어링으로 대체
- 본문에 700 굵기를 쓰지 않는다 — 헤딩·강조 전용
- 마스킹 미확정 상태에서 다음 단계 잠금을 해제하지 않는다 (보안 하드 게이트, §4.3 `CLAUDE.md`)
- 원문(`parsedText`)·복원매핑(`mappings`)을 화면 어디에도 영구 표시하지 않는다 — 렌더 시점에만 생성

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Desktop (Primary) | ≥1024px | 전체 디자인 충실도, LNB 고정 사이드바 240px |
| Mobile + Tablet | <1024px | LNB가 상단 바 + 슬라이드 드로어로 전환(햄버거로 열고 닫음), 셸이 세로 스택으로 전환. 1차 지원 타겟 아님 — 열람 위주 |
| Phone 보조 조정 | <768px | 작업 영역 패딩만 40px→20px로 축소(레이아웃 구조는 위 단계와 동일) |

(2026-07-08 변경 — 태블릿/모바일을 별도 단계로 나누지 않고 1024px 단일 브레이크포인트로 통합. `Lnb.tsx`/`globals.css` §11 참조.)

### Touch/Click Targets
- 버튼: large(40px, 기본), medium(36px), small(32px)
- 리스트 항목: 최소 40px 행 높이 (검수 화면 클릭 정확도)
- LNB 스텝: 최소 44px 클릭 영역

### Collapsing Strategy
- 태블릿 이하에서는 사이드 드로어가 모달로 전환
- 컨셉 3안 비교는 태블릿에서 2열, 모바일에서 1열 스택으로 축소

### Image Behavior
- 무드보드 이미지(Unsplash/Pexels): 반응형 그리드, 원본 비율 유지
- 레퍼런스 썸네일: 고정 4:3, lazy loading

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary CTA: Indigo (`#6366F1`)
- CTA Hover: Indigo Hover (`#4F46E5`)
- Background: Pure White (`#ffffff`)
- Background Surface: Slate 50/100 (`#F8FAFC` / `#F1F5F9`)
- Heading text: Slate 900 (`#0F172A`)
- Body text: Slate 600 (`#475569`)
- Border: Slate 200 (`#E2E8F0`)
- Success/확정: Green (`#10B981`)
- Error/미확정 경고: Red (`#EF4444`) / Amber (`#F59E0B`)

### Example Component Prompts
- "마스킹 검수 리스트 아이템 만들어줘: 흰 배경, 1px 슬레이트200 보더, 8px 라운드, 12px 패딩. 좌측에 원문 일부(14px/400/#1E293B), 우측에 종류 배지(pill, weak/amber)와 토글 스위치."
- "레퍼런스 카드 만들어줘: 흰 배경, 12px 라운드, 20px 패딩, standard 그림자. 상단 썸네일 4:3, 하단 플랫폼명(14px/600/#0F172A) + 출처 링크(14px/400/#64748B)."
- "컨셉 3안 비교 카드 만들어줘: 흰 배경, 16px 라운드, 24px 패딩. 선택된 카드는 인디고 2px 보더. 상단 컨셉 키워드 배지 3개, 중앙 키비주얼 프리뷰, 하단 '이 안으로 확정' primary 버튼."
- "LNB 스텝 만들어줘: 240px 폭 세로 리스트, 6단계. 완료 단계는 초록 체크 아이콘, 현재 단계는 인디고 배경 pill, 잠긴 단계는 슬레이트400 텍스트에 클릭 비활성."
- "마스킹 확정 컨펌 다이얼로그 만들어줘: 중앙 모달, 12px 라운드, 24px 패딩. 타이틀 '마스킹을 확정할까요?', 본문에 '확정 후 원문은 즉시 폐기됩니다' 경고 문구, 하단 취소(weak/neutral)·확정(fill/primary) 버튼."

### Iteration Guide
1. 항상 Pretendard 단일 폰트 스택 사용, 라틴 폴백 별도 불필요
2. 주 인터랙션 컬러는 `#6366F1` — 장식용으로 절대 사용 금지
3. 모든 텍스트 최소 14px — 이보다 작은 크기 지정 금지
4. 슬레이트 뉴트럴 스케일: slate900 `#0F172A` ~ slate50 `#F8FAFC`
5. 라운드: 8px 버튼/인풋, 12px 카드, 16px Featured 카드, pill 배지/토글
6. 그림자는 단일 레이어, 순수 슬레이트 저채도, 컬러 틴트 없음
7. 데스크톱 우선: 1440px 기준, LNB 240px 고정 + 작업 영역

---

## 10. Voice & Tone

RefBoard AI는 소비자 앱이 아니라 디자이너의 작업 도구다. 톤은 친근함보다 **명확함과 신뢰**를 우선한다: 짧고 구체적인 문장, 과장 없는 상태 안내, 되돌릴 수 없는 액션은 반드시 명시적으로 경고한다. 한국어가 기본이며 기술 용어(토큰명, API명 등)는 영문을 그대로 쓴다.

| Context | Tone |
|---|---|
| CTA | 짧은 동사형 (`다음 단계`, `확정하기`, `적용`) |
| 성공 토스트 | 과거형 한 문장 (`마스킹이 확정되었습니다`). 이모지 없음. |
| 오류 메시지 | 구체적 + 원인 명시 + 조치 가능. `오류가 발생했습니다` 같은 모호한 표현 금지. |
| 검수 안내 | 왜 필요한지 한 줄 설명 후 액션 유도 (`민감정보 3건이 탐지되었어요. 확인 후 확정해주세요.`) |
| 보안 경고 | 격식체(`합니다`체) — 유일하게 격식을 쓰는 예외 (`복원 매핑은 세션을 벗어나면 소멸합니다.`) |
| 빈 상태 | 왜 비어있는지 한 줄 + 액션 1개 제시. `데이터가 없습니다` 금지. |

**금지 표현.** `죄송합니다`(사과성 표현 남발), `Oops`, 모호한 `문제가 발생했습니다`, 파괴적 액션에 대한 완곡어법. 원문/복원매핑과 관련된 보안 경고는 반드시 구체적 결과(무엇이 사라지는지)를 명시한다.

## 11. Brand Narrative

RefBoard AI는 "Design Orchestrator" 프로젝트의 제품 A로, 디자이너가 프로젝트마다 반복하는 레퍼런스 탐색 시간을 줄이기 위해 만들어졌다. 기획서를 업로드하면 분석 → 레퍼런스/무드보드 → 컨셉 3안까지 자동으로 도출되며, 디자이너는 결과를 검수·선택하는 데만 시간을 쓴다.

현재는 단독 사용자(디자이너 1인)를 전제로 만들어지고 있지만, 추후 사내 디자인팀 배포 가능성을 염두에 두고 설계된다 — 그래서 키 노출 없는 서버 구조, 클라이언트 중심 렌더링, 세션 단위 격리가 처음부터 아키텍처의 일부다.

가장 중요한 설계 원칙은 보안이다: 기획서 원문에는 실명·연락처·사업자번호 같은 민감정보가 그대로 들어있는 경우가 많고, 무료 티어 AI API는 프롬프트를 학습에 사용할 수 있다. 그래서 RefBoard AI는 마스킹을 통과하지 못한 텍스트가 외부 API로 넘어갈 수 없는 하드 게이트를 UI와 로직 양쪽에 둔다. 이 원칙이 색·컴포넌트보다 먼저 정해졌고, 이 디자인 시스템의 모든 상태 배지(후보/확정/잠김)는 결국 이 보안 게이트를 사용자에게 보여주기 위한 장치다.

## 12. Principles

1. **마스킹 없이는 외부로 나가지 않는다.** 이 원칙은 UI에도 물리적으로 반영된다 — 마스킹 미완료 시 이후 LNB 단계는 전부 잠긴다.
2. **최소 폰트 14px.** 가독성은 협상 대상이 아니다. caption류 축소 표기를 쓰지 않는다.
3. **후보와 확정은 항상 시각적으로 분리한다.** amber(candidate)와 green(confirmed)을 혼동할 수 없게 유지한다.
4. **Indigo는 인터랙션 전용, 장식 아님.** 클릭할 수 없는 요소에는 색을 입히지 않는다.
5. **그림자는 절제한다.** 데이터 신뢰는 깊이감이 아니라 명료한 구분에서 나온다.
6. **진행 상태는 항상 보여준다.** LNB 스테퍼는 워크스페이스 어디서든 상시 노출.
7. **AI 결과는 초안이다.** Gemini 분석·생성 결과는 확정 전 반드시 사용자 검수 단계를 거친다.
8. **여백은 정보 밀도를 조절하는 도구다.** 신중해야 하는 단계(업로드/마스킹)는 여유롭게, 비교가 필요한 단계(레퍼런스/컨셉)는 밀도 있게.

## 13. Personas

*아래 페르소나는 RefBoard AI의 실제 사용 시나리오를 바탕으로 한 예시 프로필이다.*

**디자이너** RefBoard AI의 실사용자이자 제작자. 하루에도 여러 프로젝트를 병행하며, 프로젝트마다 레퍼런스를 새로 찾는 대신 업로드 한 번으로 초안을 받길 원한다. 마스킹 검수 단계에서 오탐(false positive)을 빠르게 해제할 수 있어야 하고, 컨셉 3안을 비교할 때는 텍스트 설명보다 시각적 프리뷰를 먼저 본다.

**(추후) 디자인팀 동료.** 사내 배포 이후를 가정한 페르소나. 각자 독립된 세션에서 작업하며, 서로의 마스킹 사전이나 원문에 접근할 수 없어야 한다 — 개인별 보안 격리가 전제.

**(추후) 검수 PM.** 마스킹 로직이나 API 구조는 몰라도 되지만, 컨셉 3안 비교 화면만 보고 방향을 결정해야 한다. 화면은 기술 용어(스킬명, 라이브러리명, MCP 등) 없이 비개발자도 읽을 수 있어야 한다.

## 14. States

| State | Treatment |
|---|---|
| **Empty (업로드 전)** | 랜딩 화면 중앙 업로드 UI만. LNB 없음. |
| **Empty (레퍼런스 결과 없음)** | `slate500` 한 줄 안내(`조건에 맞는 레 퍼런스를 찾지 못했어요`) + 재시도 버튼 |
| **Loading (분석 중)** | 스켈레톤 블록 + `#6366F1` 상단 진행 바. "분석 중" 라벨 노출 |
| **Loading (레퍼런스 수집 중)** | 플랫폼별 개별 progress indicator, 완료된 플랫폼부터 순차 표시 |
| **Error (마스킹 미완료)** | 잠긴 LNB 단계에 툴팁(`마스킹을 먼저 완료하세요`) + 인라인 경고 배너 |
| **Error (API 실패)** | 다크 토스트 + 재시도 버튼. 원문/마스킹 상태는 그대로 보존 |
| **Success (마스킹 확정)** | 해당 요소에 `#EEF2FF` 배경 300ms 플래시, 다음 LNB 단계 잠금 해제 |
| **Success (컨셉 확정)** | 전용 확정 화면 — 선택된 안 강조, 다운로드 CTA(HTML/PPT/PDF) 노출 |

## 15. Motion & Easing

**Durations:**

| Token | Value | Use |
|---|---|---|
| `motion-instant` | 0ms | 토글, 체크박스 상태 변경 |
| `motion-fast` | 150ms | hover, focus, 버튼 press 오버레이 |
| `motion-standard` | 250ms | 기본값 — 카드 확장, 세그먼트 탭 전환 |
| `motion-slow` | 400ms | 강조 전환 — 마스킹 확정 애니메이션 |
| `motion-step` | 300ms | LNB 단계 전환 (콘텐츠 영역 페이드) |

**Easings:**

| Token | Curve | Use |
|---|---|---|
| `ease-enter` | `cubic-bezier(0.0, 0.0, 0.2, 1)` | 나타나는 요소 — 토스트, 드로어 |
| `ease-exit` | `cubic-bezier(0.4, 0.0, 1, 1)` | 사라지는 요소 — 다이얼로그 닫기 |
| `ease-standard` | `cubic-bezier(0.4, 0.0, 0.2, 1)` | 양방향 전환 — 카드 확장, 탭 콘텐츠 |
| `ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 예약됨. 컨셉 3안 중 하나를 선택 확정할 때만 사용 |

**Signature motions.**

1. **LNB 단계 전환.** 콘텐츠 영역이 8px 위로 살짝 슬라이드하며 페이드 인 (`motion-step / ease-standard`). 사이드바는 고정, 오른쪽 작업 영역만 전환.
2. **마스킹 확정 전환.** 검수 리스트 → 마스킹 미리보기로 크로스페이드하며 토큰이 하이라이트로 한 번 깜빡인다 (`motion-slow / ease-enter`).
3. **컨셉 카드 선택.** 선택된 카드가 살짝 확대되며 인디고 보더가 그려진다 (`motion-standard / ease-spring`) — spring이 허용되는 유일한 지점.
4. **Reduce motion.** `prefers-reduced-motion: reduce` 시 모든 `motion-*` 토큰이 `motion-instant`로 축소. 슬라이드는 크로스페이드로 대체.

---

## Included Components

The following components are part of this design system:

- Button
- Input
- Card
- Badge
- Tabs
- Toast
- Dialog
- Toggle
- LNB Stepper
- Page Layout

---

## Iconography & SVG Guidelines

### Icon Library

일관성을 위해 프로젝트 전체에서 단일 아이콘 라이브러리만 사용한다.

- **Lucide React** (`lucide-react`): 권장 기본값. 1,400개 이상 아이콘, tree-shakeable, 24x24 그리드 기준, Next.js/shadcn 스택과 호환성 좋음.

### SVG Usage Rules

- 모든 아이콘은 `<img>` 태그가 아닌 인라인 SVG 컴포넌트로 사용 (색상/크기 제어를 위해).
- 아이콘 크기는 타입 스케일을 따른다: 16px(인라인), 20px(버튼), 24px(단독).
- 아이콘 색상은 `currentColor`를 상속 — 하드코딩된 fill/stroke 금지.
- Stroke width: 아웃라인 아이콘 1.5px~2px, 프로젝트 전체 일관 유지.

### Icon Sizing Scale

| Context | Size | Usage |
|---------|------|-------|
| Inline text | 16px (1rem) | 배지, 라벨 |
| Button icon | 18px (1.125rem) | 아이콘 버튼, CTA 아이콘 |
| Standalone | 24px (1.5rem) | LNB, 카드 아이콘 |
| Feature | 32-48px | 빈 상태, 온보딩 |

### SVG Optimization

- 커스텀 SVG는 커밋 전 SVGO로 최적화한다.
- 불필요한 속성 제거: `xmlns`, `xml:space`, 에디터 메타데이터.
- 확장성을 위해 고정 `width`/`height` 대신 `viewBox` 사용.

---

## Document Policies

### No Emojis

이 디자인 시스템은 UI 요소, 컴포넌트, 라벨, 상태 표시, 문서 어디에도 이모지를 쓰지 않는다.
대신 선택한 아이콘 라이브러리의 SVG 아이콘을 사용한다.

- 상태 표시: 컬러 점 또는 아이콘 컴포넌트 사용, 이모지 금지.
- 섹션 마커: 텍스트 프리픽스(`DO:` / `DON'T:`) 또는 아이콘 사용, 체크/크로스 이모지 금지.
- 내비게이션: 아이콘 컴포넌트 사용, 이모지 금지.

### Format Compliance

이 문서는 Google Stitch DESIGN.md 9섹션 포맷을 따른다:
1. Visual Theme & Atmosphere
2. Color Palette & Roles
3. Typography Rules
4. Component Stylings
5. Layout Principles
6. Depth & Elevation
7. Do's and Don'ts
8. Responsive Behavior
9. Agent Prompt Guide

확장 섹션:
- Voice & Tone / Brand Narrative / Principles / Personas / States / Motion & Easing
- Iconography & SVG Guidelines
- Document Policies

Total target length: 250-400 lines. 각 섹션은 간결하고 실행 가능하게 유지한다.
