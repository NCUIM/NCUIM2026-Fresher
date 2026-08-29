import { getCurrentParticipant } from "@/lib/session";
import { pendingImpressions } from "@/lib/score";
import { listAnnouncements } from "@/lib/announcements";
import { BottomNav } from "./BottomNav";
import { QuickAccess } from "./QuickAccess";

/**
 * 有底部導覽列的頁面用這個外框。
 *
 * 待辦數量在這裡取得而非各頁自行傳入——徽章要在每一頁都正確，
 * 交給頁面各自負責的話，總會有人漏掉。
 */
export async function NavShell({ children }: { children: React.ReactNode }) {
  const me = await getCurrentParticipant();

  const [pending, announcements] = me
    ? await Promise.all([
        pendingImpressions(me.id),
        listAnnouncements(me.eventId, me.id),
      ])
    : [[], { unreadCount: 0 }];

  return (
    <>
      <div
        className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-7"
        style={{ paddingBottom: "calc(var(--nav-h) + var(--safe-bottom) + 1rem)" }}
      >
        {children}
      </div>
      {/* 公告與排行榜的浮動快捷。只有已報到者看得到——未報到時兩者都是空的。 */}
      {me && <QuickAccess unreadAnnouncements={announcements.unreadCount} />}
      <BottomNav
        pendingImpressions={pending.length}
        unreadAnnouncements={announcements.unreadCount}
      />
    </>
  );
}
