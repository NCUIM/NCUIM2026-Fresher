import { headers } from "next/headers";

/**
 * 取得對外可用的網址前綴，用於組出寄給使用者的連結。
 *
 * 不能用 `new URL(req.url).origin`：在隧道或反向代理後面，那會拿到
 * 內部位址，寄出去的驗證信與找回連結會指向 localhost，使用者點了連不到。
 *
 * ⚠️ 正式環境請設定 PUBLIC_ORIGIN。
 * 沒有設定時只能相信請求標頭，而標頭是客戶端可控的——有人把 Host 換成
 * 自己的網域，找回連結就會寄到攻擊者手上。開發時方便，正式環境是漏洞。
 */
export async function getPublicOrigin(): Promise<string> {
  const configured = process.env.PUBLIC_ORIGIN?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const h = await headers();
  // 代理會把原始主機放在 x-forwarded-host，host 則可能是內部位址。
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${proto}://${host}`;
}
