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
  /*
    OpenGraph 的絕對網址需要一個基準。沒有 metadataBase 時 Next 會退回
    localhost，貼到聊天室的預覽圖就抓不到——那是只在正式環境才會出現的錯。

    用 PUBLIC_ORIGIN 而不是讀請求標頭：metadata 在模組層求值，拿不到
    request；而標頭本來就是客戶端可偽造的（見 lib/origin.ts）。
  */
  metadataBase: process.env.PUBLIC_ORIGIN
    ? new URL(process.env.PUBLIC_ORIGIN)
    : undefined,

  title: "NCUIM 新生茶會",
  description: "卡片收集遊戲，掃一下就開始",

  /*
    明確寫出 OpenGraph，不要讓各家 App 自己從 title/description 推斷。
    推斷出來的結果在 LINE、Messenger、Discord 上都不一樣，而活動連結
    主要就是靠聊天室傳播。

    圖沿用分頁圖示。標準的 OG 圖是 1200×630 的橫幅，我們這張是 256
    見方，預覽卡會顯示成右側的小方圖——對一個活動連結足夠了。
  */
  openGraph: {
    title: "NCUIM 新生茶會",
    description: "卡片收集遊戲，掃一下就開始",
    type: "website",
    locale: "zh_TW",
    images: ["/icon-256.png"],
  },

  /*
    不進搜尋引擎。這個站有參與者的暱稱、頭像與收集紀錄，沒有理由讓它們
    出現在搜尋結果裡；活動封存之後也不該留下殘影。

    這**不影響**貼連結時的預覽卡——那是抓 OG 標籤，跟索引無關。
  */
  robots: { index: false, follow: false },

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
          Analytics 記錄的是瀏覽量；SpeedInsights 記錄的是真實使用者的
          載入耗時（LCP、TTFB 等）。要判斷「現場到底慢在哪」看的是後者——
          它會告訴你慢的是伺服器回應還是前端渲染，那是兩種完全不同的修法。

          只在 Vercel 上掛載。這兩個元件會去抓 /_vercel/insights/script.js
          與 /_vercel/speed-insights/script.js，那是 Vercel 平台注入的路徑——
          在 Cloud Run 上不存在，每次載入頁面都會多兩個 404。功能不會壞，
          但那是白費的往返，而活動現場的網路已經夠擠了。

          VERCEL=1 由 Vercel 自動注入，建置期與執行期都有。這一層是 server
          component，判斷在伺服器端完成，不會有客戶端的環境變數問題。

          放在 children 之後：它們不影響版面，晚一點掛載也不會擋到內容。
        */}
        {process.env.VERCEL === "1" && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  );
}
