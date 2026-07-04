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
      <body>{children}</body>
    </html>
  );
}
