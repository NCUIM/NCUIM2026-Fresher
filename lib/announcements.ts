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

export async function listAnnouncements(
  eventId: string,
  participantId: string,
): Promise<AnnouncementList> {
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
}

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
