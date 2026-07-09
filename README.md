# RefBoard AI (제품 A) — 문서 세트

디자이너가 기획서를 올리면 분석 → 레퍼런스/무드보드 → 컨셉서까지 자동화하는 Next.js 웹앱.
이 폴더는 **Claude Code로 구현하기 위한 설계 문서 세트**다.

## 폴더 배치

```
프로젝트루트/
├─ CLAUDE.md                       ← 최상위 컨텍스트 (제품정의·스택·보안원칙·Phase)
├─ README.md                       ← 이 문서 (문서 지도)
├─ .env.local                      ← .env.local.example 복사 후 키 입력
├─ .gitignore                      ← gitignore.txt를 리네임
└─ docs/specs/
   ├─ data-model.md                ← 모든 타입·상태객체·데이터 계보 (단일 기준)
   ├─ phase1-masking-spec.md       ← Phase 1 셸+마스킹 상세
   ├─ product-a-flow-spec.md       ← Phase 2~4 단계별 정보흐름·UX
   └─ implementation-steps.md      ← ★ 구현 순서 (13스텝) — 개발 시작점
```

## 읽는 순서 (Claude Code)

1. **CLAUDE.md** — 전체 맥락·보안 원칙 파악
2. **implementation-steps.md** — 지금 어느 스텝인지 확인, 한 스텝만 골라 진행
3. 그 스텝이 참조하는 **data-model / phase1-masking-spec / product-a-flow-spec** 해당 부분

## 구현 시작

```
docs/specs/의 문서들과 implementation-steps.md를 읽고, Step 1(문서 충돌 정리)부터 시작해줘.
한 번에 한 스텝만. 선행 조건 확인 후 시작하고, 확인 시나리오를 만족하면 멈춰.
다음 스텝으로 넘어가지 마.
```

## 핵심 원칙 요약 (상세는 CLAUDE.md)

- **보안 최우선:** 외부 AI(Gemini/Unsplash/Pexels)엔 마스킹된 데이터만. 원문·복원매핑·실명은 절대 외부로 안 감(자사 서버까지만, 메모리·무저장).
- **엔티티 민감도 등급:** 고객사(가림) vs 분석 대상 브랜드·공개 엔티티(사용자 확인 후 실명 유지). CLAUDE.md §4.1.1.
- **이미지 = opt-in:** 기본값 텍스트만. 이미지 분석 응답은 저장 전 재마스킹.
- **모든 렌더링 클라이언트:** HTML/PPT/PDF/MD. 서버 렌더 없음(복원매핑 유출 방지).
- **Concept JSON = 단일 원천(SSoT):** 모든 산출물이 여기서 파생.
- **타입은 그 기능 만드는 스텝에서 추가:** 미리 전체 타입 안 바꿈.

## MVP 경계

- **Step 4 완료 = Phase 1 Safe MVP** (txt/md 텍스트 안전 경로), 첫 배포 가능.
- **Step 5 완료 = Phase 1 File Upload Complete** (+pdf/pptx).
- Step 13 완료 = 제품 A v1.0 (재활용까지).
- 디자인 MD 출력(Phase 5)은 제품 B 스키마 검증 후 별도. 지금 범위 아님.

## 별도 문서 (제품 B·일정)

- `docs/roadmap-jul-sep.md` — 7~9월 일정 (일반인 언어)
- `docs/schema-consumability-checklist.md` — 제품 B 표준 스키마 검증 체크리스트
- 제품 B(디자인 MD 파이프라인)는 **별도 레포·별도 트랙**. 이 문서 세트는 제품 A 전용.
