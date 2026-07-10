---
name: RefBoard AI
schema-version: "1.1.1"
instance-version: "1.0"
mode: light
source: internal-md
extracted: "2026-07-09"
status: confirmed
---

# RefBoard AI — 디자인 MD (표준 스키마 v1.1 인스턴스)

## 1. Overview

RefBoard AI는 기획서 업로드부터 컨셉 3안 도출까지를 다루는 워크스페이스형 웹앱이다. 밝고 조용한 `{colors.canvas}` 위에 짙은 슬레이트 헤딩(`{colors.foreground}`)과 인디고 액센트(`{colors.primary}`)로 구성되며, 감정 자극이 아니라 "절제되고 신뢰가는 작업용 캔버스"를 지향한다. 색은 인디고 하나를 인터랙션 전용으로 못박고 나머지는 전부 쿨톤 슬레이트 중립으로 눌러, 마스킹 검수·레퍼런스 비교 같은 정보 밀도 높은 화면에서 시선이 분산되지 않게 한다. 타이포는 Pretendard 단일 패밀리, 웨이트 3종(400/600/700), 모든 텍스트 최소 14px.

**변환 노트 (원본 → 표준 스키마 정규화 결정):**
- 버튼 radius 파편값(small 6px, xlarge 10px)은 `{rounded.md}`(8px)로 통일.
- 버튼 사이즈 medium(36px)은 표준(40px)과 역할 구분이 약해 제거 — 32/40/48 3단계로 정리.
- 토스트의 웨이트 500은 "웨이트 3종만" 원칙과 충돌 → `{typography.button}`(600)으로 정규화.
- 오버레이 스크림 범위값(0.4~0.6)은 0.5 단일값으로 확정.

## 2. Colors

인터랙션은 `{colors.primary}` 단일 계열: CTA, 링크, 활성 스텝, 선택 하이라이트. `{colors.primary-light}`는 안내 배너·확정 플래시 배경, `{colors.primary-weak}`는 Weak 버튼 틴트 전용. 텍스트는 `{colors.foreground}`(최상위 헤딩) → `{colors.text}`(본문) → `{colors.text-muted}`(보조) → `{colors.text-placeholder}` 4단으로 위계를 만든다. 상태색은 후보(`{colors.warning}`)/확정(`{colors.success}`)/잠김(`{colors.locked}`)이 혼동 불가능하게 항상 분리된다. `{colors.error}`는 오류와 실제 파괴적 액션 전용이며, 리스트 제외·닫기류에는 쓰지 않는다. `{colors.info}`는 작은 배지 수준으로만 제한한다. 배경↔텍스트는 항상 쌍으로: `canvas↔text`, `surface↔text`, `primary↔on-primary`, `surface-inverse↔on-primary`.

## 3. Typography

Pretendard 단일 패밀리(한글·라틴·숫자 혼용 안정), 마스킹 토큰(`[회사A]`) 등 코드성 표기만 mono 스택. 슬롯은 `display`(히어로) → `heading`(섹션·모달) → `heading-sm`(카드·LNB 라벨) → `title`(서브섹션) → `body-lg`(안내) → `body`(기본, 프로젝트 최소 크기) → `body-sm`(보조)로 흐른다. **이 프로젝트는 caption류 축소 표기를 정책적으로 금지**하므로 `caption`은 `body-sm` 값으로 매핑되어 있다(mapped). 본문에 700을 쓰지 않는다 — 700은 헤딩 전용.

## 4. Layout

base-unit 8px. 데스크톱 우선(기준 1440px), 좌측 LNB 240px 고정 + 우측 작업 영역(최대 1600px, 패딩 40px). 워크스페이스 앱이라 마케팅형 대여백이 없어 `section`은 그룹 간 분리 간격(24px)으로 매핑되어 있다. 밀도는 단계별 차등: 신중해야 하는 단계(업로드·마스킹)는 여백을 넉넉히, 비교 단계(레퍼런스·컨셉)는 밀도 있게. 같은 그룹 내 항목은 `{spacing.sm}`~`{spacing.md}`, 그룹 간은 `{spacing.lg}` 이상.

## 5. Shape & Elevation

radius: `{rounded.md}` 버튼·인풋, `{rounded.lg}` 카드·다이얼로그, `{rounded.xl}` Featured 카드, `{rounded.full}` 배지·토글·스텝 pill, `{rounded.none}`은 라인 인풋의 의도적 선언. 그림자는 단일 레이어 저채도 슬레이트만 — 깊이감보다 명료한 구분이 우선이며, 컬러 틴트 그림자는 금지. 배경 블러 없이 스크림 오버레이만 사용한다.

## 6. Components

버튼은 채움 3종(`button-primary`/`button-neutral`/`button-danger`) + 틴트 3종(`button-weak-*`) + `button-icon-neutral` + `text-link`로 위계를 만든다. 핵심 규칙: 주 CTA는 화면당 1개(Fill Primary), 보조 실행은 Weak Primary(CTA보다 강해 보이면 안 됨), **X/제외/닫기의 기본값은 button-icon-neutral** — "삭제처럼 보이면 안 되는 제거"에 danger를 쓰지 않는다. 라벨도 "삭제"가 아니라 "제외/닫기"로.

인풋은 `input-default`(box)를 기준으로 `input-line`(인라인 편집), `input-search`, `select-default`가 같은 컨트롤 패밀리 톤을 공유한다. 카드는 `card-default`(20px 패딩) / `card-featured`(컨셉 3안 비교, 선택 시 primary 2px 보더) / `card-compact`(리스트 항목, 그림자 없음) 3단. 배지는 후보/확정/잠김 상태 표현이 1순위 역할. `nav-lnb`는 이 제품의 고유 컴포넌트로, 6단계 스테퍼가 보안 게이트(마스킹 미완료 시 잠김)를 시각적으로 강제한다. `page-layout`은 모든 단계 화면의 공통 셸 — 신규 화면은 로컬 스타일을 새로 잡지 말고 이 구조를 재사용한다.

## 7. Rules

(후미 JSON `rules.constraints`에서 파생 — 값의 원천은 JSON)

**Do:**
- 인터랙티브 요소에는 primary 계열만 사용
- 사용법·다음 행동 안내 배너는 alert-guide(primary-light)를 기본으로
- 모든 텍스트 14px 이상 유지
- 후보/확정/잠김 배지 색 항상 분리
- 파괴적 액션은 반드시 Dialog 컨펌 후 실행
- X/제외/닫기는 button-icon-neutral로
- 화면 하단 Primary CTA는 1개만

**Don't:**
- primary를 장식용으로 사용 금지 (클릭 불가 요소에 색 입히지 않음)
- info(sky)를 배너 배경으로 반복 사용 금지 — 작은 배지 수준만
- danger를 되돌릴 수 있는 액션(제외·닫기)에 사용 금지
- hover에서 transform·그림자 변화 금지 — 색상 전환만
- 본문에 700 웨이트 금지
- 무거운 그림자로 깊이 표현 금지 — 배경색 레이어링 우선

## 8. Known Gaps

없음이 아니다 — 아래 항목이 미확인/매핑 상태로 남아 있다 (상세는 후미 JSON `known-gaps`). 대표: form 계열(checkbox·radio·textarea·date-picker) 미등장, file-upload·accordion·tooltip·progress-bar는 실재하나 스타일 미정의, `scrim`은 스키마 §2.8 독립 역할 어휘표 밖(어휘표 확장 검토 필요), `primary-active` 미정의(hover만 실재).

---

## Motion (확장 섹션)

전환은 5단계 duration(instant~slow + step)과 4종 easing으로 통제한다. spring은 컨셉 확정 순간에만 허용되는 시그니처. `prefers-reduced-motion` 시 모든 duration이 instant로 축소되고 슬라이드는 크로스페이드로 대체된다. 시그니처 모션: LNB 단계 전환(콘텐츠 8px 슬라이드+페이드), 마스킹 확정(토큰 하이라이트 플래시), 컨셉 카드 선택(확대+인디고 보더).

---

```json
{
  "meta": {
    "name": "RefBoard AI",
    "schema-version": "1.1.1",
    "instance-version": "1.0",
    "mode": "light",
    "source": "internal-md",
    "extracted": "2026-07-09",
    "status": "confirmed"
  },

  "colors": {
    "semantic": {
      "primary":          "#6366F1",
      "primary-hover":    "#4F46E5",
      "primary-light":    { "value": "#EEF2FF", "use": "안내 배너 배경, 확정 플래시, LNB 활성 스텝 배경" },
      "primary-weak":     { "value": "rgba(99,102,241,0.12)", "use": "Weak Primary 버튼 배경 틴트" },
      "on-primary":       { "value": "#ffffff", "use": "primary·neutral·danger 채움 및 인버스 배경 위 텍스트/아이콘 공통" },
      "canvas":           "#ffffff",
      "surface":          "#F8FAFC",
      "surface-alt":      { "value": "#F1F5F9", "use": "보조 배경, 비활성 서피스, weak-neutral 버튼 배경" },
      "surface-inverse":  { "value": "#0F172A", "source": "mapped", "from": "foreground", "use": "다크 토스트 배경" },
      "foreground":       { "value": "#0F172A", "use": "최상위 헤딩, 가장 강한 텍스트" },
      "text":             "#475569",
      "text-strong":      { "value": "#1E293B", "use": "입력값 텍스트, 내비게이션 텍스트, 강조 라벨" },
      "text-muted":       "#64748B",
      "text-placeholder": { "value": "#94A3B8", "use": "플레이스홀더, 잠김 아이콘" },
      "border":           "#E2E8F0",
      "border-strong":    { "value": "#CBD5E1", "use": "강조 보더, 토글 off 트랙" },
      "neutral":          { "value": "#334155", "use": "강한 보조 액션 채움 버튼 배경 (button-neutral)" },
      "error":            "#EF4444",
      "error-weak":       { "value": "rgba(239,68,68,0.12)", "use": "Weak Danger 버튼 배경 틴트" },
      "error-strong":     { "value": "#DC2626", "use": "Weak Danger 버튼 텍스트" },
      "success":          "#10B981",
      "warning":          "#F59E0B",
      "warning-weak":     { "value": "rgba(245,158,11,0.15)", "use": "후보 배지 배경 틴트" },
      "warning-strong":   { "value": "#B45309", "use": "후보 배지 텍스트" },
      "info":             { "value": "#0EA5E9", "use": "작은 배지 전용 — 배너 배경 사용 금지" },
      "locked":           { "value": "#94A3B8", "use": "LNB 잠긴 단계, 비활성 CTA 배경" },
      "scrim":            { "value": "rgba(15,23,42,0.5)", "use": "다이얼로그/드로어 오버레이 — §2.8 어휘표 밖 토큰, Known Gaps 참조" },
      "link":             { "value": "#6366F1", "source": "mapped", "from": "primary", "use": "링크 전용 색 없음 — primary 겸용" }
    },
    "primitive": {
      "slate-50":  "#F8FAFC",
      "slate-100": "#F1F5F9",
      "slate-200": "#E2E8F0",
      "slate-300": "#CBD5E1",
      "slate-400": "#94A3B8",
      "slate-500": "#64748B",
      "slate-600": "#475569",
      "slate-800": "#1E293B",
      "slate-900": "#0F172A"
    }
  },

  "typography": {
    "family": {
      "sans": "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Segoe UI', Roboto, sans-serif",
      "mono": "Pretendard, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace"
    },
    "slots": {
      "display":    { "fontFamily": "{typography.family.sans}", "fontSize": "28px", "fontWeight": 700, "lineHeight": 1.3,  "letterSpacing": 0, "use": "랜딩 히어로 타이틀, 워크스페이스 대시보드 타이틀" },
      "heading":    { "fontFamily": "{typography.family.sans}", "fontSize": "22px", "fontWeight": 700, "lineHeight": 1.35, "letterSpacing": 0, "use": "섹션 헤더, 모달/다이얼로그 타이틀, PageLayout 타이틀" },
      "heading-sm": { "fontFamily": "{typography.family.sans}", "fontSize": "18px", "fontWeight": 600, "lineHeight": 1.4,  "letterSpacing": 0, "use": "카드 헤딩, LNB 스텝 라벨" },
      "title":      { "fontFamily": "{typography.family.sans}", "fontSize": "16px", "fontWeight": 600, "lineHeight": 1.5,  "letterSpacing": 0, "use": "서브섹션 타이틀, 리스트 헤더" },
      "body-lg":    { "fontFamily": "{typography.family.sans}", "fontSize": "16px", "fontWeight": 400, "lineHeight": 1.6,  "letterSpacing": 0, "use": "설명 텍스트, 안내 문구, PageLayout description" },
      "body":       { "fontFamily": "{typography.family.sans}", "fontSize": "14px", "fontWeight": 400, "lineHeight": 1.6,  "letterSpacing": 0, "use": "기본 본문 — 프로젝트 최소 폰트 크기" },
      "body-sm":    { "fontFamily": "{typography.family.sans}", "fontSize": "14px", "fontWeight": 400, "lineHeight": 1.5,  "letterSpacing": 0, "use": "보조 정보 — 14px 미만 사용 금지" },
      "caption":    { "fontFamily": "{typography.family.sans}", "fontSize": "14px", "fontWeight": 400, "lineHeight": 1.5,  "letterSpacing": 0, "source": "mapped", "from": "body-sm", "use": "정책상 caption류 축소 표기 금지 — body-sm과 동일값 매핑" },
      "button":     { "fontFamily": "{typography.family.sans}", "fontSize": "14px", "fontWeight": 600, "lineHeight": 1.4,  "letterSpacing": 0, "use": "버튼/배지 라벨, LNB 스텝 텍스트" },
      "button-lg":  { "fontFamily": "{typography.family.sans}", "fontSize": "16px", "fontWeight": 600, "lineHeight": 1.4,  "letterSpacing": 0, "use": "xlarge(48px) 버튼 전용" }
    }
  },

  "spacing": {
    "base-unit": "8px",
    "xs": "4px",
    "sm": "8px",
    "md": "12px",
    "base": "16px",
    "lg": "24px",
    "xl": "32px",
    "xxl": "48px",
    "section": { "value": "24px", "source": "mapped", "from": "lg", "use": "그룹 간 분리 간격 — 워크스페이스 앱, 마케팅형 대여백 없음" }
  },

  "rounded": {
    "none": "0px",
    "sm": "4px",
    "md": "8px",
    "lg": "12px",
    "xl": "16px",
    "full": "9999px"
  },

  "shadow": {
    "none": "none",
    "subtle": "0px 1px 3px rgba(15,23,42,0.06)",
    "standard": "0px 2px 8px rgba(15,23,42,0.08)",
    "elevated": "0px 4px 16px rgba(15,23,42,0.12)",
    "modal": "0px 8px 24px rgba(15,23,42,0.16)",
    "drawer": "-4px 0px 16px rgba(15,23,42,0.08)"
  },

  "components": {
    "button-primary": {
      "category": "action", "type": "button",
      "backgroundColor": "{colors.primary}", "textColor": "{colors.on-primary}",
      "typography": "{typography.button}", "rounded": "{rounded.md}",
      "height": "40px", "padding": "0 16px",
      "use": "화면당 1개 주 CTA — 다음 단계, 마스킹 확정, 컨셉 확정. 선택 완료 전에는 locked 배경으로 비활성"
    },
    "button-primary-hover":    { "backgroundColor": "{colors.primary-hover}" },
    "button-primary-disabled": { "backgroundColor": "{colors.locked}" },
    "button-primary-sm":       { "height": "32px", "padding": "0 12px" },
    "button-primary-xl":       { "height": "48px", "typography": "{typography.button-lg}" },

    "button-neutral": {
      "category": "action", "type": "button",
      "backgroundColor": "{colors.neutral}", "textColor": "{colors.on-primary}",
      "typography": "{typography.button}", "rounded": "{rounded.md}",
      "height": "40px", "padding": "0 16px",
      "use": "인디고가 어울리지 않는 강한 보조 액션 — 원문 폐기, 사전에 등록"
    },

    "button-danger": {
      "category": "action", "type": "button",
      "backgroundColor": "{colors.error}", "textColor": "{colors.on-primary}",
      "typography": "{typography.button}", "rounded": "{rounded.md}",
      "height": "40px", "padding": "0 16px",
      "use": "되돌릴 수 없는 파괴적 확인 전용 — 프로젝트 삭제, 원문 폐기. Confirm Dialog 필수. 리스트 제외/닫기 금지"
    },

    "button-weak-primary": {
      "category": "action", "type": "button",
      "backgroundColor": "{colors.primary-weak}", "textColor": "{colors.primary-hover}",
      "typography": "{typography.button}", "rounded": "{rounded.md}",
      "height": "40px", "padding": "0 16px",
      "use": "주 CTA 옆 보조 실행 — 다시 생성, 다운로드, 분석하기. CTA보다 강해 보이면 안 됨"
    },

    "button-weak-neutral": {
      "category": "action", "type": "button",
      "backgroundColor": "{colors.surface-alt}", "textColor": "{colors.text}",
      "typography": "{typography.button}", "rounded": "{rounded.md}",
      "height": "40px", "padding": "0 16px",
      "use": "취소/닫기 등 중립 보조 액션"
    },

    "button-weak-danger": {
      "category": "action", "type": "button",
      "backgroundColor": "{colors.error-weak}", "textColor": "{colors.error-strong}",
      "typography": "{typography.button}", "rounded": "{rounded.md}",
      "height": "40px", "padding": "0 16px",
      "use": "파괴력 낮은 영구 제거 — 사전 단어 삭제. 되돌릴 수 있는 '검수 제외'에는 금지 → button-icon-neutral"
    },

    "button-icon-neutral": {
      "category": "action", "type": "button",
      "backgroundColor": "transparent", "iconColor": "{colors.text-muted}",
      "rounded": "{rounded.md}", "width": "32px", "height": "32px",
      "parts": { "icon": { "size": "18px", "color": "inherit" } },
      "use": "X/제외/닫기의 기본값 — 삭제처럼 보이면 안 되는 제거 액션 전부. 라벨은 '제외/닫기/항목 제거', '삭제' 금지"
    },
    "button-icon-neutral-hover": { "backgroundColor": "{colors.border}", "iconColor": "{colors.text-strong}" },

    "text-link": {
      "category": "action", "type": "text-link",
      "textColor": "{colors.primary}", "typography": "{typography.body}",
      "use": "저강조 인라인 액션 — 출처 링크, 상세 보기"
    },

    "input-default": {
      "category": "form", "type": "input",
      "backgroundColor": "{colors.canvas}", "textColor": "{colors.text-strong}",
      "border": "1px solid {colors.border}", "rounded": "{rounded.md}",
      "padding": "10px 12px", "typography": "{typography.body}",
      "parts": {
        "placeholder":  { "textColor": "{colors.text-placeholder}" },
        "helper-text":  { "typography": "{typography.body-sm}", "textColor": "{colors.text-muted}" }
      },
      "use": "표준 폼 입력 — 사전 단어 추가, 마스킹 예외 입력"
    },
    "input-default-focus": { "border": "1px solid {colors.primary}" },
    "input-default-error": { "border": "1px solid {colors.error}", "parts": { "helper-text": { "textColor": "{colors.error}" } } },

    "input-line": {
      "category": "form", "type": "input",
      "backgroundColor": "transparent", "borderBottom": "1px solid {colors.border}",
      "rounded": "{rounded.none}", "padding": "0 0 4px", "typography": "{typography.body}",
      "use": "인라인 편집형 입력 — 검수 화면 내 즉시 수정"
    },

    "input-search": {
      "category": "form", "type": "search",
      "backgroundColor": "{colors.surface-alt}", "textColor": "{colors.text-strong}",
      "rounded": "{rounded.md}", "padding": "8px 12px 8px 36px", "typography": "{typography.body}",
      "parts": { "icon": { "size": "16px", "color": "{colors.text-muted}", "position": "left 12px" } },
      "use": "레퍼런스/사전 검색"
    },

    "select-default": {
      "category": "form", "type": "select",
      "backgroundColor": "{colors.canvas}", "border": "1px solid {colors.border}",
      "rounded": "{rounded.md}", "padding": "8px 36px 8px 12px", "typography": "{typography.body}",
      "parts": { "chevron": { "size": "16px", "color": "{colors.text-muted}", "position": "right 12px" } },
      "use": "전역 셀렉트 — 엔티티 등급, 스코프 선택. input-default와 같은 컨트롤 패밀리 톤 공유"
    },
    "select-default-hover": { "border": "1px solid {colors.border-strong}" },
    "select-default-focus": { "border": "1px solid {colors.primary}" },

    "toggle-default": {
      "category": "form", "type": "toggle",
      "parts": {
        "track-on":  { "backgroundColor": "{colors.primary}", "rounded": "{rounded.full}" },
        "track-off": { "backgroundColor": "{colors.border-strong}", "rounded": "{rounded.full}" },
        "thumb":     { "backgroundColor": "{colors.canvas}", "size": "18px", "shadow": "{shadow.subtle}" }
      },
      "use": "불리언 설정 — 실명 미리보기, 검수 항목 켜기/끄기"
    },

    "card-default": {
      "category": "data-display", "type": "card",
      "backgroundColor": "{colors.canvas}", "rounded": "{rounded.lg}",
      "padding": "20px", "shadow": "{shadow.standard}",
      "use": "기본 서피스 — 레퍼런스 카드, 무드보드 카드, 섹션 카드"
    },

    "card-featured": {
      "category": "data-display", "type": "card",
      "backgroundColor": "{colors.canvas}", "rounded": "{rounded.xl}",
      "padding": "24px", "shadow": "{shadow.standard}",
      "use": "컨셉 3안 비교 카드"
    },
    "card-featured-selected": { "border": "2px solid {colors.primary}" },

    "card-compact": {
      "category": "data-display", "type": "card",
      "backgroundColor": "{colors.canvas}", "border": "1px solid {colors.border}",
      "rounded": "{rounded.md}", "padding": "12px", "shadow": "{shadow.none}",
      "use": "인라인 리스트 아이템 — 검수 리스트, 사전 단어 리스트"
    },

    "badge-candidate": {
      "category": "data-display", "type": "badge",
      "backgroundColor": "{colors.warning-weak}", "textColor": "{colors.warning-strong}",
      "rounded": "{rounded.full}", "typography": "{typography.button}",
      "height": "24px", "padding": "4px 10px",
      "use": "미확정 후보 — candidate Section, rule 탐지 항목"
    },
    "badge-candidate-sm": { "height": "20px", "padding": "3px 8px" },

    "badge-confirmed": {
      "category": "data-display", "type": "badge",
      "backgroundColor": "{colors.success}", "textColor": "{colors.on-primary}",
      "rounded": "{rounded.full}", "typography": "{typography.button}",
      "height": "24px", "padding": "4px 10px",
      "use": "확정 완료 — confirmed Section, 마스킹/컨셉 확정"
    },

    "badge-locked": {
      "category": "data-display", "type": "badge",
      "backgroundColor": "{colors.surface-alt}", "textColor": "{colors.text-muted}",
      "rounded": "{rounded.full}", "typography": "{typography.button}",
      "height": "24px", "padding": "4px 10px",
      "use": "잠김 상태"
    },

    "alert-guide": {
      "category": "feedback", "type": "alert",
      "backgroundColor": "{colors.primary-light}", "textColor": "{colors.primary}",
      "rounded": "{rounded.md}", "padding": "12px 16px", "typography": "{typography.body}",
      "use": "화면 사용법·다음 행동 안내 배너의 기본값"
    },

    "alert-info-card": {
      "category": "feedback", "type": "alert",
      "backgroundColor": "{colors.surface-alt}", "border": "1px solid {colors.border}",
      "rounded": "{rounded.md}", "padding": "12px 16px",
      "parts": { "heading": { "textColor": "{colors.foreground}", "typography": "{typography.title}" } },
      "use": "AI가 찾아낸 사실/발견 사항 — 채도 낮춘 보조 정보 카드. 사용법 안내가 아닌 정보 전달"
    },

    "toast-default": {
      "category": "feedback", "type": "alert",
      "backgroundColor": "{colors.surface-inverse}", "textColor": "{colors.on-primary}",
      "rounded": "{rounded.md}", "padding": "12px 16px",
      "shadow": "{shadow.elevated}", "typography": "{typography.button}",
      "use": "자동 소멸 알림 — 저장/확정 완료. 되돌릴 수 없는 액션은 토스트가 아니라 전용 Dialog로"
    },

    "nav-lnb": {
      "category": "navigation", "type": "nav",
      "width": "240px", "typography": "{typography.button}",
      "parts": {
        "step-active": { "backgroundColor": "{colors.primary-light}", "textColor": "{colors.primary-hover}", "rounded": "{rounded.md}" },
        "step-done":   { "textColor": "{colors.foreground}", "iconColor": "{colors.success}" },
        "step-locked": { "textColor": "{colors.locked}" }
      },
      "use": "6단계 스테퍼(업로드~디자인MD) — 좌측 고정, 보안 게이트의 시각적 강제. 잠긴 단계는 클릭 차단 + 툴팁"
    },

    "tab-segmented": {
      "category": "navigation", "type": "tab",
      "backgroundColor": "{colors.surface-alt}", "textColor": "{colors.text-muted}",
      "rounded": "{rounded.md}", "padding": "6px 12px", "typography": "{typography.button}",
      "use": "뷰 전환 — 레퍼런스/무드/스킨 프리뷰"
    },
    "tab-segmented-selected": { "backgroundColor": "{colors.canvas}", "textColor": "{colors.foreground}", "shadow": "{shadow.subtle}" },

    "dialog-modal": {
      "category": "overlay", "type": "modal",
      "backgroundColor": "{colors.canvas}", "textColor": "{colors.foreground}",
      "rounded": "{rounded.lg}", "padding": "24px", "shadow": "{shadow.modal}",
      "parts": { "scrim": { "backgroundColor": "{colors.scrim}" } },
      "use": "확정/파괴적 액션 컨펌 — 중앙 모달"
    },

    "drawer-side": {
      "category": "overlay", "type": "drawer",
      "backgroundColor": "{colors.canvas}", "textColor": "{colors.foreground}",
      "rounded": "{rounded.lg}", "padding": "24px 20px", "shadow": "{shadow.drawer}",
      "parts": { "scrim": { "backgroundColor": "{colors.scrim}" } },
      "use": "우측 슬라이드 보조 패널 — 사전 관리, 상세 레퍼런스 출처. 라운드는 좌측 모서리만"
    },

    "page-layout": {
      "category": "layout", "type": "header",
      "parts": {
        "title":       { "typography": "{typography.heading}", "textColor": "{colors.foreground}" },
        "description": { "typography": "{typography.body-lg}", "textColor": "{colors.text-muted}" },
        "card-stack":  { "backgroundColor": "{colors.surface}", "border": "1px solid {colors.border}", "rounded": "{rounded.lg}", "padding": "24px" }
      },
      "use": "모든 단계 화면의 공통 셸 — banner(선택)→title+description→카드 스택→CTA(좌측 정렬) 고정 순서. 타이틀 존은 박스로 감싸지 않음. 신규 화면은 이 구조 재사용"
    }
  },

  "motion": {
    "durations": {
      "instant": "0ms",
      "fast": "150ms",
      "standard": "250ms",
      "slow": "400ms",
      "step": "300ms"
    },
    "easings": {
      "enter":    "cubic-bezier(0.0, 0.0, 0.2, 1)",
      "exit":     "cubic-bezier(0.4, 0.0, 1, 1)",
      "standard": "cubic-bezier(0.4, 0.0, 0.2, 1)",
      "spring":   "cubic-bezier(0.34, 1.56, 0.64, 1)"
    }
  },

  "layout": {
    "baseline": "1440px",
    "container-max": "1600px",
    "content-padding": "40px",
    "lnb-width": "240px",
    "breakpoints": { "desktop": "1024px", "phone-adjust": "768px" }
  },

  "rules": {
    "normalize": {
      "color":     { "strategy": "nearest-semantic", "threshold": null },
      "font-size": { "strategy": "snap-to-slot", "threshold": null },
      "spacing":   { "strategy": "snap-to-base-unit", "threshold": null },
      "radius":    { "strategy": "snap-to-scale", "threshold": null },
      "on-fail":   "report",
      "exceptions": ["마스킹 토큰 하이라이트 배지 색", "무드보드/레퍼런스 썸네일 이미지 원본 색", "Unsplash/Pexels 이미지 콘텐츠"]
    },
    "constraints": [
      { "id": "single-interaction-color", "severity": "must",   "scope": "action",     "rule": "모든 인터랙티브 요소는 {colors.primary} 계열만 사용. 클릭 불가능한 요소에 primary를 입히지 않는다 (장식 금지)" },
      { "id": "min-body-size",            "severity": "must",   "scope": "typography", "rule": "화면 표시 텍스트 최소 14px. caption류 축소 표기 금지" },
      { "id": "hover-colors-only",        "severity": "must",   "scope": "*",          "rule": "hover는 색상 전환만(transition-colors, {motion.durations.fast}). transform·그림자 변화 금지" },
      { "id": "danger-scope",             "severity": "must",   "scope": "action",     "rule": "danger 색은 오류·실제 파괴적 액션 전용 + Confirm Dialog 필수. 되돌릴 수 있는 제외/닫기에는 button-icon-neutral 사용" },
      { "id": "primary-cta-single",       "severity": "must",   "scope": "action",     "rule": "한 화면 하단 Primary CTA는 정확히 1개. 확정과 다음을 동시에 Primary로 두지 않는다" },
      { "id": "status-color-separation",  "severity": "must",   "scope": "colors",     "rule": "후보(warning)/확정(success)/잠김(locked) 상태색을 혼동 불가능하게 항상 분리 표시" },
      { "id": "contrast-minimum",         "severity": "must",   "scope": "colors",     "rule": "모든 배경↔텍스트 쌍은 WCAG AA(4.5:1) 이상. 미달 시 report" },
      { "id": "security-gate-ui",         "severity": "must",   "scope": "navigation", "rule": "마스킹 미확정 상태에서 이후 LNB 단계 잠금을 해제하지 않는다 (보안 하드 게이트의 UI 반영)" },
      { "id": "banner-color-order",       "severity": "should", "scope": "feedback",   "rule": "배너 색 선택 순서: 사용법 안내→alert-guide, AI 발견 사실→alert-info-card, info(sky)는 작은 배지 수준만" },
      { "id": "shadow-restraint",         "severity": "should", "scope": "*",          "rule": "그림자로 깊이를 표현하지 않고 배경색 레이어링을 우선. 컬러 틴트 그림자 금지" },
      { "id": "weight-discipline",        "severity": "should", "scope": "typography", "rule": "웨이트는 400/600/700만 사용. 본문에 700 금지 — 헤딩·강조 전용" }
    ]
  },

  "known-gaps": [
    { "category": "colors",     "type": "primary-active",  "reason": "hover만 실재, active 미정의 (권장 토큰 미충족)" },
    { "category": "colors",     "type": "link",            "reason": "primary와 동일값 mapped 처리 — 전용 링크 색 없음" },
    { "category": "colors",     "type": "scrim",           "reason": "스키마 §2.8 독립 역할 어휘표 밖 토큰 — 어휘표에 scrim 추가 검토 필요" },
    { "category": "typography", "type": "caption",         "reason": "축소 표기 금지 정책으로 body-sm 값 mapped 처리" },
    { "category": "spacing",    "type": "section",         "reason": "마케팅형 대여백 미실재 — 그룹 분리 간격 24px mapped 처리" },
    { "category": "form",       "type": "checkbox",        "reason": "미등장 — 토글로 대체 사용 중" },
    { "category": "form",       "type": "radio",           "reason": "미등장" },
    { "category": "form",       "type": "textarea",        "reason": "미정의 — input-default 준용 추정이나 명시 없음" },
    { "category": "form",       "type": "date-picker",     "reason": "미등장" },
    { "category": "form",       "type": "time-picker",     "reason": "미등장" },
    { "category": "form",       "type": "file-upload",     "reason": "업로드 드롭존이 핵심 기능으로 실재하나 스타일 토큰 미정의" },
    { "category": "data-display", "type": "table",         "reason": "미등장" },
    { "category": "data-display", "type": "accordion",     "reason": "섹션 펼침 동작 실재하나 스타일 미정의" },
    { "category": "data-display", "type": "carousel",      "reason": "미등장" },
    { "category": "data-display", "type": "text-list",     "reason": "card-compact가 리스트 항목 역할 수행 — 별도 정의 불필요 판단" },
    { "category": "data-display", "type": "tag",           "reason": "badge가 겸용 — 별도 정의 불필요 판단" },
    { "category": "feedback",   "type": "tooltip",         "reason": "잠긴 단계 안내 툴팁 실재하나 스타일 미정의" },
    { "category": "feedback",   "type": "critical-alert",  "reason": "미등장" },
    { "category": "feedback",   "type": "progress-bar",    "reason": "분석 중 상단 진행 바(primary) 실재하나 높이·트랙 색 미정의" },
    { "category": "feedback",   "type": "step-indicator",  "reason": "nav-lnb가 담당 — 별도 정의 불필요 판단" },
    { "category": "feedback",   "type": "spinner",         "reason": "스켈레톤 블록 사용 — 스피너 미정의" },
    { "category": "navigation", "type": "breadcrumb",      "reason": "미등장" },
    { "category": "navigation", "type": "pagination",      "reason": "미등장" },
    { "category": "navigation", "type": "skip-link",       "reason": "미등장 — 접근성 보완 시 필요" },
    { "category": "overlay",    "type": "popover",         "reason": "elevation 레벨만 지정, 컴포넌트 스타일 미정의" },
    { "category": "layout",     "type": "footer",          "reason": "미등장" },
    { "category": "layout",     "type": "divider",         "reason": "border 토큰이 겸용 — 별도 정의 불필요 판단" }
  ]
}
```
