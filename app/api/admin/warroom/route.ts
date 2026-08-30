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

  const requested = new URL(req.url).searchParams.get("eventId");
  const event = requested
    ? await requireEventAccess(admin, requested)
    : await resolveAdminEvent(admin);

  // 沒有指定就用預設場次；指定了卻拿不到，代表不存在或無權存取——
  // 兩者都回 404，才不會讓人用 id 探測哪些活動存在。
  if (!event) {
    return NextResponse.json({ error: "找不到活動" }, { status: 404 });
  }

  const [
    participants,
    scans,
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

      連線要全部（那就是整張網），但只需要三個 id 欄位；事件牆只要最新
      四十筆，卻要 join 兩邊的暱稱。合成一個查詢的話，等於替全場每一次
      相遇都 join 兩次暱稱，而其中九成的結果會被 slice 丟掉——七十人的
      活動跑一整天，這是唯一會隨時間持續變重的查詢。
    */
      prisma.scan.findMany({
        where: { eventId: event.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, scannerId: true, scannedId: true, createdAt: true },
      }),
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
      統計卡用的三個數字。畫面可以自己數 nodes 與 edges 的長度算出前兩個，
      但成就總數不行——事件牆只帶最新四十筆，用它的長度會在解鎖超過
      四十次之後永遠停在 40。
    */
    stats: {
      participants: participants.length,
      encounters: scans.length,
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
