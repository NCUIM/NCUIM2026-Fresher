import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    產生 .next/standalone —— 一份自帶相依的最小執行包。

    Docker 部署（見 GCP/）需要它：沒有的話映像得整包 node_modules，
    體積大好幾倍，而 Cloud Run 每次冷啟動都要拉那個映像。

    Vercel 會忽略這個設定，所以兩邊可以共用同一份設定檔。
  */
  output: "standalone",
  // 實機測試相機需要 HTTPS 通道（cloudflared / ngrok）——見 ADR-0004。
  // 通道網域需列入此處，否則 Next 的開發模式會拒絕跨來源請求。
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.trycloudflare.com",
  ],

  // Next 的開發指示器（畫面角落那個 N）在手機上會蓋住介面，
  // 實機測試時很干擾。關閉它不影響錯誤回報——編譯與執行期的錯誤
  // 仍會照常顯示。想看路由是靜態還是動態時，改用 next build 的輸出。
  devIndicators: false,
};

export default nextConfig;
