import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-session";
import { generateSessionToken } from "@/lib/codes";

/**
 * 協助遺失身分的參與者重新綁定（第一階段取代 email 自助找回的作法）。
 *
 * 產生**新的** sessionToken 而非揭露舊的：舊 token 可能仍存在於某台裝置上，
 * 換發等於同時把遺失的那份作廢。回傳的網址由工作人員當面出示給本人開啟。
 */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/admin/participants/[id]/rescue">,
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const participant = await prisma.participant.findUnique({ where: { id } });
  if (!participant) {
    return NextResponse.json({ error: "找不到這位參與者" }, { status: 404 });
  }

  const sessionToken = generateSessionToken();
  await prisma.participant.update({ where: { id }, data: { sessionToken } });

  const origin = new URL(req.url).origin;
  return NextResponse.json({
    nickname: participant.nickname,
    rescueUrl: `${origin}/rescue/${sessionToken}`,
  });
}
