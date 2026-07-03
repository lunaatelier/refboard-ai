import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Design Reference Generator",
  description:
    "기획서를 업로드하면 분석 → 레퍼런스/무드보드 → 컨셉서까지 도출하는 디자이너 도구",
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
