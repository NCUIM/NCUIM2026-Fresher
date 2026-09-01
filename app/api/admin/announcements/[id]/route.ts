import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canAccessEvent, getCurrentAdmin } from "@/lib/admin-session";
import { firstErrorMessage } from "@/lib/validation";

const patchSchema = z.object({
  body: z.string().trim().min(1, "公告內容不可為空").max(500),
});

/**
 * 取得這則公告，並確認呼叫者有權動它。
 *
 * 無權與不存在回同一個 404：否則可以拿 id 探測別場有哪些公告。
 */
async function requireAnnouncement(id: string) {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "需要管理員權限", status: 401 as const };

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    select: { id: true, eventId: true, body: true },
  });
  if (!announcement || !(await canAccessEvent(admin, announcement.eventId))) {
    return { error: "找不到這則公告", status: 404 as const };
  }
  return { announcement };
}

/**
 * 修改公告內容。總管理員與該場的主持人都可以。
 *
 * **已讀紀錄會一併清除。** 這是刻意的：
 * 公告會被改，多半是因為原本那則寫錯了（時間、地點、樓層）。而看過舊版
 * 的人正是最需要看到更正的那一群——保留已讀等於讓更正對他們隱形，
 * 他們會照著錯的資訊行動。
 *
 * 代價是改錯字也會讓所有人重看一次。兩者相比，多跳一次通知的困擾
 * 遠小於一群人跑錯地方。
 */
export async function PATCH(
  req: Request,
  ctx: RouteContext<"/api/admin/announcements/[id]">,
) {
  const { id } = await ctx.params;
  const found = await requireAnnouncement(id);
  if ("error" in found) {
    return NextResponse.json({ error: found.error }, { status: found.status });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  // 內容沒變就不要清掉已讀——按下儲存卻沒改字，不該驚動所有人。
  if (parsed.data.body === found.announcement.body) {
    return NextResponse.json({ id, body: found.announcement.body });
  }

  const [updated] = await prisma.$transaction([
    prisma.announcement.update({
      where: { id },
      data: { body: parsed.data.body },
      select: { id: true, body: true, createdAt: true },
    }),
    prisma.announcementRead.deleteMany({ where: { announcementId: id } }),
  ]);

  return NextResponse.json(updated);
}

/**
 * 刪除公告。
 *
 * 與活動的刪除不同，這裡不設「有人讀過就不能刪」的限制：公告是臨時
 * 的通知，發錯一則就該能收回，而它不是任何其他資料的根——cascade
 * 只會帶走它自己的已讀紀錄。
 */
export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/admin/announcements/[id]">,
) {
  const { id } = await ctx.params;
  const found = await requireAnnouncement(id);
  if ("error" in found) {
    return NextResponse.json({ error: found.error }, { status: found.status });
  }

  await prisma.announcement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
