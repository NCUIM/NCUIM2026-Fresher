import { prisma } from "./prisma";

export type ScoreBreakdown = {
  base: number;
  achievement: number;
  total: number;
};

/**
 * 計算一位 Participant 的分數。
 *
 * 基礎分**依 Collection 計算且雙方對等**——一次 Scan 為兩人各建立一筆
 * Collection，兩人都能各拿一份，但各自以自己撰寫的 Impression 為條件。
 * 發起掃描的一方不會因此多拿分（見 CONTEXT.md 的 Score 定義）。
 *
 * 實作上直接計算作者為本人的 Impression 數量：撰寫時已強制要求對象必須
 * 已收集，因此「我寫過的 Impression 數」恆等於「我已入帳的 Collection 數」。
 */
export async function computeScore(
  participantId: string,
): Promise<ScoreBreakdown> {
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: { event: { select: { basePoints: true } } },
  });
  if (!participant) return { base: 0, achievement: 0, total: 0 };

  const credited = await prisma.impression.count({
    where: { authorId: participantId },
  });

  const base = credited * participant.event.basePoints;
  const achievement = 0; // 成就引擎尚未實作

  return { base, achievement, total: base + achievement };
}

export type PendingImpression = {
  subjectId: string;
  nickname: string;
};

/**
 * 已收集但尚未撰寫 Impression 的對象。
 *
 * 這份清單同時是待辦提示與計分缺口的來源——每一筆都代表一份還沒入帳的
 * 基礎分，讓使用者看得到「回頭補寫就能拿到分數」。
 */
export async function pendingImpressions(
  participantId: string,
): Promise<PendingImpression[]> {
  const written = await prisma.impression.findMany({
    where: { authorId: participantId },
    select: { subjectId: true },
  });

  const collections = await prisma.collection.findMany({
    where: {
      ownerId: participantId,
      subjectId: { notIn: written.map((w) => w.subjectId) },
    },
    select: { subject: { select: { id: true, nickname: true } } },
    orderBy: { createdAt: "desc" },
  });

  return collections.map((c) => ({
    subjectId: c.subject.id,
    nickname: c.subject.nickname,
  }));
}
