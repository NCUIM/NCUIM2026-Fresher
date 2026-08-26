import { prisma } from "./prisma";

export type WallImpression = {
  id: string;
  text: string;
  authorId: string;
  authorNickname: string;
  /** 作者是否把收件人放進自己的 Showcase——決定牆上的顯眼程度。 */
  featured: boolean;
  hidden: boolean;
};

/**
 * 一位 Participant 收到的所有 Impression。
 *
 * ⚠️ ADR-0003：牆面只屬於收件人。查詢一律以 subjectId 綁定呼叫者，
 * 不接受任意指定對象的參數——沒有可以被誤用成「看別人的牆」的入口。
 */
export async function getReceivedImpressions(
  participantId: string,
  { includeHidden = false }: { includeHidden?: boolean } = {},
): Promise<WallImpression[]> {
  const rows = await prisma.impression.findMany({
    where: {
      subjectId: participantId,
      ...(includeHidden ? {} : { hiddenBySubject: false }),
    },
    include: { author: { select: { id: true, nickname: true } } },
    orderBy: { createdAt: "desc" },
  });

  // 被作者放進九宮格的人，其 Impression 在牆上更顯眼。
  const featuredBy = await prisma.showcaseSlot.findMany({
    where: { subjectId: participantId },
    select: { ownerId: true },
  });
  const featuredAuthors = new Set(featuredBy.map((s) => s.ownerId));

  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    authorId: r.author.id,
    authorNickname: r.author.nickname,
    featured: featuredAuthors.has(r.author.id),
    hidden: r.hiddenBySubject,
  }));
}

/**
 * 收件人隱藏一則 Impression，可一併回報給 Admin。
 *
 * 隱藏只影響收件人自己的檢視，**不刪除資料**——Admin 仍須能查看以進行審核。
 * 作者端沒有任何查詢隱藏狀態的管道（ADR-0003）。
 */
export async function hideImpression(
  participantId: string,
  impressionId: string,
  report: boolean,
): Promise<boolean> {
  const result = await prisma.impression.updateMany({
    // subjectId 條件確保只有收件人能隱藏，別人動不了。
    where: { id: impressionId, subjectId: participantId },
    data: {
      hiddenBySubject: true,
      ...(report ? { reportedAt: new Date() } : {}),
    },
  });
  return result.count > 0;
}
