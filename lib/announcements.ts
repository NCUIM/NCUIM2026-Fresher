import { cache } from "react";
import { prisma } from "./prisma";

export type AnnouncementView = {
  id: string;
  body: string;
  createdAt: Date;
  read: boolean;
};

export type AnnouncementList = {
  announcements: AnnouncementView[];
  unreadCount: number;
};

/*
  用 React 的 cache 包起來：一次請求裡不管被呼叫幾次，資料庫只查一次。

  伺服器元件各自取各自的資料——外框、頁面、頁面裡的元件都可能要同一份。
  實測 /me 一次載入打了 25 次查詢，其中七次是同一列 Participant、
  公告查了兩遍。cache 的範圍是單一請求，不會跨使用者。
*/
export const listAnnouncements = cache(async (
  eventId: string,
  participantId: string,
): Promise<AnnouncementList> => {
  const announcements = await prisma.announcement.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    include: {
      // 已讀狀態逐人獨立：只取出屬於這位參與者的紀錄。
      reads: { where: { participantId }, select: { participantId: true } },
    },
  });

  const view = announcements.map((a) => ({
    id: a.id,
    body: a.body,
    createdAt: a.createdAt,
    read: a.reads.length > 0,
  }));

  return {
    announcements: view,
    unreadCount: view.filter((a) => !a.read).length,
  };
});

export async function markAllRead(
  eventId: string,
  participantId: string,
): Promise<void> {
  const announcements = await prisma.announcement.findMany({
    where: { eventId },
    select: { id: true },
  });

  await prisma.announcementRead.createMany({
    data: announcements.map((a) => ({
      participantId,
      announcementId: a.id,
    })),
    // 重複標記已讀是常態（每次開啟頁面都會呼叫），不是錯誤。
    skipDuplicates: true,
  });
}
