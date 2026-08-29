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

/**
 * 整批替換九宮格內容。**陣列索引即格子位置**，null 代表該格留空。
 *
 * 允許空格是刻意的：使用者可以把三個人擺在對角線上，那個排法本身就是
 * 他想表達的東西。若把陣列壓實再依序寫入，位置就會被系統重排，
 * 拖拉擺放也就失去意義。
 *
 * 相容於舊的緊密陣列——沒有 null 時行為與先前完全相同。
 */
export async function replaceShowcase(
  ownerId: string,
  slots: (string | null)[],
): Promise<{ ok: true } | { ok: false; reason: ShowcaseError }> {
  if (slots.length > SHOWCASE_SIZE) {
    return { ok: false, reason: "too_many" };
  }

  const filled = slots
    .map((subjectId, position) => ({ subjectId, position }))
    .filter((s): s is { subjectId: string; position: number } => s.subjectId !== null);

  const ids = filled.map((s) => s.subjectId);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, reason: "duplicate" };
  }

  // 只能展示已收集的人：Collection 的存在就是「我們見過面」的證據。
  if (ids.length > 0) {
    const collected = await prisma.collection.count({
      where: { ownerId, subjectId: { in: ids } },
    });
    if (collected !== ids.length) {
      return { ok: false, reason: "not_collected" };
    }
  }

  // 整批替換而非逐格更新：位置唯一鍵讓部分更新容易撞鍵，
  // 而九格的資料量重建一次的成本可以忽略。
  await prisma.$transaction([
    prisma.showcaseSlot.deleteMany({ where: { ownerId } }),
    prisma.showcaseSlot.createMany({ data: filled.map((s) => ({ ownerId, ...s })) }),
  ]);

  return { ok: true };
}
