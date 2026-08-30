import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentAdmin,
  requireEventAccess,
  resolveAdminEvent,
} from "@/lib/admin-session";
import { rankAll } from "@/lib/leaderboard";

/** 事件牆一次最多帶回幾筆。夠填滿畫面，又不會讓每次輪詢變重。 */
const FEED_LIMIT = 40;

/**
 * 戰情室的即時快照：節點、連線、最新事件、排名。
 *
 * **用輪詢而不是 SSE 或 WebSocket。** 這是刻意的取捨：
 * 七十人的活動、一次幾百筆連線，整包 JSON 只有幾十 KB，每兩三秒重取
 * 一次的成本可以忽略；而長連線在 Cloud Run 這類環境會遇到閒置逾時、
 * 重連與擴縮容時的斷線，為了一場幾小時的活動去處理那些，代價遠高於收益。
 *
 * 每次回傳完整快照而不是增量：增量要維護游標與去重，任何一個環節出錯
 * 都會讓畫面停在錯誤的狀態，而現場沒有人有空 debug。整包重畫永遠自洽。
 */
export async function GET(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const requested = params.get("eventId");
  const event = requested
    ? await requireEventAccess(admin, requested)
    : await resolveAdminEvent(admin);

  // 沒有指定就用預設場次；指定了卻拿不到，代表不存在或無權存取——
  // 兩者都回 404，才不會讓人用 id 探測哪些活動存在。
  if (!event) {
    return NextResponse.json({ error: "找不到活動" }, { status: 404 });
  }

  /*
    帶了 since 就只回傳那之後的新相遇。

    連線是這包快照裡最大的一塊：滿載時一千多組相遇、每組約 150 位元組，
    佔掉整包的九成。而它每 2.5 秒重傳一次，四小時就是將近 1 GB——對計量
    傳輸量的託管資料庫（Neon、Supabase）來說，這一項就足以吃掉整個額度。

    增量之所以安全，是因為 **Scan 只增不刪**：沒有更新、沒有刪除，
    `(eventId, pairKey)` 唯一鍵也保證同一對人只會有一筆。客戶端把收到的
    累積起來就是完整的那張網，不需要維護游標或處理重排。

    節點、排名與事件牆仍然每次都給完整的——它們都只有幾十列，而且分數
    與名次隨時在變，增量反而要處理「哪些變了」，得不償失。
  */
  const sinceParam = params.get("since");
  const sinceDate = sinceParam ? new Date(sinceParam) : null;
  const since =
    sinceDate && !Number.isNaN(sinceDate.getTime()) ? sinceDate : null;

  /*
    回頭多抓五秒。

    交易的提交時間會晚於 createdAt 的取值時間，剛好落在邊界上的那一筆
    可能在上一次查詢時還看不到、下一次又因為時間戳比 since 早而被濾掉。
    重疊視窗讓它一定會被抓到，重複的部分由客戶端依 id 去重。
  */
  const OVERLAP_MS = 5000;
  const edgeWhere = since
    ? {
        eventId: event.id,
        createdAt: { gte: new Date(since.getTime() - OVERLAP_MS) },
      }
    : { eventId: event.id };

  // 客戶端下一次要送回來的時間戳。用伺服器的時鐘，不然兩邊時差會漏事件。
  const now = new Date();

  const [
    participants,
    scans,
    encounterTotal,
    recentScans,
    achievements,
    achievementTotal,
    achievementMax,
    ranking,
  ] = await Promise.all([
      prisma.participant.findMany({
        where: { eventId: event.id },
        orderBy: { createdAt: "asc" },
        // 只取畫面真的會用到的欄位——這個查詢每 2.5 秒跑一次。
        select: { id: true, nickname: true, role: true, cardColor: true },
      }),
      /*
      連線與事件牆分成兩個查詢。

      連線只需要三個 id 欄位；事件牆只要最新四十筆，卻要 join 兩邊的暱稱。
      合成一個查詢的話，等於替全場每一次相遇都 join 兩次暱稱，而其中九成
      的結果會被 slice 丟掉。
    */
      prisma.scan.findMany({
        where: edgeWhere,
        orderBy: { createdAt: "desc" },
        select: { id: true, scannerId: true, scannedId: true, createdAt: true },
      }),
      /*
      相遇總數要另外數。

      走增量時 scans 只有新的那幾筆，長度不再等於全場的相遇組數——
      統計卡若沿用它，數字會在每次輪詢跳成個位數。
    */
      prisma.scan.count({ where: { eventId: event.id } }),
      prisma.scan.findMany({
        where: { eventId: event.id },
        orderBy: { createdAt: "desc" },
        take: FEED_LIMIT,
        select: {
          id: true,
          createdAt: true,
          scannerId: true,
          scannedId: true,
          scanner: { select: { nickname: true } },
          scanned: { select: { nickname: true } },
        },
      }),
      prisma.achievementEarned.findMany({
        where: { participant: { eventId: event.id } },
        orderBy: { earnedAt: "desc" },
        take: FEED_LIMIT,
        select: {
          id: true,
          participantId: true,
          pointsAwarded: true,
          earnedAt: true,
          participant: { select: { nickname: true } },
          achievementDef: { select: { title: true, hidden: true } },
        },
      }),
      // 事件牆只帶最新四十筆，但統計卡要的是全場總數。
      prisma.achievementEarned.count({
        where: { participant: { eventId: event.id } },
      }),
      /*
        這場活動裡最高的成就分值。

        星圖用它決定解鎖特效的等級。門檻不能寫死——分值是主辦方逐場
        自訂的，這一場的範圍是三十到兩百，換一場可能是五到二十。
        以該場自己的最高分為基準，等級在任何一場都分得出輕重。
      */
      prisma.achievementDef.aggregate({
        where: { eventId: event.id },
        _max: { points: true },
      }),
      rankAll(event.id),
    ]);

  const scoreById = new Map(ranking.map((r) => [r.participantId, r.score]));

  return NextResponse.json({
    /*
      客戶端下一次輪詢要送回來的時間戳，以及這一包是不是增量。

      用伺服器的時鐘而不是讓客戶端自己取——投影用的那台電腦時間可能
      差好幾分鐘，用它的時鐘當游標會整段漏掉或整段重傳。
    */
    now: now.toISOString(),
    incremental: since !== null,
    /*
      統計卡用的三個數字，全部由資料庫直接數。

      不能用回傳陣列的長度：走增量時 edges 只有新的那幾筆，
      而事件牆的成就只帶最新四十筆——兩者都不等於全場總數。
    */
    stats: {
      participants: participants.length,
      encounters: encounterTotal,
      achievements: achievementTotal,
      maxAchievementPoints: achievementMax._max.points ?? 0,
    },
    nodes: participants.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      role: p.role,
      cardColor: p.cardColor,
      score: scoreById.get(p.id) ?? 0,
    })),
    /*
      一條連線代表一次相遇。畫在圖上是對稱的——一次 Scan 會替雙方各建立
      一筆 Collection，持有關係本來就對稱；但欄位仍照實記錄誰是發起方，
      因為 Scan 的歸屬是衡量主動程度的唯一依據（見 CONTEXT.md）。
      Scan 的 (eventId, pairKey) 唯一鍵保證同一對人只會有一條線。
    */
    edges: scans.map((s) => ({
      id: s.id,
      scannerId: s.scannerId,
      scannedId: s.scannedId,
      at: s.createdAt,
    })),
    /*
      事件牆混合兩種來源，依時間排序後截斷。
      隱藏成就只回傳「解鎖了一個隱藏成就」，不揭露名稱——投影在大螢幕上
      等於公開，而隱藏成就的重點就是別人還沒解到時不知道那是什麼。
    */
    feed: [
      ...recentScans.map((s) => ({
        id: `scan-${s.id}`,
        kind: "scan" as const,
        at: s.createdAt,
        // 帶 id 而不只是暱稱：星圖要把漣漪打在正確的節點上，
        // 而暱稱不是唯一的——兩個「小明」會讓漣漪亮錯人。
        actorId: s.scannerId,
        targetId: s.scannedId as string | null,
        actor: s.scanner.nickname,
        target: s.scanned.nickname,
        label: null as string | null,
        points: 0,
      })),
      ...achievements.map((a) => ({
        id: `ach-${a.id}`,
        kind: "achievement" as const,
        at: a.earnedAt,
        actorId: a.participantId,
        targetId: null as string | null,
        actor: a.participant.nickname,
        target: null as string | null,
        label: a.achievementDef.hidden ? "隱藏成就" : a.achievementDef.title,
        points: a.pointsAwarded,
      })),
    ]
      .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
      .slice(0, FEED_LIMIT),
    ranking,
  });
}
