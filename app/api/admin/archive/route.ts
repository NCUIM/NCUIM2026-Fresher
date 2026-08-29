import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  canAccessEvent,
  getCurrentAdmin,
  resolveAdminEvent,
} from "@/lib/admin-session";

/** 封存後保留供查看的天數。期滿刪除該場活動的所有個人資料。 */
export const RETENTION_DAYS = 14;

const archiveSchema = z.object({ eventId: z.string().optional() });

/**
 * 封存活動：關閉報到與收集，但保留查看功能。
 *
 * 第一階段由 Admin 手動執行，刪除也是手動的——purgeAfter 只作為顯示給
 * 使用者的日期依據，沒有排程任務會自動清除。
 */
export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    // 空 body 是允許的：不指定就封存目前進行中的活動。
  }
  const parsed = archiveSchema.safeParse(raw ?? {});
  const eventId = parsed.success ? parsed.data.eventId : undefined;

  // eventId 由呼叫端提供，必須驗證歸屬——否則主持人能封存別人的場次，
  // 那會當場關掉另一場活動的報到與收集。
  const event = eventId
    ? await prisma.event.findUnique({ where: { id: eventId } })
    : await resolveAdminEvent(admin);

  if (!event || !(await canAccessEvent(admin, event.id))) {
    return NextResponse.json({ error: "找不到進行中的活動" }, { status: 404 });
  }

  const archivedAt = new Date();
  const purgeAfter = new Date(
    archivedAt.getTime() + RETENTION_DAYS * 86_400_000,
  );

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { status: "ARCHIVED", archivedAt, purgeAfter },
    select: { id: true, name: true, status: true, archivedAt: true, purgeAfter: true },
  });

  return NextResponse.json(updated);
}

/**
 * 解除封存，重新開放報到與收集。
 *
 * 誤觸的代價和復原的代價原本完全不對等：封存是一鍵，復原卻要有人在活動
 * 現場打開終端機改資料庫。而封存本來就不刪任何東西（見 CONTEXT.md），
 * 沒有技術上不可逆的理由，所以這裡提供對稱的另一半。
 *
 * archivedAt 與 purgeAfter 一併清空：留著會讓「保留至某日」的顯示
 * 指向一個已經不成立的日期，而真正的刪除期限應該從最後一次封存起算。
 */
export async function DELETE(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    // 空 body 是允許的：不指定就重新開放最近封存的那一場。
  }
  const parsed = archiveSchema.safeParse(raw ?? {});
  const eventId = parsed.success ? parsed.data.eventId : undefined;

  const event = eventId
    ? await prisma.event.findUnique({ where: { id: eventId } })
    : ((await resolveAdminEvent(admin)) ??
      (await prisma.event.findFirst({
        where: { status: "ARCHIVED" },
        orderBy: { archivedAt: "desc" },
      })));

  if (!event || !(await canAccessEvent(admin, event.id))) {
    return NextResponse.json({ error: "找不到已封存的活動" }, { status: 404 });
  }
  if (event.status !== "ARCHIVED") {
    return NextResponse.json({ error: "找不到已封存的活動" }, { status: 404 });
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { status: "ACTIVE", archivedAt: null, purgeAfter: null },
    select: { id: true, name: true, status: true },
  });

  return NextResponse.json(updated);
}
