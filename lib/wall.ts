import { prisma } from "./prisma";

export type WallImpression = {
  id: string;
  text: string;
  authorId: string;
  authorNickname: string;
  /** 作者是否把收件人放進自己的 Showcase——決定牆上的顯眼程度。 */
  featured: boolean;
  hidden: boolean;
  /** 已回報給主辦方。用來避免重複回報，也讓本人知道自己送出過。 */
  reported: boolean;
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
    reported: r.reportedAt !== null,
  }));
}

/**
 * 收件人切換一則 Impression 在自己牆上的顯示與否。
 *
 * 隱藏只影響收件人自己的檢視，**不刪除資料**——Admin 仍須能查看以進行審核。
 * 作者端沒有任何查詢隱藏狀態的管道（ADR-0003）。
 *
 * 可以還原是刻意的：隱藏是個一按就生效的動作，若不可逆，
 * 誤觸或一時情緒下的決定就會變成永久的損失，而那則內容本人再也看不到。
 */
export async function setImpressionHidden(
  participantId: string,
  impressionId: string,
  hidden: boolean,
): Promise<boolean> {
  const result = await prisma.impression.updateMany({
    // subjectId 條件確保只有收件人能操作，別人動不了。
    where: { id: impressionId, subjectId: participantId },
    data: { hiddenBySubject: hidden },
  });
  return result.count > 0;
}

/**
 * 回報給 Admin 審核。
 *
 * 與隱藏分開：隱藏是「我不想看到」，回報是「這需要有人處理」，
 * 兩者常常不同時發生。綁在一起的話，只想眼不見為淨的人會被迫驚動主辦方，
 * 而想檢舉但不介意留著的人則無路可走。
 *
 * 刻意不提供取消：回報一送出，主辦方就可能已經看到並開始處理，
 * 事後撤回只會讓兩邊對「這件事還算不算數」有不同認知。
 */
export async function reportImpression(
  participantId: string,
  impressionId: string,
): Promise<boolean> {
  const result = await prisma.impression.updateMany({
    where: { id: impressionId, subjectId: participantId },
    data: { reportedAt: new Date() },
  });
  return result.count > 0;
}
