import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * 一個信箱在同一場活動只能對應一個身分。
 *
 * 這條限制的用途不是安全性，而是找回機制的正確性：/api/recover 是用
 * 信箱去查身分的，同一個信箱若掛在兩筆記錄上，那個查詢就沒有唯一答案，
 * 我們只能猜一筆寄出去——猜錯的人會拿到別人的收集成果。
 */
export const DUPLICATE_EMAIL_MESSAGE =
  "這個信箱已經報到過了。如果那是你，請用「找回身分」回到原本的成果。";

/** 這場活動裡是否已經有別人用了這個信箱。 */
export async function emailTaken(
  eventId: string,
  email: string,
  exceptParticipantId?: string,
): Promise<boolean> {
  const existing = await prisma.participant.findFirst({
    where: { eventId, email },
    select: { id: true },
  });
  return existing !== null && existing.id !== exceptParticipantId;
}

/**
 * 判斷錯誤是否來自 (eventId, email) 唯一鍵。
 *
 * 事前檢查擋不住併發：兩個請求可以同時查到「還沒人用」，再同時寫入。
 * 真正的保證是資料庫的唯一鍵；這裡把它的錯誤翻成同一則訊息，
 * 免得使用者在那個極少數的時間差裡看到 500。
 */
export function isDuplicateEmailError(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2002" &&
    JSON.stringify(e.meta?.target ?? "").includes("email")
  );
}
