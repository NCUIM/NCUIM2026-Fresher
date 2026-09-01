import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  canAccessEvent,
  getCurrentAdmin,
  resolveAdminEvent,
} from "@/lib/admin-session";
import { firstErrorMessage } from "@/lib/validation";

const announcementSchema = z.object({
  body: z.string().trim().min(1, "公告內容不可為空").max(500),
  eventId: z.string().optional(),
});

/**
 * 列出這場活動的公告，新的在前。
 *
 * 後台先前只能發、不能看已發過什麼——要修正一則錯誤的公告，得先知道
 * 它長什麼樣。順便回傳已讀人數，讓人在按下修改前知道影響範圍。
 */
export async function GET(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  const requested = new URL(req.url).searchParams.get("eventId");
  const event = requested
    ? await prisma.event.findUnique({ where: { id: requested } })
    : await resolveAdminEvent(admin);

  if (!event || !(await canAccessEvent(admin, event.id))) {
    return NextResponse.json({ error: "找不到活動" }, { status: 404 });
  }

  const announcements = await prisma.announcement.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      _count: { select: { reads: true } },
    },
  });

  return NextResponse.json(
    announcements.map((a) => ({
      id: a.id,
      body: a.body,
      createdAt: a.createdAt,
      reads: a._count.reads,
    })),
  );
}

/** 發布公告。僅限管理員——參與者的 session 在此不具任何效力。 */
export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const parsed = announcementSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  /*
    未指定 eventId 時發布到自己正在操作的那一場。

    有指定時**必須驗證歸屬**：eventId 來自請求主體，是呼叫端說了算的東西。
    沒有這道檢查，任何主持人都能對別人的場次發公告，而公告會直接推到
    那場所有參與者的畫面上。
  */
  const event = parsed.data.eventId
    ? await prisma.event.findUnique({ where: { id: parsed.data.eventId } })
    : await resolveAdminEvent(admin);

  if (!event || !(await canAccessEvent(admin, event.id))) {
    return NextResponse.json({ error: "找不到進行中的活動" }, { status: 404 });
  }

  const announcement = await prisma.announcement.create({
    data: { eventId: event.id, body: parsed.data.body },
  });

  return NextResponse.json(
    {
      id: announcement.id,
      body: announcement.body,
      createdAt: announcement.createdAt,
    },
    { status: 201 },
  );
}
