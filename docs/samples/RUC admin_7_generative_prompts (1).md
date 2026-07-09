# [Phase B-3] 생성형 프롬프트 컴파일 (Full Coverage v1.0)

> **프로젝트**: RUC 및 통행료 통합 운영 대시보드 (2026 강릉 ITS PoC)
> **버전**: v1.0 (IA 1:1 Coverage Mandatory)
> **가이드**: 본 프롬프트는 `admin_5`의 IA를 100% 반영하며, 모든 하위 메뉴에 대해 개별 UI 구조를 정의합니다.

---

## 🎨 Global Design System (Common Guardrails)

```text
[Global Style Rules]
- Layout: Responsive, fluid Tailwind layout. Sidebar (240px) fixed Left. Main Content area takes remaining space.
- Typography: Primary font is 'Pretendard'. For numbers, use tabular-nums (Fira Code preference).
- Color Palette: 
    * Primary: Deep Navy (#1e293b)
    * Accent (RUC): Neon Cyan (#06B6D4) - Match with Mobile App's primary color.
    * Accent (Closed/Open): Emerald / Blue tones.
    * Alert/Violation: Red / Amber.
- Branding: Project Name must be "RUC Dashboard". Logo should be a clean, tech-inspired icon.
- Data Rule: Use Nicknames (e.g., "[닉네임]") and PoC IDs (e.g., "RUC-2026-XXXX") for data.
```

---

## 🖥️ SCR-ADMIN-001: 1.1 통합 요약 (Overview)
```text
[Task] Create a "Summary Overview Dashboard".
- Stat Cards: Show Total Active Participants, Today's Total RUC Revenue (Cyan), and Pending Violations.
- Main: A multi-series area chart showing 24h revenue trends (Open/Closed/RUC).
- Right: A donut chart showing the billing distribution by vehicle type (EV/Hybrid/ICE).
```

## 🖥️ SCR-ADMIN-002: 1.2 이상 징후 관제맵 (Exception Map)
```text
[Task] Create a "Real-time Live Map for Monitoring".
- Layout: Full-screen Map (Dark Mode styled).
- Features: Vehicle markers in Neon Cyan. Highlight "Violation Suspects" in Red Pulsing circles.
- Sidebar (Right): List of current active exceptions (e.g. "GPS Lost", "Geofence Breach").
```

## 🖥️ SCR-ADMIN-003: 2.1 수집 데이터 조회 (Raw Data)
```text
[Task] Create a "Raw Data Log Viewer".
- Filters: Date/Time range, Participant Search, Data Type (GPS, LPR, Gantry).
- Table: Large data grid with columns [Timestamp, PoC ID, Lat, Lon, Speed, Device ID].
- Action: Export to CSV/Excel button.
```

## 🖥️ SCR-ADMIN-004: 2.2 주행 및 과태료 이력 (History Timeline)
```text
[Task] Create a "Participant History Timeline Viewer".
- Left: Searchable participant list.
- Right: Detailed Timeline node list. Each node shows [Time, Event Type (Gantry In/Out, RUC Calc), Amount, Map Snapshot].
- Color: RUC nodes in Cyan, Penalty nodes in Red.
```

## 🖥️ SCR-ADMIN-005: 2.3 미납 내역 관리 (Unpaid Management)
```text
[Task] Create an "Unpaid Debt Management Console".
- Cards: Total Unpaid Amount, Count of Unpaid Participants.
- Table: List of participants with unpaid balances. Columns [PoC ID, Nickname, Unpaid Amt, Last Drive Date, Reminder Sent Count].
- Action: [Send Reminder Push] button, [Manual Settle] button.
```

## 🖥️ SCR-ADMIN-006: 3.1 지오펜스 설정 관리 (Geofence Editor)
```text
[Task] Create a "Geofence ROI Configuration" screen.
- Layout: Map with drawing tools (Polygon, Circle).
- Panel: List of defined Geofences (e.g. "Gangneung Central", "Ojukheon ROI"). 
- Settings: Stay-time limit (minutes), Fine amount (KRW) per violation.
```

## 🖥️ SCR-ADMIN-007: 3.2 체류 시간 위반 검증 (Violation Verification)
```text
[Task] Create a "Violation Review & Approval" screen.
- Left: Pending review list.
- Center: Replay map showing the selected vehicle's stay trajectory within the ROI.
- Bottom: [Approve Violation & Send Push] / [Dismiss as Exception] buttons.
```

## 🖥️ SCR-ADMIN-008: 4.1 모바일 사용자 관리 (User Mapping)
```text
[Task] Create a "Participant & Device Mapping" screen.
- Features: Register new PoC participants, link with App ID, assign Vehicle Type.
- Table: [Nickname, App ID, Vehicle Type, Registration Date, Status].
```

## 🖥️ SCR-ADMIN-009: 4.2 시스템 권한 관리 (Admin Auth)
```text
[Task] Create an "Admin User Management" screen.
- Features: Manage sub-admin accounts, Assign roles (Viewer, Operator, Super Admin).
- Table: [Admin ID, Name, Dept, Role, Last Login].
```

## 🖥️ SCR-ADMIN-010: 4.3 과금/단속 기준 설정 (Policy Settings)
```text
[Task] Create a "Global Billing Policy Manager".
- Layout: Grid-based input for 3-Tier Pricing.
- Inputs: Open Gantry Price, Closed Section Multiplier, RUC Distance Rate (per km).
- Action: [Apply to All] / [Version History].
```
