import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { pairKeyFor } from "./codes";
import { toCardView, type CardView } from "./cards";

export type ScanFailure =
  | "self"
  | "not_found"
  | "different_event"
  | "archived";

export type ScanOutcome =
  | { ok: true; duplicate: boolean; card: CardView }
  | { ok: false; reason: ScanFailure };

export const SCAN_FAILURE_MESSAGE: Record<ScanFailure, string> = {
  self: "這是你自己的卡片，不能收集自己",
  not_found: "找不到這張卡片，請確認掃描的是本場活動的個人 QR Code",
  different_event: "這張卡片屬於另一場活動",
  archived: "活動已經結束，無法再收集",
};

/**
 * 執行一次收集。
 *
 * 一次 Scan 產生 **一筆 Scan 紀錄**（歸屬於發起者，供主動程度統計與成就判定）
 * 與 **兩筆 Collection**（雙方各一，持有關係對稱）。
 *
 * 冪等性由 Scan 的 (eventId, pairKey) 唯一鍵保證：pairKey 是兩個 id 排序後
 * 串接，因此 A→B 與稍後的 B→A 會撞到同一個鍵，被視為同一次相遇而非新的收集。
 */
export async function performScan(
  scannerId: string,
  personalCode: string,
): Promise<ScanOutcome> {
  const scanner = await prisma.participant.findUnique({
    where: { id: scannerId },
    include: { event: true },
  });
  if (!scanner) return { ok: false, reason: "not_found" };

  if (scanner.event.status !== "ACTIVE") {
    return { ok: false, reason: "archived" };
  }

  const target = await prisma.participant.findUnique({
    where: { personalCode: personalCode.toUpperCase() },
    include: { team: true },
  });
  if (!target) return { ok: false, reason: "not_found" };
  if (target.id === scanner.id) return { ok: false, reason: "self" };
  if (target.eventId !== scanner.eventId) {
    return { ok: false, reason: "different_event" };
  }

  const card = toCardView(target);
  const pairKey = pairKeyFor(scanner.id, target.id);

  try {
    await prisma.$transaction(async (tx) => {
      const scan = await tx.scan.create({
        data: {
          eventId: scanner.eventId,
          scannerId: scanner.id,
          scannedId: target.id,
          pairKey,
        },
      });

      // 雙方各持有對方，一次建立。
      await tx.collection.createMany({
        data: [
          {
            eventId: scanner.eventId,
            ownerId: scanner.id,
            subjectId: target.id,
            scanId: scan.id,
          },
          {
            eventId: scanner.eventId,
            ownerId: target.id,
            subjectId: scanner.id,
            scanId: scan.id,
          },
        ],
      });
    });

    return { ok: true, duplicate: false, card };
  } catch (e) {
    // P2002 = 唯一鍵衝突，代表這兩人已經相遇過。這是預期中的情形，
    // 不是錯誤——回報 duplicate 讓前端顯示「你已經收集過這個人了」。
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: true, duplicate: true, card };
    }
    throw e;
  }
}
