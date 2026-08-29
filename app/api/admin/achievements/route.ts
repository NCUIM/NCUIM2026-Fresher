import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentAdmin,
  requireEventAccess,
  resolveAdminEvent,
} from "@/lib/admin-session";
import { achievementSchema, firstErrorMessage } from "@/lib/validation";

/**
 * 成就清單，附上已達成人數。
 *
 * 人數不只是統計：它決定這條成就還能不能刪（見 DELETE），
 * 也讓調門檻的人看得出自己正在動的是不是已經有人拿到的東西。
 */
export async function GET(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  const requested = new URL(req.url).searchParams.get("eventId");
  const event = requested
    ? await requireEventAccess(admin, requested)
    : await resolveAdminEvent(admin);
  if (!event) {
    return NextResponse.json({ error: "找不到活動" }, { status: 404 });
  }
  const eventId = event.id;

  const achievements = await prisma.achievementDef.findMany({
    where: { eventId },
    orderBy: [{ type: "asc" }, { threshold: "asc" }],
    select: {
      id: true,
      key: true,
      type: true,
      threshold: true,
      points: true,
      hidden: true,
      title: true,
      description: true,
      targetRole: true,
      _count: { select: { earned: true } },
    },
  });

  // 門檻設得比人數還高的成就永遠沒人拿得到，畫面要能提醒。
  const participantCount = await prisma.participant.count({ where: { eventId } });

  return NextResponse.json({ achievements, participantCount });
}

/** 新增成就。 */
export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

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

  // eventId 由呼叫端提供時必須驗證歸屬，否則主持人能對別場新增成就。
  const requested =
    typeof (body as { eventId?: unknown })?.eventId === "string"
      ? (body as { eventId: string }).eventId
      : null;
  const event = requested
    ? await requireEventAccess(admin, requested)
    : await resolveAdminEvent(admin);
  if (!event) {
    return NextResponse.json({ error: "找不到活動" }, { status: 404 });
  }
  const eventId = event.id;

  const { key, type, threshold, points, hidden, title, description, targetRole } =
    parsed.data;

  const duplicate = await prisma.achievementDef.findUnique({
    where: { eventId_key: { eventId, key } },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "這個代號已經被用過了" },
      { status: 409 },
    );
  }

  const created = await prisma.achievementDef.create({
    data: {
      eventId,
      key,
      type,
      threshold,
      points,
      hidden,
      title,
      description: description || null,
      // targetRole 只對 SCAN_ROLE 有意義，其他類型一律清掉，
      // 免得日後改型別時留下一個看不出來、卻仍被讀取的殘值。
      targetRole: type === "SCAN_ROLE" ? (targetRole ?? null) : null,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
