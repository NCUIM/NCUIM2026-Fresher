import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessEvent, getCurrentAdmin } from "@/lib/admin-session";
import { achievementSchema, firstErrorMessage } from "@/lib/validation";

/**
 * 修改成就。
 *
 * 已達成的人不受影響：AchievementEarned 在達成當下就凍結了 pointsAwarded
 * 與 snapshotThreshold（ADR-0002）。所以調高分數不會回頭補給早就拿到的人，
 * 調高門檻也不會把已經到手的成就收回去——這是刻意的，成就一旦公告就是承諾。
 */
export async function PATCH(
  req: Request,
  ctx: RouteContext<"/api/admin/achievements/[id]">,
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const parsed = achievementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const existing = await prisma.achievementDef.findUnique({
    where: { id },
    select: { id: true, eventId: true },
  });
  /*
    找不到與無權操作回同一個 404。
    分開回應等於讓主持人能用 id 探出別場活動有哪些成就存在。
  */
  if (!existing || !(await canAccessEvent(admin, existing.eventId))) {
    return NextResponse.json({ error: "找不到這個成就" }, { status: 404 });
  }

  const { key, type, threshold, points, hidden, title, description, targetRole } =
    parsed.data;

  const clash = await prisma.achievementDef.findUnique({
    where: { eventId_key: { eventId: existing.eventId, key } },
    select: { id: true },
  });
  if (clash && clash.id !== id) {
    return NextResponse.json({ error: "這個代號已經被用過了" }, { status: 409 });
  }

  const updated = await prisma.achievementDef.update({
    where: { id },
    data: {
      key,
      type,
      threshold,
      points,
      hidden,
      title,
      description: description || null,
      targetRole: type === "SCAN_ROLE" ? (targetRole ?? null) : null,
    },
  });

  return NextResponse.json(updated);
}

/**
 * 刪除成就。**已經有人達成的一律拒絕。**
 *
 * AchievementEarned 對 AchievementDef 是 onDelete: Cascade，刪掉定義
 * 會連帶抹掉所有人的達成紀錄，分數跟著往下掉——那正是 ADR-0002
 * 「達成狀態必須持久化，永不刪除」要防的事。
 *
 * 想讓一條成就退場又不動到已達成的人，正確做法是把它改成隱藏，
 * 或把門檻調到不會再有人觸發，而不是刪除。
 */
export async function DELETE(
  req: Request,
  ctx: RouteContext<"/api/admin/achievements/[id]">,
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const existing = await prisma.achievementDef.findUnique({
    where: { id },
    select: {
      id: true,
      eventId: true,
      title: true,
      _count: { select: { earned: true } },
    },
  });
  if (!existing || !(await canAccessEvent(admin, existing.eventId))) {
    return NextResponse.json({ error: "找不到這個成就" }, { status: 404 });
  }

  if (existing._count.earned > 0) {
    return NextResponse.json(
      {
        error: `已經有 ${existing._count.earned} 人達成「${existing.title}」，刪除會一併收回他們的成就與分數。改設為隱藏即可讓它不再顯示。`,
        earnedCount: existing._count.earned,
      },
      { status: 409 },
    );
  }

  await prisma.achievementDef.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
