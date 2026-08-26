import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/lib/session";
import { computeScore, pendingImpressions } from "@/lib/score";
import { evaluateAchievements, getAchievementStatus } from "@/lib/achievements";

/** 目前登入者的身分、分數與待辦。 */
export async function GET() {
  const me = await getCurrentParticipant();
  if (!me) {
    return NextResponse.json({ error: "請先完成報到" }, { status: 401 });
  }

  // 讀取前先評估一次。發放是冪等的，這讓顯示永遠與當前狀態一致，
  // 即使某次觸發點被漏掉也不會讓人少拿成就。
  await evaluateAchievements(me.id);

  const [score, pending, achievements] = await Promise.all([
    computeScore(me.id),
    pendingImpressions(me.id),
    getAchievementStatus(me.id),
  ]);

  return NextResponse.json({
    id: me.id,
    nickname: me.nickname,
    role: me.role,
    personalCode: me.personalCode,
    team: me.team ? { number: me.team.number, name: me.team.name } : null,
    score,
    pendingImpressions: pending,
    achievements,
  });
}
