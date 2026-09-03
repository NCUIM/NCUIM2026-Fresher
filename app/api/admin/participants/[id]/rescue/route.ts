import { NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { canAccessEvent, getCurrentAdmin } from "@/lib/admin-session";
import { issueToken, TTL_MINUTES } from "@/lib/recovery";

/**
 * 協助遺失身分的參與者重新綁定。
 *
 * 發的是一次性、30 分鐘到期的找回權杖，**不是 sessionToken**。
 *
 * 先前這裡換發一組新的 sessionToken 並把它直接放進網址
 * （`/rescue/<sessionToken>`）。那個字串就是憑證本身，而它沒有到期時間、
 * 也不是一次性的——網址一旦外流（旁邊的人拍照、留在協助用裝置的瀏覽器
 * 歷史裡、被反向代理的存取紀錄完整記下），任何人在活動結束後的任何時間
 * 都還能拿它取得這個人的身分，而且沒有任何作廢的管道。
 *
 * 改用 RecoveryToken 之後，外流的窗口從「永久」縮短成「本人開啟前的 30 分鐘」，
 * 且本人一開就立即失效。走的是與信箱自助找回完全相同的那條路
 * （/recover/[token] → /api/recover/consume），不必再維護第二套綁定邏輯。
 *
 * 有一個行為差異值得知道：舊憑證的作廢時機從「工作人員按下按鈕的當下」
 * 移到了「本人在確認頁按下按鈕的當下」。這是好的——按錯的話，
 * 那位參與者不會因此被鎖在門外。
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
  /*
    無權操作與不存在回同一個 404。
    這個端點會發出能取得身分的權杖，是全站權限最重的一支——別場的主持人
    若能呼叫它，等於能取得任何人的身分。
  */
  if (!participant || !(await canAccessEvent(admin, participant.eventId))) {
    return NextResponse.json({ error: "找不到這位參與者" }, { status: 404 });
  }

  // issueToken 會把同一位參與者尚未使用的舊權杖一併作廢，
  // 所以重複按下不會在外面累積多把仍然有效的鑰匙。
  const token = await issueToken(participant.id, "RECOVER_SESSION");

  const origin = await getPublicOrigin();
  return NextResponse.json({
    nickname: participant.nickname,
    rescueUrl: `${origin}/recover/${token}`,
    expiresInMinutes: TTL_MINUTES.RECOVER_SESSION,
  });
}
