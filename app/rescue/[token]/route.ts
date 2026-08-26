import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

/**
 * 工作人員協助找回身分時開啟的網址。
 *
 * 與 /recover/[token] 相同：必須是 Route Handler，Server Component
 * 在渲染期間設定的 cookie 不會被送出。
 */
export async function GET(
  req: Request,
  ctx: RouteContext<"/rescue/[token]">,
) {
  const { token } = await ctx.params;

  const participant = await prisma.participant.findUnique({
    where: { sessionToken: token },
    select: { id: true },
  });

  if (!participant) {
    return NextResponse.redirect(new URL("/?error=rescue-expired", req.url));
  }

  const res = NextResponse.redirect(new URL("/me", req.url));
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
