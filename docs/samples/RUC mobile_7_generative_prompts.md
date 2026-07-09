# [Phase B-3] RUC v2 v0 Generation Master Prompts (7-Screens)

> **작성일**: 2026-04-29
> **대상 도구**: v0.dev (React + Tailwind + Lucide)
> **디자인 컨셉**: Deep Space Dark Mode (Glassmorphism + Neon Cyan Accents)

---

## 🟦 [GLOBAL] 공통 시스템 프롬프트 (반드시 첫 화면 생성 전 입력)

**[Core Tech Stack]**
- React, Tailwind CSS, Lucide Icons, Framer Motion (for animations)
- State Management: LocalStorage-based session persistence.
- Routing: Single Page App (SPA) simulation.
- Map Engine: OpenStreetMap (OSM) via `react-leaflet` for live tracking simulation.

**[Design System Tokens]**
- Background: `#0F172A` (Deep Space Blue)
- Card/Surface: `#1E293B` with `backdrop-blur-glass (12px)`
- Primary: `#06B6D4` (Cyan 500) / Neon Glow effect (`shadow-[0_0_15px_rgba(6,182,212,0.5)]`)
- Accent: `#8B5CF6` (Purple 500)
- Text: `#F8FAFC` (High emphasis), `#94A3B8` (Muted)
- Typography: Inter (Sans), Fira Code (Mono - for numbers)

**[Common Rules]**
- 모든 버튼과 인터랙션 요소는 `hover:scale-105 active:scale-95 transition-all` 적용.
- 'Slide to Unlock' 형태의 `SwipeButton` 컴포넌트 필수 구현.
- 모바일 전용 UI (iPhone 15 Pro 가로비 기준).
- [Map Protocol]: 모든 지도는 OpenStreetMap을 사용하며, 서비스 테마(Light/Dark)에 맞춰 유연하게 스타일을 전환한다. 다크모드 시에는 배경 테마와 조화되도록 CSS Filter 등을 적용하고, 라이트모드 시에는 OSM 표준 톤을 유지하여 가독성을 확보한다.
- [Live Data]: 지도 위에는 실시간 주행 경로를 표시하는 `Polyline` 컴포넌트 구조를 반드시 포함하며, 상황에 따라 지도 채도와 명도를 조절할 수 있는 확장성을 갖춘다.

---

## 📱 [SCR-M001] 스플래시 & 약관 동의

- **화면 목적**: ITS 2026 로고 노출 및 필수 약관 동의를 통한 서비스 진입.
- **레이아웃**: 
  - 중앙: 'RUC v2' 로고 (네온 Cyan 광채 효과) + 'Gangneung ITS 2026' 서브텍스트.
  - 하단: [위치정보 이용 약관] 체크박스 + [동의하고 시작하기] 고정 버튼.
- **인터랙션**: 로고가 서서히 나타나는 Fade-in 애니메이션.
- **더미 데이터**: "강릉 ITS 세계총회 시연을 위해 위치 정보 수집에 동의해 주세요."

**🤖 [Audit & Refinement: AGT-A]**
- **검토 내용**: 첫 진입 시 동의 버튼이 명확하지 않을 경우 사용자 이탈 가능성 확인.
- **보완 사항**: (Visibility) 하단 버튼에 `shadow-cyan-500/50` 글로우 효과를 추가하여 시각적 위계(Primary CTA)를 극대화하도록 프롬프트 수정.

---

## 📱 [SCR-M002] PoC 프로필 셋업

- **화면 목적**: 시연용 가상 아이덴티티 생성.
- **레이아웃**:
  - Header: "시연 프로필 설정" 타이틀.
  - Body: 
    - 닉네임 입력 (Input)
    - 차종 선택 (Segmented Control: 내연기관 / 전기차)
    - 유종 선택 (Dropdown: 휘발유 / 경유 / 전기)
    - 관리 번호 (자동 생성된 Read-only 값: `RUC-2026-T101`)
  - Footer: [설정 완료] 버튼 (활성화 시 Cyan Glow 효과).
- **인터랙션**: 차종 선택 시 아이콘 변경 애니메이션.

**🤖 [Audit & Refinement: AGT-A]**
- **검토 내용**: 닉네임 미입력 시 '설정 완료'가 가능한지 확인.
- **보완 사항**: (Error Prevention) 모든 필드 입력 전에는 하단 버튼을 `opacity-50 pointer-events-none` 상태로 두었다가, 유효성 검사 통과 시에만 활성화되도록 로직 명시.

---

## 📱 [SCR-M003] 플래닝 모드 (홈)

- **화면 목적**: 목적지 탐색 및 예상 주행 요금 확인.
- **레이아웃**:
  - Top Bar: (좌) 이력 아이콘, (중) 검색창 `[목적지 검색]`, (우) 프로필 아이콘.
  - Center: Full Map Layer (강릉 시내 중심).
  - Bottom Sheet (Glassmorphism): 
    - 예상 거리: `12.5km`
    - 예상 과금: `₩1,875` (RUC 기반)
    - `[Slide to START]` 스와이프 버튼 (Cyan 컬러).
- **인터랙션**: 목적지 입력 시 지도에 예상 경로 오버레이 표시.

**🤖 [Audit & Refinement: AGT-A]**
- **검토 내용**: 주행 시작 버튼이 실수로 눌릴 가능성(Accidental trigger) 확인.
- **보완 사항**: (Error Prevention) 단순 클릭 버튼이 아닌 `SwipeButton`을 강제하여 의도적인 주행 시작만 허용하도록 컴포넌트 규격 고정.

---

## 📱 [SCR-M004] 주행 세션 (라이브 맵)

- **화면 목적**: 실시간 주행 정보 트래킹 및 주행 중 distraction 방지.
- **레이아웃**:
  - Top Overlay: `LiveMeter` (실시간 과금액: `₩345`, 주행 거리: `2.4km` - 카운트업 효과).
  - Center: Live Tracking Map (현재 위치 중심 60도 틸트 뷰).
  - Background Trace: 주행한 경로를 실시간 Cyan 라인으로 드로잉.
  - Bottom: `[Slide to STOP]` 스와이프 버튼 (빨간색, 롱프레스 유도 텍스트).
- **인터랙션**: 속도가 올라가면 미터기 숫자가 빠르게 회전하는 느낌의 애니메이션.

**🤖 [Audit & Refinement: AGT-A]**
- **검토 내용**: 주행 중 타 요소 조작으로 인한 위험성 확인.
- **보완 사항**: (Visibility & Safety) 지도와 미터기 외의 모든 UI를 비활성화(Interaction Lock)하고, 종료 스와이프에만 시각적 피드백(`border-red-500/50`)을 강화하도록 수정.

---

## 📱 [SCR-M005] 주행 리포트 (영수증)

- **화면 목적**: RUC vs 유류세 비교를 통한 정책 홍보.
- **레이아웃**:
  - Header: "주행이 종료되었습니다."
  - Body:
    - `TaxDeltaBar`: RUC (`₩1,875`) vs 가상 유류세 (`₩2,450`) 막대 그래프 비교.
    - "귀하는 이번 주행에서 유류세 대비 `₩575`를 절감하였습니다." (Highlighting message).
  - Footer: [이력 확인하기] / [홈으로 돌아가기] 버튼.
- **인터랙션**: 막대 그래프가 0에서부터 차오르는 애니메이션.

---

## 📱 [SCR-M006] 주행 이력 관리 (History)

- **화면 목적**: 누적 데이터 및 상세 경로 복기.
- **레이아웃**:
  - Header: "주행 이력" (뒤로가기 버튼 포함).
  - Body:
    - `TripHistoryCard` 리스트: `2026.04.29 | 강릉역 -> 경포대 | ₩1,875`.
    - 클릭 시 `DetailMapModal` 팝업: 정적인 지도 경로 + 구간별 과금 브레이크다운 (예: 도심 구간 5km - ₩500).
- **인터랙션**: 카드 클릭 시 부드럽게 모달이 확장되며 상세 정보 노출.

---

## 📱 [SCR-M007] 마이페이지 (프로필 & 리셋)

- **화면 목적**: 개인 정보 확인 및 PoC 종료 후 데이터 초기화.
- **레이아웃**:
  - Header: "마이페이지".
  - Body:
    - 프로필 정보 섹션 (닉네임, 차종 등 요약).
    - 시연 가이드 섹션.
  - Footer: 
    - `[데이터 완전 초기화]` 버튼 (빨간색 테두리, 하단에 "다음 시연자를 위해 정보를 삭제합니다" 안내).
- **인터랙션**: 초기화 버튼 클릭 시 **[정말로 삭제하시겠습니까?]** Confirm Modal 노출 → 수락 시 SCR-M001로 강제 리다이렉트.

**🤖 [Audit & Refinement: AGT-A]**
- **검토 내용**: 데이터 삭제 후 '어디로 갔는지' 모를 수 있는 상황(Disorientation) 방지 확인.
- **보완 사항**: (Feedback) 삭제 완료 후 바로 스플래시로 가는 대신 "데이터가 초기화되었습니다"라는 짧은 Success Toast 노출 후 M001로 이동하도록 플로우 정교화.
