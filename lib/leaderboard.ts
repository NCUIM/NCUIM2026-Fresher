import { prisma } from "./prisma";

export type LeaderboardEntry = {
  rank: number;
  participantId: string;
  nickname: string;
  score: number;
};

export type LeaderboardView = {
  top: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  totalRanked: number;
};

/**
 * 單一 Event 的個人排名。
 *
 * 工作人員被排除：他們是「會走動的收集目標」，全場都被鼓勵去掃他們，
 * 被收集數與基礎分會遠超一般參與者，若計入榜單前段會全是工作人員。
 *
 * 只回傳前 N 名與查詢者自己的名次，**不回傳完整排名**——公開完整榜單
 * 等於把最後一名昭告全場，而這是一場希望新生互相認識的活動。
 */
export async function getLeaderboard(
  eventId: string,
  viewerId: string,
): Promise<LeaderboardView> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { basePoints: true, leaderboardTopN: true },
  });
  if (!event) return { top: [], me: null, totalRanked: 0 };

  const participants = await prisma.participant.findMany({
    where: { eventId, role: "PARTICIPANT" },
    select: { id: true, nickname: true, createdAt: true },
  });

  // 一次撈完所有人的計分素材，避免逐人查詢。
  const [impressionCounts, achievementSums] = await Promise.all([
    prisma.impression.groupBy({
      by: ["authorId"],
      where: { eventId },
      _count: { _all: true },
    }),
    prisma.achievementEarned.groupBy({
      by: ["participantId"],
      where: { participant: { eventId } },
      _sum: { pointsAwarded: true },
    }),
  ]);

  const baseByAuthor = new Map(
    impressionCounts.map((r) => [r.authorId, r._count._all * event.basePoints]),
  );
  const achievementById = new Map(
    achievementSums.map((r) => [r.participantId, r._sum.pointsAwarded ?? 0]),
  );

  const scored = participants
    .map((p) => ({
      participantId: p.id,
      nickname: p.nickname,
      createdAt: p.createdAt,
      score: (baseByAuthor.get(p.id) ?? 0) + (achievementById.get(p.id) ?? 0),
    }))
    // 同分時以報到時間排序，讓名次穩定而非每次查詢都跳動。
    .sort((a, b) => b.score - a.score || a.createdAt.getTime() - b.createdAt.getTime());

  // 同分者共享名次：名次 = 分數嚴格高於自己的人數 + 1。
  const rankOf = (score: number) =>
    scored.filter((s) => s.score > score).length + 1;

  const entries: LeaderboardEntry[] = scored.map((s) => ({
    rank: rankOf(s.score),
    participantId: s.participantId,
    nickname: s.nickname,
    score: s.score,
  }));

  return {
    top: entries.slice(0, event.leaderboardTopN),
    me: entries.find((e) => e.participantId === viewerId) ?? null,
    totalRanked: entries.length,
  };
}
