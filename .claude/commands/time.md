# /time — AI 협업 세션 종료 및 시간 산정

다음 순서로 세션을 종료하고 시간을 산정합니다. 프로젝트명은 `refboard-ai`으로 고정되어 있습니다.

## 1. 현재 KST 시각 확인

```powershell
Get-Date -Format "yyyy-MM-dd HH:mm:ss (ddd)"
```

## 2. 사용 도구 감지 및 JSONL 선택

```powershell
$workspace = @("D:\workspace", "C:\workspace", "$env:USERPROFILE\workspace") |
    Where-Object { Test-Path $_ } | Select-Object -First 1

# Claude Code JSONL — 프로젝트 폴더 경로(workspace 루트가 아니라)를 인코딩해야 한다.
# workspace 루트만 인코딩하면 다른 날/다른 프로젝트의 stale 파일을 잘못 골라 도구 판정이 틀어진다.
$projectPath = "$workspace\refboard-ai"
$encoded = $projectPath -replace ":", "-" -replace "\\", "-"
$claudeFile = Get-ChildItem "$env:USERPROFILE\.claude\projects\$encoded" -Filter "*.jsonl" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

# Codex JSONL (오늘 날짜 폴더)
$today = Get-Date
$codexDir = "$env:USERPROFILE\.codex\sessions\$($today.Year)\$($today.Month.ToString('00'))\$($today.Day.ToString('00'))"
$codexFile = if (Test-Path $codexDir) {
    Get-ChildItem $codexDir -Filter "*.jsonl" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
} else { $null }

# 더 최근에 수정된 파일을 현재 세션으로 판단
if ($codexFile -and $claudeFile) {
    if ($codexFile.LastWriteTime -gt $claudeFile.LastWriteTime) {
        $tool = "Codex"; $sessionFile = $codexFile
    } else {
        $tool = "Claude Code"; $sessionFile = $claudeFile
    }
} elseif ($codexFile) {
    $tool = "Codex"; $sessionFile = $codexFile
} else {
    $tool = "Claude Code"; $sessionFile = $claudeFile
}

Write-Output "감지된 도구: $tool"
Write-Output "세션 파일: $($sessionFile.Name)"
```

## 3. 사용자 메시지 타임스탬프 추출

```powershell
$lines = Get-Content $sessionFile.FullName | Where-Object { $_ -ne "" }
$userTimes = @()

foreach ($line in $lines) {
    try {
        $obj = $line | ConvertFrom-Json
        # Claude Code: type="user", message.role="user" — 주의: Anthropic API 스펙상
        # tool_result 콘텐츠 블록도 user role 메시지로 감싸져서 동일하게 기록되므로,
        # message.content가 배열이면 tool_result가 아닌 블록이 최소 하나 있어야
        # "실제 사람 입력"으로 인정한다 (그냥 type/role만 보면 도구 실행 결과까지
        # 사람 메시지로 잘못 집계되어 능동시간이 크게 과대 산정된다 — 실측 사례:
        # 필터링 전 335개 중 실제 사람 입력 22개, 잘못 계산하면 2.9배 과대 집계됨).
        # Codex: type="event_msg", payload.type="user_message"는 사람 입력 전용
        # 이벤트라 이 문제가 없음(tool 결과는 다른 payload.type으로 기록됨).
        if ($obj.type -eq "user" -and $obj.message.role -eq "user") {
            $content = $obj.message.content
            $isRealUser = $false
            if ($content -is [string]) {
                $isRealUser = $true
            } elseif ($content -is [array]) {
                $hasNonToolResult = $content | Where-Object { $_.type -ne "tool_result" }
                if ($hasNonToolResult) { $isRealUser = $true }
            }
            if ($isRealUser) {
                $kst = [datetime]::Parse($obj.timestamp).AddHours(9)
                $userTimes += $kst
            }
        } elseif ($obj.type -eq "event_msg" -and $obj.payload.type -eq "user_message") {
            $kst = [datetime]::Parse($obj.timestamp).AddHours(9)
            $userTimes += $kst
        }
    } catch {}
}
$userTimes | ForEach-Object { $_.ToString("HH:mm:ss") }
```

## 4. IDLE_CAP 적용 및 능동시간 계산

추출한 타임스탬프 목록에서 순서대로 gap을 계산하고 합산합니다.

```
공식: AI 협업 사람 능동시간 = Σ min(gap_i, 10분)
- gap_i ≤ 10분 → 전량 포함
- gap_i > 10분 → 10분만 포함 (자리비움 처리)
```

첫 번째 메시지는 gap 계산 대상 제외 (기준점).

## 5. 이번 세션 작업 요약

현재 대화 내용을 바탕으로 이번 세션에서 수행한 작업을 3~5줄로 요약합니다.
민감 정보(전체 경로, 계정명 등)는 마스킹합니다.

## 6. 주차 계산 및 파일 경로 결정

```powershell
$workspace = @("D:\workspace", "C:\workspace", "$env:USERPROFILE\workspace") |
    Where-Object { Test-Path $_ } | Select-Object -First 1

$today = Get-Date
$dow = [int]$today.DayOfWeek
$daysSinceFri = ($dow - 5 + 7) % 7
$weekStart = $today.AddDays(-$daysSinceFri).ToString("yyyy-MM-dd")
$weekEnd = $today.AddDays(-$daysSinceFri + 6).ToString("yyyy-MM-dd")
Write-Output "$weekStart ~ $weekEnd"
```

파일 경로: `$workspace\work-log\refboard-ai\session_[weekStart].md`

폴더가 없으면 생성 후 파일을 새로 만들고, 있으면 기존 파일에 누적 추가합니다.

## 안전한 쓰기 절차 (필수 — 데이터 손실 방지)

경로 혼동(`refboard-ai\work-log\...`라는 프로젝트 내부 경로에 잘못 저장)과 전체 덮어쓰기가 겹치면 기존 세션이 통째로 사라질 수 있습니다. 세션 로그 파일에 쓰기 전 반드시 아래 순서를 지킵니다.

0. **PowerShell로 쓸 때는 반드시 single-quoted here-string(`@'...'@`)을 사용**: 작업 내용 요약에 백틱(`` ` ``, 코드 포맷용)이 들어가는 경우가 많은데, 큰따옴표 here-string(`@"..."@`)을 쓰면 PowerShell이 백틱을 escape 문자로 해석합니다 — `` `t ``/`` `n ``/`` `r ``이 각각 tab/newline/carriage-return으로 치환되며 그 뒤 글자(t/n/r)가 사라져 "tsc"가 "sc", "resolveX"가 "esolveX"처럼 손상됩니다. 변수 보간이 필요 없는 고정 텍스트라면 항상 `@'...'@`(single-quoted, 리터럴)를 쓰고, `@"..."@`는 쓰지 않습니다.
1. **경로 검증**: 대상 경로에 `refboard-ai\work-log\`가 포함되면(프로젝트 폴더 내부) 금지 경로이므로 즉시 중단하고 사용자에게 알립니다. 올바른 경로는 `$workspace\work-log\refboard-ai\session_[weekStart].md`처럼 workspace 루트(프로젝트 폴더의 부모 폴더) 기준이어야 합니다.
2. **파일이 이미 존재하면**:
   - 먼저 `Get-Content`로 전체 내용을 읽어 기존 세션 개수와 내용을 확인합니다.
   - 같은 폴더에 `session_[weekStart].md.bak`으로 현재 내용을 백업합니다 (매번 최신 상태로 덮어써도 됩니다).
   - **`Set-Content`로 전체를 다시 쓰지 않습니다.** 읽어온 기존 내용 뒤에 새 세션 블록만 이어붙인 결과를 써야 합니다 — "추가"는 허용하지만 "전체 교체"는 절대 금지합니다.
3. **파일이 없으면** 새로 생성합니다 (헤더 + 첫 세션만 포함). 이 경우에만 전체 쓰기가 허용됩니다.
4. **쓰기 후 검증**: 파일을 다시 읽어 (a) 쓰기 전에 있던 세션 항목 수가 줄지 않았는지, (b) 새 세션이 끝에 추가됐는지 확인합니다. 항목이 줄었으면 즉시 `.bak`에서 복구하고 사용자에게 알립니다.
5. **검증 통과 시에만 커밋**: 4번 검증을 통과한 경우에만 `work-log` 저장소에 커밋합니다. 검증에 실패했으면 커밋하지 않습니다 — 잘못된 상태가 git 기록에 남지 않도록 합니다.
   ```powershell
   git -C "$workspace\work-log" add "refboard-ai/session_[weekStart].md"
   git -C "$workspace\work-log" commit -m "log: refboard-ai [YYYY-MM-DD] 세션 기록"
   ```
   커밋된 내용은 이후 다시 잘못 쓰여도 `git log`/`git show`로 언제든 이전 정상 상태를 복구할 수 있는 영구 기록이 됩니다.

## 7. 세션 로그 파일에 기록

파일이 없으면 헤더를 먼저 작성합니다:

```
# refboard-ai — AI 협업 세션 로그
## 주간: [weekStart](금) ~ [weekEnd](목)

---
```

이어서 아래 형식으로 세션 내용을 추가합니다 (감지된 도구 이름 포함):

```
### [YYYY-MM-DD (요일)] 세션 N [Claude Code / Codex]
- AI 협업 사람 능동시간: XX분
- 세션 시간: HH:MM ~ HH:MM (KST)
- 작업 내용:
  - [왜 요청했는지 + 무엇을 바꿨는지 형태로 기술]
  - ...

```

오늘이 **목요일**이면 주간 합계를 파일 끝에 추가합니다:

```
---
## 주간 합계
- 총 AI 협업 사람 능동시간: H시간 M분 (60분 미만이면 M분만 표기. 예: 102분 → 1시간 42분, 762분 → 12시간 42분)
- 세션 수: N개 (Claude Code N개 / Codex N개)
- 집계 기간: [weekStart](금) ~ [weekEnd](목)
- 기준: IDLE_CAP 10분, KST 기준
```

## 8. 결과 출력

```
✅ 세션 종료
프로젝트      : refboard-ai
도구          : [Claude Code / Codex]
세션 시간     : HH:MM ~ HH:MM (KST)
AI 협업 사람 능동시간 : XX분
저장          : work-log/refboard-ai/session_[weekStart].md
```
