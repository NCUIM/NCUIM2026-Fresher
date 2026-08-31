import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  canAccessEvent,
  getCurrentAdmin,
  setActiveEvent,
} from "@/lib/admin-session";

/**
 * 目前的報到人數。
 *
 * 只回一個數字，因為它的呼叫者是投影畫面——那一頁會整場開著、每幾秒問
 * 一次，而現場的網路要留給正在報到的人。回傳參與者清單會讓每次輪詢
 * 帶著上百筆資料在跑，只為了畫面上那一個數字。
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/admin/events/[id]">,
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!(await canAccessEvent(admin, id))) {
    // 與「不存在」回同一個狀態，避免用 id 探測有哪些活動存在。
    return NextResponse.json({ error: "找不到這場活動" }, { status: 404 });
  }

  const count = await prisma.participant.count({ where: { eventId: id } });
  return NextResponse.json({ participants: count });
}

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

/**
 * 刪除活動。**只允許刪除沒有參與者的。**
 *
 * Event 是整張圖的根，cascade 會一路帶走 Participant、Collection、
 * Impression、Team 與所有成就紀錄——這是全系統破壞力最大的一個動作。
 *
 * 有資料的活動要走既有的生命週期：封存 → 保留十四天 → npm run db:purge。
 * 那條路刻意是手動的（見 scripts/purge-expired.mts），就是為了不讓
 * 大量個資因為一次誤按而消失。purge 完之後參與者歸零，這裡就刪得掉了。
 *
 * 所以這個限制不是把功能做小，而是讓「清掉建錯的活動」與
 * 「銷毀一場真實活動的所有資料」不共用同一顆按鈕。
 */
export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/admin/events/[id]">,
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }
  if (admin.role !== "SUPER") {
    return NextResponse.json(
      { error: "只有總管理員可以刪除活動" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, name: true, _count: { select: { participants: true } } },
  });
  if (!event) {
    return NextResponse.json({ error: "找不到這場活動" }, { status: 404 });
  }

  if (event._count.participants > 0) {
    return NextResponse.json(
      {
        error: `「${event.name}」已經有 ${event._count.participants} 位參與者，不能直接刪除。請先封存，保留期滿後執行 npm run db:purge 清除個資，之後才能刪除這場活動。`,
        participantCount: event._count.participants,
      },
      { status: 409 },
    );
  }

  await prisma.event.delete({ where: { id } });

  return NextResponse.json({ ok: true, name: event.name });
}
