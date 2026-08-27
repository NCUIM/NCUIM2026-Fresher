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
};

export default nextConfig;
