import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/lib/session";
import { computeScore, pendingImpressions } from "@/lib/score";

/** 目前登入者的身分、分數與待辦。 */
export async function GET() {
  const me = await getCurrentParticipant();
  if (!me) {
    return NextResponse.json({ error: "請先完成報到" }, { status: 401 });
  }

  const [score, pending] = await Promise.all([
    computeScore(me.id),
    pendingImpressions(me.id),
  ]);

  return NextResponse.json({
    id: me.id,
    nickname: me.nickname,
    role: me.role,
    personalCode: me.personalCode,
    team: me.team ? { number: me.team.number, name: me.team.name } : null,
    score,
    pendingImpressions: pending,
  });
}
