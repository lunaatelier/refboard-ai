<!-- ai-worklog:start -->
# Work-Log Session Rules (refboard-ai)

이 프로젝트(`refboard-ai`)에서 사용자가 `/timestart`, `/time`, `/w-note`를 입력하면 아래 규칙을 따른다.

## 공통 기준

- 시간대는 KST 기준으로 처리한다.
- AI 협업 사람 능동시간은 `IDLE_CAP = 10분` 기준으로 계산한다.
- 공식은 `AI 협업 사람 능동시간 = Σ min(gap_i, 10분)`이다.
- AI 응답 생성 시간, 도구 실행 시간, 접속 유지 시간은 능동시간에서 제외한다.
- 원본 세션 로그, 전체 로컬 경로, 계정명, 세션 ID는 기록하지 않는다.
- 여기서 `workspace 루트`는 현재 프로젝트 폴더(`refboard-ai`)가 아니라 그 상위 공용 작업 폴더를 뜻한다.
  - 계산 규칙: 현재 프로젝트 폴더가 `[workspace]\refboard-ai`라면 workspace 루트는 `[workspace]`이다.
  - 예: 현재 작업 경로가 `[workspace]\refboard-ai`이면 저장 기준은 `[workspace]\work-log\...`이다.
- 산정 기준 상세 문서: workspace 루트 기준 `work-log\template\ai-time-standard.md`.
- 기록 저장 위치: workspace 루트 기준 `work-log\refboard-ai\`이다.
  - 실제 저장 경로 형식: `[workspace]\work-log\refboard-ai\`
  - 금지 경로 형식: `[workspace]\refboard-ai\work-log\`
- `/time`, `/w-note` 실행 전 저장/읽기 대상 경로가 프로젝트 내부 `work-log`가 아닌지 확인한다.
- Claude Code JSONL 세션 파일 위치(`~/.claude/projects/<encoded>`)를 찾을 때 `<encoded>`는 **workspace 루트가 아니라 현재 프로젝트 폴더 전체 경로**(`[workspace]\refboard-ai`)를 인코딩한 값이다(`:` → `-`, `\` → `-`). workspace 루트만 인코딩하면 다른 프로젝트/날짜의 stale 파일을 잘못 골라 도구 판정(Claude Code vs Codex)이 틀어진다.

## `/timestart`

1. 현재 KST 시각을 확인한다.
2. 프로젝트명은 `refboard-ai`으로 고정한다 (다시 묻지 않는다).
3. 세션 시작 상태를 현재 대화 안에서 유지한다.
4. 아래 형식으로 응답한다.

```text
세션 시작
프로젝트  : refboard-ai
시작 시각 : [YYYY-MM-DD HH:mm] (KST)
기준      : IDLE_CAP 10분 / AI 응답·도구 실행 시간 제외

작업 목적을 알려주시면 시작하겠습니다.
```

## `/time`

1. 현재 KST 시각을 확인한다.
2. 현재 세션 도구를 Claude Code 또는 Codex로 식별한다.
3. `/timestart` 이후 사용자의 입력 간격을 기준으로 능동시간을 계산한다.
4. 정확한 메시지 타임스탬프에 접근할 수 없으면, 확인 가능한 대화 흐름과 시작/종료 시각을 기준으로 보수적으로 산정하고 그 사실을 짧게 알린다.
5. 이번 세션 작업 내용을 3~5줄로 요약한다.
6. 현재 주차를 금요일 시작, 목요일 종료로 계산한다.
7. 프로젝트 폴더 내부가 아닌 프로젝트 상위 workspace 루트의 `work-log\refboard-ai\session_[weekStart].md` 파일에 세션 내용을 추가한다.
8. 오늘이 목요일이면 파일 끝에 주간 합계를 추가한다.
9. 아래 형식으로 응답한다.

```text
세션 종료
프로젝트      : refboard-ai
도구          : [Claude Code / Codex]
세션 시간     : HH:mm ~ HH:mm (KST)
AI 협업 사람 능동시간 : XX분
저장          : work-log/refboard-ai/session_[weekStart].md
```

## 안전한 쓰기 절차 (필수 — 데이터 손실 방지)

경로 혼동(`refboard-ai\work-log\...`라는 프로젝트 내부 경로에 잘못 저장)과 전체 덮어쓰기가 겹치면 기존 세션이 통째로 사라질 수 있다. 세션 로그 파일에 쓰기 전 반드시 아래 순서를 지킨다.

1. **경로 검증**: 대상 경로에 `refboard-ai\work-log\`가 포함되면(프로젝트 폴더 내부) 금지 경로이므로 즉시 중단하고 사용자에게 알린다. 올바른 경로는 workspace 루트 기준 `work-log\refboard-ai\session_[weekStart].md`이다.
2. **파일이 이미 존재하면**:
   - 먼저 파일 전체를 읽어 기존 세션 개수와 내용을 확인한다.
   - 같은 폴더에 `session_[weekStart].md.bak`으로 현재 내용을 백업한다 (매번 최신 상태로 덮어써도 된다).
   - apply_patch를 쓸 경우 **"Add File"이 아니라 "Update File"**을 사용하고, 기존 내용을 모두 보존한 채 새 세션 블록만 끝에 추가하는 diff를 만든다. shell로 쓸 경우 기존 내용을 변수로 읽어온 뒤 새 블록을 이어붙여서 다시 쓴다 — 새 내용만으로 전체를 덮어쓰지 않는다.
3. **파일이 없으면** 새로 생성한다 (헤더 + 첫 세션만 포함). 이 경우에만 "Add File"/전체 쓰기가 허용된다.
4. **쓰기 후 검증**: 파일을 다시 읽어 (a) 쓰기 전에 있던 세션 항목 수가 줄지 않았는지, (b) 새 세션이 끝에 추가됐는지 확인한다. 항목이 줄었으면 즉시 `.bak`에서 복구하고 사용자에게 알린다.
5. **검증 통과 시에만 커밋**: 4번 검증을 통과한 경우에만 `work-log` 저장소에 커밋한다. 검증에 실패했으면 커밋하지 않는다 — 잘못된 상태가 git 기록에 남지 않도록 한다.
   ```
   git -C "[workspace]/work-log" add "refboard-ai/session_[weekStart].md"
   git -C "[workspace]/work-log" commit -m "log: refboard-ai [YYYY-MM-DD] 세션 기록"
   ```
   커밋된 내용은 이후 다시 잘못 쓰여도 `git log`/`git show`로 언제든 이전 정상 상태를 복구할 수 있는 영구 기록이 된다.

## 세션 로그 파일 형식

파일이 없으면 먼저 아래 헤더를 만든다.

```markdown
# refboard-ai — AI 협업 세션 로그
## 주간: [weekStart](금) ~ [weekEnd](목)

---
```

각 세션은 아래 형식으로 누적한다.

```markdown
### [YYYY-MM-DD (요일)] 세션 N [Claude Code / Codex]
- AI 협업 사람 능동시간: XX분
- 세션 시간: HH:mm ~ HH:mm (KST)
- 작업 내용:
  - [작업 요약 1]
  - [작업 요약 2]
  - [작업 요약 3]

```

목요일에는 필요한 경우 아래 주간 합계를 추가한다.

```markdown
---
## 주간 합계
- 총 AI 협업 사람 능동시간: H시간 M분 (60분 미만이면 M분만 표기. 예: 102분 → 1시간 42분, 762분 → 12시간 42분)
- 세션 수: N개 (Claude Code N개 / Codex N개)
- 집계 기간: [weekStart](금) ~ [weekEnd](목)
- 기준: IDLE_CAP 10분, KST 기준
```

## `/w-note`

1. 현재 주차를 금요일 시작, 목요일 종료로 계산한다.
2. 프로젝트 상위 workspace 루트의 `work-log\refboard-ai\session_[weekStart].md`를 읽는다.
3. 연구노트 초안을 작성해 사용자에게 확인받는다.
4. 확인 후 프로젝트 상위 workspace 루트의 `work-log\refboard-ai\research_[weekStart].md`에 저장한다.
<!-- ai-worklog:end -->

