import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/lib/session";
import { markAllRead } from "@/lib/announcements";

/** 把目前活動的所有公告標記為已讀。 */
export async function POST() {
  const me = await getCurrentParticipant();
  if (!me) {
    return NextResponse.json({ error: "請先完成報到" }, { status: 401 });
  }

  await markAllRead(me.eventId, me.id);
  return NextResponse.json({ ok: true });
}
