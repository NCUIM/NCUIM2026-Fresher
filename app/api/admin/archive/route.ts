import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-session";

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

  const event = eventId
    ? await prisma.event.findUnique({ where: { id: eventId } })
    : await prisma.event.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });

  if (!event) {
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
