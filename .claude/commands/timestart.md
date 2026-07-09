# /timestart — AI 협업 세션 시작

다음 순서로 세션을 시작합니다.

## 1. workspace 경로 확인

```powershell
$workspace = @("D:\workspace", "C:\workspace", "$env:USERPROFILE\workspace") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
Write-Output "workspace: $workspace"
```

`$workspace\work-log\template\ai-time-standard.md` 를 읽어 AI 협업 사람 능동시간 산정 기준을 확인합니다.

## 2. 현재 KST 시각 확인

```powershell
Get-Date -Format "yyyy-MM-dd HH:mm (ddd)"
```

## 3. 프로젝트명

이 프로젝트는 `refboard-ai` 으로 고정되어 있습니다 (설치 시 자동 지정, 다시 묻지 않습니다).
기록 저장 그룹은 `design-orchestrator` 입니다 (`refboard-ai`과 다르면, 다른 프로젝트와 시간추적을 하나로 묶는 특수 설정).

## 4. 세션 시작 선언

아래 형식으로 출력합니다. `design-orchestrator`이 `refboard-ai`과 같으면 "그룹" 줄은 생략합니다.

```
✅ 세션 시작
프로젝트  : refboard-ai
그룹      : design-orchestrator
시작 시각 : [KST 시각]
기준      : IDLE_CAP 10분 / AI 응답·도구 실행 시간 제외

작업 목적을 알려주시면 시작하겠습니다.
```
