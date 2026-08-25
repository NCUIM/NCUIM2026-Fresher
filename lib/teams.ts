import type { Prisma, Role } from "@prisma/client";

/**
 * 報到時的輪流分配（第一階段唯一的分隊模式）。
 *
 * 實作為「指派到目前人數最少的隊伍」而非依報到序號取餘數，原因有二：
 * 一是同時報到時取餘數會競爭同一個號碼，二是這個規則同時滿足 Q40
 * 「遲到者自動補進人數最少的隊」，不需要另寫一套邏輯。
 *
 * STAFF 不分組。工作人員不計入 Leaderboard，也不是組別成就的目標——
 * 若把他們放進 Team，「集齊全隊」會變成必須收集到工作人員，且隊伍人數
 * 會被灌水。
 *
 * 必須在交易內呼叫，否則併發報到會讀到過期的人數。
 */
export async function pickTeamIdForNewParticipant(
  tx: Prisma.TransactionClient,
  eventId: string,
  role: Role,
): Promise<string | null> {
  if (role === "STAFF") return null;

  const teams = await tx.team.findMany({
    where: { eventId },
    select: {
      id: true,
      number: true,
      // 只計算一般參與者，避免舊資料或日後的例外把人數算歪。
      _count: { select: { members: { where: { role: "PARTICIPANT" } } } },
    },
    orderBy: { number: "asc" },
  });

  if (teams.length === 0) return null; // 本場不分組

  // 人數相同時取編號小的，讓分配順序穩定可預期。
  let chosen = teams[0];
  for (const team of teams) {
    if (team._count.members < chosen._count.members) chosen = team;
  }
  return chosen.id;
}
