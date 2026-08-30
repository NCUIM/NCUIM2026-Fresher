import { cache } from "react";
import type { AchievementDef, Participant } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * 成就引擎。
 *
 * ⚠️ ADR-0002：達成狀態必須持久化，重算只新增、永不移除。
 * 這裡刻意不把「是否達成」寫成對當前資料的純函數——門檻會被調整、
 * 隊伍人數會隨報到增加，任何一項都會讓已達標的人變成未達標。
 */

/** 某個成就對某人而言的「目前值」與「有效門檻」。 */
type Measurement = { current: number; target: number };

/**
 * TEAM_COLLECT 的 threshold 為 -1 時代表「全部隊員」，
 * 有效門檻是達成當下的同組人數（不含自己）。
 */
async function measure(
  def: AchievementDef,
  me: Participant,
): Promise<Measurement | null> {
  switch (def.type) {
    case "SCAN_COUNT": {
      const current = await prisma.scan.count({ where: { scannerId: me.id } });
      return { current, target: def.threshold };
    }

    case "COLLECTED_COUNT": {
      const current = await prisma.scan.count({ where: { scannedId: me.id } });
      return { current, target: def.threshold };
    }

    case "SCAN_ROLE": {
      if (!def.targetRole) return null;
      const current = await prisma.scan.count({
        where: { scannerId: me.id, scanned: { role: def.targetRole } },
      });
      return { current, target: def.threshold };
    }

    case "TEAM_COLLECT": {
      if (!me.teamId) return null; // 未分組者無法達成組別成就
      const current = await prisma.collection.count({
        where: { ownerId: me.id, subject: { teamId: me.teamId } },
      });

      if (def.threshold !== -1) return { current, target: def.threshold };

      const teammates = await prisma.participant.count({
        where: { teamId: me.teamId, role: "PARTICIPANT", id: { not: me.id } },
      });
      // 隊上只有自己時目標為 0，會被誤判為立即達成，因此視為尚不可達成。
      return teammates === 0 ? null : { current, target: teammates };
    }

    case "EARLY_SCAN": {
      const event = await prisma.event.findUnique({
        where: { id: me.eventId },
        select: { startsAt: true },
      });
      if (!event) return null;

      const firstScan = await prisma.scan.findFirst({
        where: { scannerId: me.id },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      if (!firstScan) return { current: 0, target: 1 };

      // threshold 的單位是分鐘，不是次數：在時限內完成第一次掃描就算達成。
      const deadline = new Date(
        event.startsAt.getTime() + def.threshold * 60_000,
      );
      return { current: firstScan.createdAt <= deadline ? 1 : 0, target: 1 };
    }
  }
}

/**
 * 依當前狀態發放尚未取得的成就。只新增，不移除（ADR-0002）。
 * 可安全重複呼叫——唯一鍵讓重複發放成為 no-op。
 */
export async function evaluateAchievements(participantId: string): Promise<void> {
  const me = await prisma.participant.findUnique({ where: { id: participantId } });
  if (!me) return;

  const [defs, earned] = await Promise.all([
    prisma.achievementDef.findMany({ where: { eventId: me.eventId } }),
    prisma.achievementEarned.findMany({
      where: { participantId },
      select: { achievementDefId: true },
    }),
  ]);
  const earnedIds = new Set(earned.map((e) => e.achievementDefId));

  /*
    先平行量完所有進度，再循序處理發放。

    每個 measure 是獨立的一到兩個查詢，寫成迴圈裡 await 就變成七趟往返
    疊加——而這個函式每次讀 /api/me、每次掃描完都會跑一遍。

    發放本身仍然逐一進行：那是寫入，而且併發時要靠唯一鍵擋重複，
    平行化省不到什麼、又讓錯誤處理變複雜。
  */
  const pending = defs.filter((def) => !earnedIds.has(def.id));
  const measurements = await Promise.all(
    pending.map(async (def) => [def, await measure(def, me)] as const),
  );

  for (const [def, m] of measurements) {
    if (!m || m.current < m.target) continue;

    await prisma.achievementEarned
      .create({
        data: {
          participantId,
          achievementDefId: def.id,
          // 凍結達成當下的分值與門檻：日後定義變更不影響已達成者。
          pointsAwarded: def.points,
          snapshotThreshold: m.target,
        },
      })
      // 併發評估可能同時嘗試發放同一個成就，唯一鍵衝突視為已完成。
      .catch(() => undefined);
  }
}

export type AchievementStatus =
  | {
      key: string;
      earned: true;
      title: string;
      description: string | null;
      points: number;
      hidden: boolean;
    }
  | {
      key: string;
      earned: false;
      hidden: true;
    }
  | {
      key: string;
      earned: false;
      hidden: false;
      title: string;
      description: string | null;
      points: number;
      progress: Measurement;
    };

/**
 * 供顯示用的成就狀態。
 *
 * 隱藏成就在達成前**不得透露名稱、條件與進度**——只回傳 key 與 hidden 旗標，
 * 讓前端顯示為「隱藏成就」。這是在伺服器端就把資訊剪掉，而不是靠前端不去畫。
 */
export const getAchievementStatus = cache(async (
  participantId: string,
): Promise<AchievementStatus[]> => {
  const me = await prisma.participant.findUnique({ where: { id: participantId } });
  if (!me) return [];

  const [defs, earnedRows] = await Promise.all([
    prisma.achievementDef.findMany({
      where: { eventId: me.eventId },
      orderBy: { points: "asc" },
    }),
    prisma.achievementEarned.findMany({ where: { participantId } }),
  ]);
  const earnedByDef = new Map(earnedRows.map((r) => [r.achievementDefId, r]));

  /*
    同樣先平行量完。已達成與隱藏的不必量——前者顯示的是達成當下凍結的
    分值，後者根本不揭露進度——先濾掉，省下的是真正不需要的查詢。
  */
  const measured = new Map(
    await Promise.all(
      defs
        .filter((def) => !earnedByDef.has(def.id) && !def.hidden)
        .map(async (def) => [def.id, await measure(def, me)] as const),
    ),
  );

  const out: AchievementStatus[] = [];
  for (const def of defs) {
    const earned = earnedByDef.get(def.id);

    if (earned) {
      out.push({
        key: def.key,
        earned: true,
        title: def.title,
        description: def.description,
        // 顯示達成當下的分值，與計分一致。
        points: earned.pointsAwarded,
        hidden: def.hidden,
      });
      continue;
    }

    if (def.hidden) {
      out.push({ key: def.key, earned: false, hidden: true });
      continue;
    }

    const m = measured.get(def.id) ?? null;
    out.push({
      key: def.key,
      earned: false,
      hidden: false,
      title: def.title,
      description: def.description,
      points: def.points,
      progress: m ?? { current: 0, target: def.threshold },
    });
  }
  return out;
});
