import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-session";
import { WarRoom } from "@/components/admin/WarRoom";

/**
 * 活動戰情室。
 *
 * 放在 /admin/events 底下而不是某一場活動之內，因為它的重點就是
 * **可以切換場次**——那個下拉選單是這一頁的功能之一，不是導覽。
 *
 * 這一頁是給筆電或投影螢幕看的，因此不用手機那套 max-w-md 版面，
 * 而是滿版左右分欄。
 */
export default async function WarRoomPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  // 清單的 where 條件就是隔離本身：主持人在選單裡只會看到自己的場次。
  const events = await prisma.event.findMany({
    where:
      admin.role === "SUPER" ? {} : { hosts: { some: { adminId: admin.id } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: { id: true, name: true, status: true },
  });

  if (events.length === 0) redirect("/admin/events");

  return <WarRoom events={events} initialEventId={events[0].id} />;
}
