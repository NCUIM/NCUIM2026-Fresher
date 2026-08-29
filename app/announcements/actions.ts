"use server";

import { revalidatePath } from "next/cache";
import { getCurrentParticipant } from "@/lib/session";
import { markAllRead } from "@/lib/announcements";

/**
 * 標記全部公告為已讀，並讓底部導覽的未讀徽章跟著消失。
 *
 * 原本這件事在公告頁的渲染過程中直接做掉。伺服器端是對的——實測未讀數
 * 確實從 4 變成 0，/me 重新產生的 HTML 也不再帶徽章——但使用者看到的
 * 徽章來自 App Router 的 Client Cache：從 /me 進來、看完再退回 /me，
 * 拿到的是進來之前那份快取。
 *
 * router.refresh() 解決不了，它只清除**當前路由**的快取。這裡改用
 * revalidatePath("/", "layout")：它會讓根 layout 底下所有頁面失效，
 * 而未讀徽章正是由每一頁共用的 NavShell 畫出來的。
 */
export async function markAnnouncementsRead(): Promise<void> {
  const me = await getCurrentParticipant();
  if (!me) return;

  await markAllRead(me.eventId, me.id);
  revalidatePath("/", "layout");
}
