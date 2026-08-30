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
 * 必須在交易內呼叫，而且交易本身不夠——見下方的 advisory lock。
 */
export async function pickTeamIdForNewParticipant(
  tx: Prisma.TransactionClient,
  eventId: string,
  role: Role,
): Promise<string | null> {
  if (role === "STAFF") return null;

  /*
    先取得這場活動的 advisory lock，把「挑隊伍」這一段序列化。

    只把它放進交易裡是不夠的：PostgreSQL 預設的隔離等級是 READ COMMITTED，
    兩個併發的報到會各自讀到同一份人數、各自挑中同一組。實測七十人同時
    報到，分組跑成 5,5,5,5,6,8,9,9,9,9——而循序報到是完美的十組各七人。

    後果不只是不好看：「集齊全隊」這類成就的難度會因為隊伍人數不同而
    失衡，九人隊要收集的人比五人隊多了近一倍。

    用 advisory lock 而不是 SERIALIZABLE：後者遇到衝突會拋錯，要在報到
    這條路上加重試邏輯；advisory lock 是等待而非失敗，而且 xact 版本會在
    交易結束時自動釋放，不會有忘記解鎖的路徑。鎖的粒度是「單一活動」，
    不同場次不會互相阻塞。
  */
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${eventId})::bigint)`;

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
