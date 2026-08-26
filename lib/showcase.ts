import { prisma } from "./prisma";
import { toCardView, type CardView } from "./cards";
import { SHOWCASE_SIZE } from "./validation";

export { SHOWCASE_SIZE };

export type ShowcaseSlotView = {
  position: number;
  subjectId: string;
  card: CardView;
};

export type ShowcaseError = "too_many" | "not_collected" | "duplicate";

/**
 * 九宮格：從收集到的 Card 中挑選至多九張展示，公開可瀏覽。
 *
 * ⚠️ ADR-0003：本模組刻意**不提供**「某人被幾個人放入 Showcase」的查詢。
 * 一旦把那個數字端到使用者面前，它就變成第二條受歡迎程度的比較軸線——
 * 那正是我們決定不公開 Impression Wall 的同一個理由。
 * 唯一的反向查詢在 wall.ts，且僅用於決定牆上的顯眼程度，不回傳數量。
 */
export async function getShowcase(
  ownerId: string,
): Promise<ShowcaseSlotView[]> {
  const slots = await prisma.showcaseSlot.findMany({
    where: { ownerId },
    include: { subject: { include: { team: true } } },
    orderBy: { position: "asc" },
  });

  return slots.map((s) => ({
    position: s.position,
    subjectId: s.subjectId,
    card: toCardView(s.subject),
  }));
}

/** 整批替換九宮格內容，陣列順序即格子順序。 */
export async function replaceShowcase(
  ownerId: string,
  subjectIds: string[],
): Promise<{ ok: true } | { ok: false; reason: ShowcaseError }> {
  if (subjectIds.length > SHOWCASE_SIZE) {
    return { ok: false, reason: "too_many" };
  }
  if (new Set(subjectIds).size !== subjectIds.length) {
    return { ok: false, reason: "duplicate" };
  }

  // 只能展示已收集的人：Collection 的存在就是「我們見過面」的證據。
  const collected = await prisma.collection.count({
    where: { ownerId, subjectId: { in: subjectIds } },
  });
  if (collected !== subjectIds.length) {
    return { ok: false, reason: "not_collected" };
  }

  // 整批替換而非逐格更新：位置唯一鍵讓部分更新容易撞鍵，
  // 而九格的資料量重建一次的成本可以忽略。
  await prisma.$transaction([
    prisma.showcaseSlot.deleteMany({ where: { ownerId } }),
    prisma.showcaseSlot.createMany({
      data: subjectIds.map((subjectId, position) => ({
        ownerId,
        subjectId,
        position,
      })),
    }),
  ]);

  return { ok: true };
}
