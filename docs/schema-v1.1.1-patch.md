# design-system-schema.md v1.1.1 패치 — 추가/수정분만

> 기존 §12 뒤, 부록 A 앞에 아래 §13을 신규 삽입한다.
> schema-version은 "1.1" → "1.1.1"로 변경 (마이너 패치, breaking change 아님 — 값 추가만).

---

## 13. source: concept 기본 스케일 (계약 기본값)

`source: concept` 인스턴스는 실측 화면이 없으므로, spacing·rounded·typography 필수 슬롯을
채울 실재값이 없다. 이 절은 그 경우에 사용하는 **계약 상의 기본값**을 정의한다 — §3.4의
폰트 fallback과 동일한 지위를 spacing·rounded·typography 크기 슬롯에도 부여한다.

**적용 조건:** `meta.source == "concept"` 이고 해당 슬롯에 `designBasis` 등 실재 근거가 없을 때만
아래 값을 `source: "fallback"`으로 채운다. 실측 인스턴스(`v0-screen` / `figma` / `internal-md`)에는
적용하지 않는다 — 그쪽은 원칙 6(실재 우선)이 그대로 적용된다.

### 13.1 rounded 기본 스케일

```yaml
rounded:
  none: 0px
  xs:   2px
  sm:   4px
  md:   8px
  lg:   12px
  xl:   16px
  full: 9999px
```

### 13.2 spacing 기본 스케일

```yaml
spacing:
  base-unit: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  section: <domain별, 아래 표>
```

**`section`은 domain에 따라 값이 갈린다** (수직 여백 성격상 프로젝트 타입 의존도가 높음):

| domain | section |
|---|---|
| `marketing-web` | 80px |
| `dashboard-ops` | 40px |
| `mobile-app` | 24px |
| `document` | 80px |
| `generic` | 40px |

렌더러는 `ProjectAnalysis.domain`(data-model.md §4 `DomainHint`)을 참조해 위 표에서 값을 선택한다.
domain 정보가 없는 경우(순수 mock 등) `generic` 값(40px)을 기본으로 한다.

### 13.3 typography 크기 기본 스케일

폰트 family는 기존 §3.4 fallback을 그대로 따르고, 크기·굵기·행간은 아래를 기본값으로 한다:

```yaml
typography:
  display:  { fontSize: 44px, fontWeight: 700, lineHeight: 1.2,  letterSpacing: -0.02 }
  heading:  { fontSize: 30px, fontWeight: 700, lineHeight: 1.3,  letterSpacing: -0.01 }
  title:    { fontSize: 20px, fontWeight: 600, lineHeight: 1.4,  letterSpacing: 0 }
  body:     { fontSize: 16px, fontWeight: 400, lineHeight: 1.6,  letterSpacing: 0 }
  body-sm:  { fontSize: 14px, fontWeight: 400, lineHeight: 1.5,  letterSpacing: 0 }
  caption:  { fontSize: 14px, fontWeight: 500, lineHeight: 1.4,  letterSpacing: 0.02 }
  button:   { fontSize: 15px, fontWeight: 600, lineHeight: 1.2,  letterSpacing: 0 }
```

**주의:** `caption`은 14px이 하한이다 — §7 `min-body-size`(must, 14px 이상) constraint와
항상 동시에 적용되므로, 이 기본 스케일 값이 그 제약을 위반해서는 안 된다.
(v1.1에서 caption 12px로 자체 모순이 발생했던 사례 — 부록 C 참조)

### 13.4 known-gaps 표기

이 절의 기본값으로 채워진 슬롯은 여전히 `known-gaps`에 기록한다. 단 reason은
"concept 단계 — 실측 없음, 표준 기본값 사용"이 아니라 **"schema §13 concept 기본 스케일 적용"**으로
표기해 계약 근거가 있는 fallback임을 명확히 한다.

---

## 부록 C. 변경 이력 (추가분)

- **v1.1.1 (2026-07-10)** — Phase 5 렌더러 mock 검증에서 발견된 문제 반영:
  - §13 신설 — `source: concept` 인스턴스의 spacing/rounded/typography 기본 스케일을
    계약으로 명문화 (기존엔 렌더러가 "계약 기본값"이라 주장했으나 실제 계약에 근거 없던 문제 해소).
  - domain별 `section` 값 분리 표기 (§13.2) — 워크스페이스/대시보드/마케팅/문서형이
    수직 여백 밀도가 다른 점 반영.
  - `caption` 기본 크기 12px → 14px 조정 — §7 `min-body-size`(must) constraint와의
    자체 모순 해소 사례를 계약에 반영.
