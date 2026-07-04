# /w-note — 주간 연구노트 작성

이번 주 세션 로그를 취합해 연구노트 서식으로 정리합니다. 프로젝트명은 `refboard-ai`으로 고정되어 있습니다.

## 1. 현재 주차 확인

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

## 2. 세션 로그 읽기

`$workspace\work-log\refboard-ai\session_[weekStart].md` 를 읽어
이번 주 세션들의 작업 내용을 파악합니다.

## 3. 연구노트 작성

세션 로그 내용을 바탕으로 아래 서식에 맞춰 연구노트를 작성합니다.
저장 경로: `$workspace\work-log\refboard-ai\research_[weekStart].md`

**비개발자 친화적 모드 (필수):** 세션 로그가 개발 용어로 남아있더라도, 연구노트로 옮길 때는 개발 용어를 그대로 쓰지 않고 "무엇을 할 수 있게 됐는지/무엇을 알게 됐는지" 결과 중심으로 풀어 쓴다. 팀장·기획자 등 비개발자가 읽어도 이해할 수 있어야 한다.

작성 서식:

```
# 이번주 연구목표
## 해결하려는 문제
[세션 로그에서 파악된 핵심 문제]
## 핵심 결과 기준
[이번 주 목표 달성 기준]

---

# 수행내용
[분석·테스트 항목, 검증 횟수, 학습·개선 포인트 등 수행 과정 자유 기술]

### AI 활용방식
- [활용 방식 1]
- [활용 방식 2]

---

# 결과
## 잘된 점
[이번 주 잘 작동하거나 성과가 있었던 내용]
## 문제점
[발생한 이슈, 미해결 사항]
## 알게된 점
[인사이트, 교훈]

---

# 산출물
## 프롬프트, 가이드, 테스트 결과, 이미지 등
[생성된 산출물 목록]
## 첨부/링크
[관련 파일명 또는 경로]

---

# 다음 연구계획
[다음 주에 진행할 내용]

---

# 개선 계획
[프로세스·도구·접근법 개선 사항]
```

## 4. 확인 요청

초안 작성 후 사용자에게 수정·보완 사항을 확인합니다.
확인 완료 시 파일을 저장합니다.
