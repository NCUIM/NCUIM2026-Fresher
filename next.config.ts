import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
