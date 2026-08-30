import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessEvent, getCurrentAdmin } from "@/lib/admin-session";
import { getReceivedImpressions } from "@/lib/wall";
import { getShowcase } from "@/lib/showcase";

/**
 * 一位參與者的浮光牆與九宮格，供 Admin 審核。
 *
 * 這不是新的權限：CONTEXT.md 早就寫明 Impression「只有收件人與 Admin
 * 看得到」、Wall「僅本人與 Admin 可見」，隱藏功能也明定「隱藏只影響
 * 收件人自己的檢視，不刪除資料——Admin 仍須能查看以進行審核」。
 * 先前只是沒有實作出入口。
 *
 * 因此這裡 includeHidden 為 true：被檢舉或隱藏的內容正是最需要被看到的。
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/admin/participants/[id]/detail">,
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const target = await prisma.participant.findUnique({
    where: { id },
    select: { id: true, nickname: true, eventId: true },
  });
  // 無權與不存在回同一個 404，否則可以拿 id 探測別場有哪些人。
  if (!target || !(await canAccessEvent(admin, target.eventId))) {
    return NextResponse.json({ error: "找不到這位參與者" }, { status: 404 });
  }

  const [wall, showcase] = await Promise.all([
    getReceivedImpressions(id, { includeHidden: true }),
    getShowcase(id),
  ]);

  return NextResponse.json({
    nickname: target.nickname,
    wall,
    showcase: showcase.map((s) => ({
      position: s.position,
      nickname: s.card.nickname,
      avatarUrl: s.card.avatarUrl,
    })),
  });
}
