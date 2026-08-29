import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  canAccessEvent,
  getCurrentAdmin,
  setActiveEvent,
} from "@/lib/admin-session";

const patchSchema = z.object({
  /** 切換到這場活動。主持人也能用，但仍受指派關係限制。 */
  makeActive: z.boolean().optional(),
  /** 指派主持人。僅總管理員。傳入的清單會整批取代原有的指派。 */
  hostIds: z.array(z.string()).optional(),
});

/**
 * 切換操作中的活動，以及指派主持人。
 *
 * 切換與指派放在同一支的理由：兩者都是「這個人與這場活動的關係」，
 * 而且都必須先過同一道權限檢查。
 */
export async function PATCH(
  req: Request,
  ctx: RouteContext<"/api/admin/events/[id]">,
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "輸入內容有誤" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!event) {
    return NextResponse.json({ error: "找不到這場活動" }, { status: 404 });
  }

  if (parsed.data.hostIds) {
    if (admin.role !== "SUPER") {
      return NextResponse.json(
        { error: "只有總管理員可以指派主持人" },
        { status: 403 },
      );
    }
    /*
      整批取代而非逐筆增刪：指派關係只有兩三筆，重建一次的成本可以忽略，
      而部分更新要處理「原本有、現在沒有」的差集，容易漏掉取消的那一半。
    */
    await prisma.$transaction([
      prisma.adminEvent.deleteMany({ where: { eventId: id } }),
      prisma.adminEvent.createMany({
        data: parsed.data.hostIds.map((adminId) => ({ adminId, eventId: id })),
        skipDuplicates: true,
      }),
    ]);
  }

  if (parsed.data.makeActive) {
    // 指派可能剛剛才被取消，所以這裡仍要問過一次權限。
    if (!(await canAccessEvent(admin, id))) {
      return NextResponse.json(
        { error: "你沒有這場活動的權限" },
        { status: 403 },
      );
    }
    await setActiveEvent(admin, id);
  }

  return NextResponse.json({ ok: true, name: event.name });
}
