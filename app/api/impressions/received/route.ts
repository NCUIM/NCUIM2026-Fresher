import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/lib/session";
import { getReceivedImpressions } from "@/lib/wall";

/**
 * 我收到的 Impression。
 *
 * 沒有「查看某人的牆」這種端點——對象永遠是呼叫者本人（ADR-0003）。
 */
export async function GET() {
  const me = await getCurrentParticipant();
  if (!me) {
    return NextResponse.json({ error: "請先完成報到" }, { status: 401 });
  }

  const impressions = await getReceivedImpressions(me.id);
  return NextResponse.json({ impressions });
}
