import type { Metadata, Viewport } from "next";
import { Noto_Sans_TC, Silkscreen } from "next/font/google";
import "./globals.css";

// 由 Next 自行託管字型檔，不在執行期打外部請求——
// 活動現場的網路已經夠擠了，少一次跨網域往返就少一次卡頓。
const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto-tc",
  display: "swap",
});

const silkscreen = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-silkscreen",
  display: "swap",
});

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
  themeColor: "#060912",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-Hant"
      className={`${notoSansTC.variable} ${silkscreen.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
