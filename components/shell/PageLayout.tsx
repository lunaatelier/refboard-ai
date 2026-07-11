"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

// 공통 페이지 레이아웃 — 모든 단계 화면이 같은 "제품"처럼 보이도록 타이틀·설명·
// 카드·CTA 구조를 한 곳에서 강제한다. 구조: banner → title/description → children
// (각 화면 고유 카드 스택, 내용은 그대로 둠) → cta(카드 밖, 맨 아래, 우측 정렬).
// 카드 안에 카드를 또 두르지 않는다는 원칙(§ 박스는 한 레벨만)과 동일한 이유로,
// 여기서도 타이틀 존은 별도 박스로 감싸지 않고 여백으로만 구분한다.

interface PageLayoutProps {
  title: string;
  description?: string;
  banner?: React.ReactNode;
  cta?: React.ReactNode;
  children?: React.ReactNode;
}

export default function PageLayout({
  title,
  description,
  banner,
  cta,
  children,
}: PageLayoutProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-base)",
      }}
    >
      {banner}
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>
          {title}
        </h2>
        {description && (
          <p
            style={{
              fontSize: 16,
              color: "var(--text-muted)",
              marginTop: "var(--space-xs)",
            }}
          >
            {description}
          </p>
        )}
      </div>
      {children}
      {cta}
    </div>
  );
}

// 표준 카드 스타일 — MaskingReview/AnalysisResult/ConceptWorkspace가 이미 각자
// 로컬로 들고 있던 값과 동일. 새 카드를 추가할 때 이걸 재사용해 드리프트를 막는다.
export const pageCardStyle: React.CSSProperties = {
  background: "var(--canvas)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-lg)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-md)",
};

interface PageCtaProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  locked?: boolean; // true면 완료/비활성 상태 색(--locked)으로 표시
}

// 표준 하단 CTA — 화면마다 10px/12px/14px, 600/700, 14px/16px로 제각각이던 것을
// 하나로 통일. 페이지 레벨 마감 액션이라 DESIGN.md의 xlarge 사이즈(48px·16px/600)를
// 쓴다 — 카드/인라인 액션(large, 40px·14px/600)과 구분된다. 우측 정렬(게시판 관례:
// 저장류 주 액션은 우측, 파괴적·역방향 액션이 있으면 반대편 좌측에 분리).
export function PageCta({
  locked,
  style,
  className,
  children,
  ...props
}: PageCtaProps) {
  return (
    <button
      {...props}
      className={className ?? (locked ? undefined : "btn-primary")}
      style={{
        alignSelf: "flex-end",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-xs)",
        height: 48,
        padding: "0 20px",
        borderRadius: "var(--radius-md)",
        border: "none",
        background: locked ? "var(--locked)" : undefined,
        color: locked ? "var(--on-primary)" : undefined,
        fontWeight: 600,
        fontSize: 16,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

interface LoadingStateProps {
  label: string; // 예: "분석 중"
  caption?: string; // 예: "수십 초 정도 걸릴 수 있어요"
  securityNote?: string; // 이 대기 중 무엇이 외부로 나가는지 — 로딩 요소보다 옅은 톤
}

// 공통 로딩 상태 (실사용#16, known-gaps의 spinner 항목 해소) — 분석뿐 아니라
// 레퍼런스 검색·무드보드·컨셉 생성 등 다른 API 대기 화면에서도 재사용한다.
// 버튼 없음 — 대기 중엔 액션을 두지 않는다.
export function LoadingState({ label, caption, securityNote }: LoadingStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "var(--space-sm)",
        padding: "var(--space-xl) var(--space-lg)",
      }}
    >
      {securityNote && (
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
          {securityNote}
        </p>
      )}
      <Loader2 size={36} className="spin" color="var(--primary)" />
      <span style={{ fontSize: 18, fontWeight: 700 }}>{label}</span>
      {caption && (
        <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{caption}</span>
      )}
    </div>
  );
}

// 폼 검증 오류용 helper text (input-default-error 패턴) — error 색 텍스트만,
// 박스·아이콘 없음, 해당 입력 요소 바로 아래 좌측 정렬. 잘못된 파일 선택,
// 형식 불일치 같은 "사용자 입력 문제"는 전부 이걸 쓴다.
export function InlineErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      style={{
        fontSize: 14,
        color: "var(--error-weak-text)",
        margin: 0,
        textAlign: "left",
        alignSelf: "flex-start",
      }}
    >
      {children}
    </p>
  );
}

interface ErrorStateProps {
  title: string; // 예: "분석에 실패했어요"
  description?: string; // 일반 안내 문구 (고정)
  detail: string; // 실제 실패 원인 한 줄 — catch된 에러에 따라 동적으로 달라짐
  onRetry: () => void;
}

// 공통 에러 상태 (실사용#16, known-gaps의 critical-alert 항목 해소). 카드 내부
// 복구 액션이라 button-primary(40px)를 쓰고 좌측 정렬 — 페이지 레벨 CTA(PageCta,
// 48px·우측 정렬) 규칙과는 별개 컨텍스트다(혼동 방지).
// ⚠️ 사용 기준: critical-alert(이 컴포넌트)는 실제 시스템 장애(AI 호출 실패,
// 네트워크 오류 등)에만 사용한다. 폼 검증 오류(잘못된 파일/형식/입력)에는 쓰지
// 않는다 — 그건 InlineErrorText(input-default-error 패턴)로.
export function ErrorState({
  title,
  description = "일시적인 문제일 수 있습니다. 다시 시도해주세요.",
  detail,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "var(--space-sm)",
        padding: "var(--space-lg)",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: "var(--radius-full)",
          background: "var(--error-weak-bg)",
        }}
      >
        <AlertTriangle size={20} color="var(--error)" />
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color: "var(--error)" }}>
        {title}
      </span>
      <p style={{ fontSize: 16, color: "var(--text-muted)", margin: 0 }}>
        {description}
      </p>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>{detail}</p>
      <button
        onClick={onRetry}
        className="btn-primary"
        style={{
          border: "none",
          borderRadius: "var(--radius-md)",
          padding: "0 16px",
          height: 40,
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        다시 시도
      </button>
    </div>
  );
}
