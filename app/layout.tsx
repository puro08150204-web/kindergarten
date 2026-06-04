import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "幼兒園圖書借閱系統",
  description: "手機優先的幼兒園圖書借閱與後台管理系統"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
