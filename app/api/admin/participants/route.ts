import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentAdmin,
  requireEventAccess,
  resolveAdminEvent,
} from "@/lib/admin-session";

/**
 * 參與者清單。
 *
 * 刻意不回傳 sessionToken——後台畫面不需要它，而一旦出現在回應中，
 * 它就會留在瀏覽器快取與任何側錄的流量裡。協助找回身分改由專用的
 * rescue 端點處理。
 */
export async function GET(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  /*
    必須限定在單一活動。原本沒有任何 where 條件——單活動時看不出問題，
    但一旦有第二場，主持人就會在清單上看到別人場次的姓名與信箱。
  */
  const requested = new URL(req.url).searchParams.get("eventId");
  const event = requested
    ? await requireEventAccess(admin, requested)
    : await resolveAdminEvent(admin);

  if (requested && !event) {
    return NextResponse.json({ error: "找不到這場活動" }, { status: 404 });
  }
  if (!event) {
    return NextResponse.json({ participants: [] });
  }

  const participants = await prisma.participant.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nickname: true,
      // 這是全站唯一會回傳真實姓名的端點，而它擋在管理員驗證之後。
      realName: true,
      personalCode: true,
      role: true,
      avatarUrl: true,
      bio: true,
      socialUrl: true,
      icons: true,
      zodiac: true,
      university: true,
      email: true,
      emailVerified: true,
      createdAt: true,
      team: { select: { number: true, name: true } },
      _count: {
        select: {
          scansInitiated: true,
          scansReceived: true,
          collections: true,
          impressionsWritten: true,
          impressionsReceived: true,
          achievements: true,
        },
      },
    },
  });

  return NextResponse.json({ participants });
}
