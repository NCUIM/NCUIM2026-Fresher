import type { Metadata, Viewport } from "next";
import { Noto_Sans_TC, Silkscreen } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
  /*
    分頁圖示與 iOS「加入主畫面」的圖示。後者值得特別設：
    活動當天有人會把頁面加到主畫面，沒有這個就只會拿到一張網頁截圖。

    指向 256px 的版本而不是 icon.png——原圖是 1254px、1MB。
    <link rel="icon"> 不會經過 next/image，指向原圖等於讓每個人
    為了一個分頁角落的圖示下載 1MB。
  */
  icons: { icon: "/icon-256.png", apple: "/icon-256.png" },
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
      <body className="antialiased">
        {children}
        {/*
          兩者都只在 Vercel 上實際運作，本機開發時不會送出任何請求。

          Analytics 記錄的是瀏覽量；SpeedInsights 記錄的是真實使用者的
          載入耗時（LCP、TTFB 等）。要判斷「現場到底慢在哪」看的是後者——
          它會告訴你慢的是伺服器回應還是前端渲染，那是兩種完全不同的修法。

          放在 children 之後：它們不影響版面，晚一點掛載也不會擋到內容。
        */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
