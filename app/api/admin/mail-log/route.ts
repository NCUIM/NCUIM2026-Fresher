import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentAdmin,
  requireEventAccess,
  resolveAdminEvent,
} from "@/lib/admin-session";

/**
 * 寄信紀錄。
 *
 * 只回傳自己那一場的：收件信箱是個資，主持人不該看到別場的。
 * 沒有掛在任何參與者身上的紀錄（例如 npm run mail:test 寄的測試信）
 * 一律不回傳——那些不屬於任何一場活動。
 */
export async function GET(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  /*
    eventId 由呼叫端指定，因此必須驗證權限；沒指定才回退到預設的那一場。
    無權時回 404 而不是 403——可區分的話就能拿 id 探測別場活動是否存在。
  */
  const requested = new URL(req.url).searchParams.get("eventId");
  const event = requested
    ? await requireEventAccess(admin, requested)
    : await resolveAdminEvent(admin);

  if (requested && !event) {
    return NextResponse.json({ error: "找不到這場活動" }, { status: 404 });
  }
  if (!event) {
    return NextResponse.json({ logs: [], failed: 0, skipped: 0, sent: 0 });
  }

  const where = { participant: { eventId: event.id } };

  const [logs, sent, failed, skipped] = await Promise.all([
    prisma.mailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        to: true,
        subject: true,
        status: true,
        error: true,
        createdAt: true,
        participant: { select: { id: true, nickname: true } },
      },
    }),
    prisma.mailLog.count({ where: { ...where, status: "SENT" } }),
    prisma.mailLog.count({ where: { ...where, status: "FAILED" } }),
    prisma.mailLog.count({ where: { ...where, status: "SKIPPED" } }),
  ]);

  return NextResponse.json({ logs, sent, failed, skipped });
}
