import { NextResponse } from "next/server";
import { consumeToken } from "@/lib/recovery";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

/**
 * 點開信中的找回連結：把身分綁到這台裝置的瀏覽器上。
 *
 * ⚠️ 這裡必須是 Route Handler，不能是 page.tsx。
 * Next.js 不允許在 Server Component 渲染期間設定 cookie——寫了不會報錯，
 * 但 Set-Cookie 根本不會送出，使用者會被導回首頁卻仍然是未登入狀態。
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/recover/[token]">,
) {
  const { token } = await ctx.params;
  const result = await consumeToken(token, "RECOVER_SESSION");

  if (!result.ok) {
    return NextResponse.redirect(new URL("/recover?error=expired", _req.url));
  }

  const res = NextResponse.redirect(new URL("/me", _req.url));
  res.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
  return res;
}
