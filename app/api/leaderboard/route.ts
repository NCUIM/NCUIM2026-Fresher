import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/lib/session";
import { getLeaderboard } from "@/lib/leaderboard";

export async function GET() {
  const me = await getCurrentParticipant();
  if (!me) {
    return NextResponse.json({ error: "請先完成報到" }, { status: 401 });
  }

  const board = await getLeaderboard(me.eventId, me.id);
  return NextResponse.json(board);
}
