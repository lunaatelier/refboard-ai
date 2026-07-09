"use client";

// 공통 페이지 레이아웃 — 모든 단계 화면이 같은 "제품"처럼 보이도록 타이틀·설명·
// 카드·CTA 구조를 한 곳에서 강제한다. 구조: banner → title/description → children
// (각 화면 고유 카드 스택, 내용은 그대로 둠) → cta(카드 밖, 맨 아래, 좌측 정렬).
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
// 하나로 통일 (Reference/Concept가 이미 쓰던 값 = 다수결이자 DESIGN.md label 스펙에 가장 가까움).
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
        alignSelf: "flex-start",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-xs)",
        padding: "10px var(--space-base)",
        borderRadius: "var(--radius-md)",
        border: "none",
        background: locked ? "var(--locked)" : undefined,
        color: locked ? "var(--on-primary)" : undefined,
        fontWeight: 600,
        fontSize: 14,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
