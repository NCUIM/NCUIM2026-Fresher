import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/lib/session";
import { listAnnouncements } from "@/lib/announcements";

export async function GET() {
  const me = await getCurrentParticipant();
  if (!me) {
    return NextResponse.json({ error: "請先完成報到" }, { status: 401 });
  }

  return NextResponse.json(await listAnnouncements(me.eventId, me.id));
}
