---
name: "[회사A] 사내 포털 리뉴얼 — B안 — 다크 대시보드"
schema-version: "1.1.1"
instance-version: "0.1"
mode: dark
source: concept
extracted: "2026-07-10"
status: draft
---

# [회사A] 사내 포털 리뉴얼 — B안 — 다크 대시보드

## 1. Overview

"B안 — 다크 대시보드" 컨셉의 디자인 방향을 요약한다. 무드: 몰입감 있는, 집약적인, 선명한. 톤: 짙은 남색 배경에 하이라이트 블루. 정보구조: 다크 모드, 좌측 LNB — 좌측 LNB 고정 + 우측 위젯 스택.

이 문서는 `source: concept` 인스턴스다 — 실측 화면 이전 단계의 컨셉 제안이라 상세도가 실측 인스턴스보다 낮다(스키마 §1 완화 규칙). 필수 컴포넌트·상태 변형 순회 의무가 면제되며, 채워진 토큰 대부분은 `proposed`/`derived`/`fallback`이다 — 전량 `known-gaps`에 기록했다.

## 2. Colors

브랜드 인터랙션은 `{colors.primary}` 하나로 묶고, 배경은 `{colors.canvas}`(카드 표면은 `{colors.surface}`)를 쌍으로 쓴다. 텍스트는 `{colors.text}`(보조는 `{colors.text-muted}`)이며 `{colors.primary}` 위에는 항상 `{colors.on-primary}`를 쌍으로 사용한다. 포인트 컬러는 `{colors.accent}`, GNB/LNB 배경은 `{colors.surface-alt}`. 이 팔레트는 컨셉 단계 제안값(`proposed`)이며, `{colors.on-primary}`는 primary와의 대비를 검증(AA 4.5:1)한 뒤 파생(`derived`)했고 `{colors.border}`도 팔레트에 없던 슬롯이라 파생했다 — 실제 화면 적용 전 검수가 필요하다. `error`/`success`/`warning`/`link` 등 권장 토큰은 컨셉 팔레트에 없어 지어내지 않았다(Known Gaps 참조).

## 3. Typography

컨셉 방향: 숫자·지표 강조용 모노스페이스 보조 서체, 본문은 산세리프. 필수 슬롯 7종(`display`~`button`)을 정의했으나, 실제 폰트·크기·행간이 아직 확정되지 않아 계약 기본값(`fallback`, Pretendard 스택 + 표준 스케일)으로 채웠다. 모든 슬롯(`caption` 포함)이 min-body-size 제약(최소 14px)을 만족하도록 스케일을 잡았다. 실제 폰트가 결정되면 `family`와 각 슬롯 값을 갱신하고 `instance-version`을 올린다.

## 4. Layout

`{spacing.base-unit}`(8px) 그리드를 기본값으로 사용한다. 컨셉 단계라 실제 화면의 spacing 실측이 없어 표준 스케일(`fallback`)을 임시로 채웠다 — 실제 레이아웃 확정 시 재검증이 필요하다(Known Gaps 참조).

## 5. Shape & Elevation

라운드는 표준 5단계(`{rounded.none}`~`{rounded.full}`) 기본값을 사용한다. 그림자는 `{shadow.none}`만 확정했고, 실제 elevation 레벨(subtle/standard/elevated/modal)은 실재 여부를 확인할 방법이 없어 비워뒀다 — 지어내지 않았다.

## 6. Components

필수 컴포넌트 4종 중 `button-primary`·`card-default`는 컨셉 수준(배경·문자·타이포·라운드만)으로 제안했다 — 상태 변형(hover/active/disabled)은 미정이다. `button-secondary`·`input-default`는 컨셉 단계에서 다뤄지지 않아 아직 정의하지 않았다. `source: concept` 인스턴스는 이 미충족을 허용하며(§1 완화 규칙), 대신 사유를 Known Gaps에 남긴다.

## 7. Rules

(후미 JSON `rules.constraints`에서 파생 렌더링 — 값의 원천은 JSON. Do/Don't 분류도 constraints.rule 문자열에서 기계적으로 파생하며 별도로 작성하지 않는다)

**Do:**
- 모든 배경↔텍스트 쌍은 WCAG AA(4.5:1) 이상. 미달 시 report
- 화면 표시 텍스트 최소 14px
- 전체 톤은 "몰입감 있는·집약적인·선명한" 분위기에서 벗어나지 않는다

**Don't:**
- 모든 인터랙티브 요소는 {colors.primary} 계열만 사용한다. 제2 액센트 도입 금지
- 이 인스턴스의 proposed/derived/fallback 토큰을 실측 검수 없이 apply의 fix 모드에 사용하는 것을 금지한다 (source: concept는 check 모드만 허용)
- 컨셉 팔레트에 없는 권장 컬러(error/success/warning/link 등)를 임의로 지어내는 것을 금지한다

## 8. Known Gaps

없음이 아니다 — 이 인스턴스는 `source: concept`(실측 이전 단계)라 대부분의 토큰이 `proposed`/`derived`/`fallback`이며, 총 32건이 Known Gaps로 남아 있다(상세는 후미 JSON `known-gaps` 참조). 카테고리별: colors 16건 / typography 9건 / spacing 1건 / rounded 1건 / shadow 1건 / action 2건 / form 1건 / data-display 1건.

---

```json
{
  "meta": {
    "name": "[회사A] 사내 포털 리뉴얼 — B안 — 다크 대시보드",
    "schema-version": "1.1.1",
    "instance-version": "0.1",
    "mode": "dark",
    "source": "concept",
    "extracted": "2026-07-10",
    "status": "draft"
  },
  "colors": {
    "semantic": {
      "primary": {
        "value": "#3B82F6",
        "source": "proposed",
        "use": "브랜드 인터랙션 컬러 — CTA·핵심 액션"
      },
      "on-primary": {
        "value": "#0F172A",
        "source": "derived",
        "use": "primary 등 채움 배경 위 텍스트/아이콘 — primary 대비 검증(AA 4.5:1) 후 파생, 팔레트에 없던 슬롯"
      },
      "canvas": {
        "value": "#0F1115",
        "source": "proposed",
        "use": "페이지 최하단 배경"
      },
      "surface": {
        "value": "#171A21",
        "source": "proposed",
        "use": "카드 등 canvas 위 한 단계 표면"
      },
      "text": {
        "value": "#E8EAED",
        "source": "proposed",
        "use": "기본 텍스트"
      },
      "text-muted": {
        "value": "#94A3B8",
        "source": "mapped",
        "from": "secondary",
        "use": "보조 텍스트 — 전용 색이 없어 secondary 매핑"
      },
      "border": {
        "value": "rgba(232, 234, 237, 0.16)",
        "source": "derived",
        "use": "기본 테두리·구분선 (text 기준 반투명 파생, 팔레트에 없던 슬롯)"
      },
      "secondary": {
        "value": "#94A3B8",
        "source": "proposed",
        "use": "보조 브랜드컬러 — 카드 부제·아이콘 등"
      },
      "accent": {
        "value": "#38BDF8",
        "source": "proposed",
        "use": "포인트·CTA 강조 컬러"
      },
      "surface-alt": {
        "value": "#12151B",
        "source": "proposed",
        "use": "GNB/LNB 배경 — canvas와 분리된 표면"
      }
    },
    "primitive": {}
  },
  "typography": {
    "family": {
      "sans": {
        "value": "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        "source": "fallback",
        "use": "본문·헤딩 공통 — 실제 폰트 미확정"
      },
      "mono": {
        "value": "JetBrains Mono, D2Coding, monospace",
        "source": "fallback",
        "use": "수치·코드성 표기 — 실제 폰트 미확정"
      }
    },
    "slots": {
      "display": {
        "fontFamily": "{typography.family.sans}",
        "fontSize": "44px",
        "fontWeight": 700,
        "lineHeight": 1.2,
        "letterSpacing": -0.02,
        "use": "최대 제목 — 히어로",
        "source": "fallback"
      },
      "heading": {
        "fontFamily": "{typography.family.sans}",
        "fontSize": "30px",
        "fontWeight": 700,
        "lineHeight": 1.3,
        "letterSpacing": -0.01,
        "use": "섹션 제목",
        "source": "fallback"
      },
      "title": {
        "fontFamily": "{typography.family.sans}",
        "fontSize": "20px",
        "fontWeight": 600,
        "lineHeight": 1.4,
        "letterSpacing": 0,
        "use": "카드/항목 제목",
        "source": "fallback"
      },
      "body": {
        "fontFamily": "{typography.family.sans}",
        "fontSize": "16px",
        "fontWeight": 400,
        "lineHeight": 1.6,
        "letterSpacing": 0,
        "use": "기본 본문",
        "source": "fallback"
      },
      "body-sm": {
        "fontFamily": "{typography.family.sans}",
        "fontSize": "14px",
        "fontWeight": 400,
        "lineHeight": 1.5,
        "letterSpacing": 0,
        "use": "보조 본문",
        "source": "fallback"
      },
      "caption": {
        "fontFamily": "{typography.family.sans}",
        "fontSize": "14px",
        "fontWeight": 500,
        "lineHeight": 1.4,
        "letterSpacing": 0.02,
        "use": "메타 정보·라벨 — schema §13.3 하한(14px), min-body-size 준수",
        "source": "fallback"
      },
      "button": {
        "fontFamily": "{typography.family.sans}",
        "fontSize": "15px",
        "fontWeight": 600,
        "lineHeight": 1.2,
        "letterSpacing": 0,
        "use": "버튼 전용",
        "source": "fallback"
      }
    }
  },
  "spacing": {
    "base-unit": {
      "value": "8px",
      "source": "fallback",
      "use": "그리드 기준"
    },
    "xs": {
      "value": "4px",
      "source": "fallback",
      "use": "concept 단계 — 실측 spacing 없음, schema §13.2 기본 스케일"
    },
    "sm": {
      "value": "8px",
      "source": "fallback",
      "use": "concept 단계 — 실측 spacing 없음, schema §13.2 기본 스케일"
    },
    "md": {
      "value": "16px",
      "source": "fallback",
      "use": "concept 단계 — 실측 spacing 없음, schema §13.2 기본 스케일"
    },
    "lg": {
      "value": "24px",
      "source": "fallback",
      "use": "concept 단계 — 실측 spacing 없음, schema §13.2 기본 스케일"
    },
    "xl": {
      "value": "32px",
      "source": "fallback",
      "use": "concept 단계 — 실측 spacing 없음, schema §13.2 기본 스케일"
    },
    "section": {
      "value": "40px",
      "source": "fallback",
      "use": "섹션 수직 여백 — domain(generic) 기준 schema §13.2 표"
    }
  },
  "rounded": {
    "none": {
      "value": "0px",
      "source": "fallback",
      "use": "라운딩 안 함(의도적 선언)"
    },
    "xs": {
      "value": "2px",
      "source": "fallback",
      "use": "concept 단계 — 실측 radius 없음, schema §13.1 기본 스케일"
    },
    "sm": {
      "value": "4px",
      "source": "fallback",
      "use": "concept 단계 — 실측 radius 없음, schema §13.1 기본 스케일"
    },
    "md": {
      "value": "8px",
      "source": "fallback",
      "use": "concept 단계 — 실측 radius 없음, schema §13.1 기본 스케일"
    },
    "lg": {
      "value": "12px",
      "source": "fallback",
      "use": "concept 단계 — 실측 radius 없음, schema §13.1 기본 스케일"
    },
    "xl": {
      "value": "16px",
      "source": "fallback",
      "use": "concept 단계 — 실측 radius 없음, schema §13.1 기본 스케일"
    },
    "full": {
      "value": "9999px",
      "source": "fallback",
      "use": "pill/원형 — concept 단계 — 실측 radius 없음, schema §13.1 기본 스케일"
    }
  },
  "shadow": {
    "none": {
      "value": "none",
      "source": "fallback",
      "use": "그림자 없음(의도적 선언)"
    }
  },
  "components": {
    "button-primary": {
      "category": "action",
      "type": "button",
      "backgroundColor": "{colors.primary}",
      "textColor": "{colors.on-primary}",
      "typography": "{typography.button}",
      "rounded": "{rounded.md}",
      "use": "핵심 액션 버튼 — concept 레벨(배경·문자·타이포·라운드만), 상태 변형(hover/active/disabled) 미정",
      "source": "proposed"
    },
    "card-default": {
      "category": "data-display",
      "type": "card",
      "backgroundColor": "{colors.surface}",
      "rounded": "{rounded.md}",
      "border": "1px solid {colors.border}",
      "use": "정보 카드 — concept 레벨, 패딩·그림자 등 세부 미정",
      "source": "proposed"
    }
  },
  "rules": {
    "normalize": {
      "color": {
        "strategy": "nearest-semantic",
        "threshold": null
      },
      "font-size": {
        "strategy": "snap-to-slot",
        "threshold": null
      },
      "spacing": {
        "strategy": "snap-to-base-unit",
        "threshold": null
      },
      "radius": {
        "strategy": "snap-to-scale",
        "threshold": null
      },
      "on-fail": "report",
      "exceptions": []
    },
    "constraints": [
      {
        "id": "single-interaction-color",
        "severity": "must",
        "scope": "action",
        "rule": "모든 인터랙티브 요소는 {colors.primary} 계열만 사용한다. 제2 액센트 도입 금지"
      },
      {
        "id": "contrast-minimum",
        "severity": "must",
        "scope": "colors",
        "rule": "모든 배경↔텍스트 쌍은 WCAG AA(4.5:1) 이상. 미달 시 report"
      },
      {
        "id": "min-body-size",
        "severity": "must",
        "scope": "typography",
        "rule": "화면 표시 텍스트 최소 14px"
      },
      {
        "id": "mood-consistency",
        "severity": "should",
        "scope": "*",
        "rule": "전체 톤은 \"몰입감 있는·집약적인·선명한\" 분위기에서 벗어나지 않는다"
      },
      {
        "id": "no-unverified-fix-apply",
        "severity": "must",
        "scope": "*",
        "rule": "이 인스턴스의 proposed/derived/fallback 토큰을 실측 검수 없이 apply의 fix 모드에 사용하는 것을 금지한다 (source: concept는 check 모드만 허용)"
      },
      {
        "id": "no-fabricated-recommended-colors",
        "severity": "must",
        "scope": "colors",
        "rule": "컨셉 팔레트에 없는 권장 컬러(error/success/warning/link 등)를 임의로 지어내는 것을 금지한다"
      }
    ]
  },
  "known-gaps": [
    {
      "category": "colors",
      "type": "primary",
      "reason": "concept 팔레트/스케일 제안값(proposed) — 실측 확인 전 검수 필요 — 브랜드 인터랙션 컬러 — CTA·핵심 액션"
    },
    {
      "category": "colors",
      "type": "on-primary",
      "reason": "실측/제안값에 없는 슬롯 — 계산으로 파생(derived) — primary 등 채움 배경 위 텍스트/아이콘 — primary 대비 검증(AA 4.5:1) 후 파생, 팔레트에 없던 슬롯 — primary 대비 4.85:1 (AA 4.5:1 충족)"
    },
    {
      "category": "colors",
      "type": "canvas",
      "reason": "concept 팔레트/스케일 제안값(proposed) — 실측 확인 전 검수 필요 — 페이지 최하단 배경"
    },
    {
      "category": "colors",
      "type": "surface",
      "reason": "concept 팔레트/스케일 제안값(proposed) — 실측 확인 전 검수 필요 — 카드 등 canvas 위 한 단계 표면"
    },
    {
      "category": "colors",
      "type": "text",
      "reason": "concept 팔레트/스케일 제안값(proposed) — 실측 확인 전 검수 필요 — 기본 텍스트"
    },
    {
      "category": "colors",
      "type": "text-muted",
      "reason": "전용 값 없음 — secondary 값 매핑(mapped) — 보조 텍스트 — 전용 색이 없어 secondary 매핑"
    },
    {
      "category": "colors",
      "type": "border",
      "reason": "실측/제안값에 없는 슬롯 — 계산으로 파생(derived) — 기본 테두리·구분선 (text 기준 반투명 파생, 팔레트에 없던 슬롯)"
    },
    {
      "category": "colors",
      "type": "secondary",
      "reason": "concept 팔레트/스케일 제안값(proposed) — 실측 확인 전 검수 필요 — 보조 브랜드컬러 — 카드 부제·아이콘 등"
    },
    {
      "category": "colors",
      "type": "accent",
      "reason": "concept 팔레트/스케일 제안값(proposed) — 실측 확인 전 검수 필요 — 포인트·CTA 강조 컬러"
    },
    {
      "category": "colors",
      "type": "surface-alt",
      "reason": "concept 팔레트/스케일 제안값(proposed) — 실측 확인 전 검수 필요 — GNB/LNB 배경 — canvas와 분리된 표면"
    },
    {
      "category": "colors",
      "type": "error",
      "reason": "concept 팔레트에 미정의(권장 토큰) — 지어내지 않음"
    },
    {
      "category": "colors",
      "type": "success",
      "reason": "concept 팔레트에 미정의(권장 토큰) — 지어내지 않음"
    },
    {
      "category": "colors",
      "type": "warning",
      "reason": "concept 팔레트에 미정의(권장 토큰) — 지어내지 않음"
    },
    {
      "category": "colors",
      "type": "link",
      "reason": "concept 팔레트에 미정의(권장 토큰) — 지어내지 않음"
    },
    {
      "category": "colors",
      "type": "primary-hover",
      "reason": "concept 팔레트에 미정의(권장 토큰) — 지어내지 않음"
    },
    {
      "category": "colors",
      "type": "primary-active",
      "reason": "concept 팔레트에 미정의(권장 토큰) — 지어내지 않음"
    },
    {
      "category": "typography",
      "type": "family.sans",
      "reason": "실측 없음 — 계약 기본값(fallback) 사용 — 본문·헤딩 공통 — 실제 폰트 미확정"
    },
    {
      "category": "typography",
      "type": "family.mono",
      "reason": "실측 없음 — 계약 기본값(fallback) 사용 — 수치·코드성 표기 — 실제 폰트 미확정"
    },
    {
      "category": "typography",
      "type": "display",
      "reason": "schema §13 concept 기본 스케일 적용"
    },
    {
      "category": "typography",
      "type": "heading",
      "reason": "schema §13 concept 기본 스케일 적용"
    },
    {
      "category": "typography",
      "type": "title",
      "reason": "schema §13 concept 기본 스케일 적용"
    },
    {
      "category": "typography",
      "type": "body",
      "reason": "schema §13 concept 기본 스케일 적용"
    },
    {
      "category": "typography",
      "type": "body-sm",
      "reason": "schema §13 concept 기본 스케일 적용"
    },
    {
      "category": "typography",
      "type": "caption",
      "reason": "schema §13 concept 기본 스케일 적용"
    },
    {
      "category": "typography",
      "type": "button",
      "reason": "schema §13 concept 기본 스케일 적용"
    },
    {
      "category": "spacing",
      "type": "scale (base-unit/xs/sm/md/lg/xl/section)",
      "reason": "schema §13 concept 기본 스케일 적용"
    },
    {
      "category": "rounded",
      "type": "scale (none/xs/sm/md/lg/xl/full)",
      "reason": "schema §13 concept 기본 스케일 적용"
    },
    {
      "category": "shadow",
      "type": "subtle/standard/elevated/modal",
      "reason": "실재 그림자 레벨 미확인 — none 외 레벨은 지어내지 않음"
    },
    {
      "category": "action",
      "type": "button-primary",
      "reason": "concept 팔레트/스케일 제안값(proposed) — 실측 확인 전 검수 필요 — 핵심 액션 버튼 — concept 레벨(배경·문자·타이포·라운드만), 상태 변형(hover/active/disabled) 미정"
    },
    {
      "category": "action",
      "type": "button-secondary",
      "reason": "concept 단계, 컴포넌트 상세 미정의 (source: concept 완화 규칙 적용)"
    },
    {
      "category": "form",
      "type": "input-default",
      "reason": "concept 단계, 컴포넌트 상세 미정의 (source: concept 완화 규칙 적용)"
    },
    {
      "category": "data-display",
      "type": "card-default",
      "reason": "concept 팔레트/스케일 제안값(proposed) — 실측 확인 전 검수 필요 — 정보 카드 — concept 레벨, 패딩·그림자 등 세부 미정"
    }
  ]
}
```
