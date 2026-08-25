import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "卡片收集",
  description: "活動卡片收集系統",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 讓內容延伸到瀏海與底部橫條之下，再由 env(safe-area-inset-*) 補回內距。
  viewportFit: "cover",
  // 刻意不設 maximumScale：關閉雙指縮放是可及性問題。
  // 輸入框自動放大改以 globals.css 的 16px 下限處理。
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
