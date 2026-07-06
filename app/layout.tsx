import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RefBoard AI",
  description:
    "기획서를 업로드하면 AI가 프로젝트를 분석하여 레퍼런스 · 무드보드 · 컨셉을 생성합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        {/* Noto Sans KR: 최종 폴백 (Pretendard/SUIT CDN 로드 실패 시) — Google Fonts는 자체 서브셋팅으로 한글 글리프 누락 위험이 없다 */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
