import Link from "next/link";
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
export default async function WarRoomPage(
  props: PageProps<"/admin/events/warroom">,
) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  // 清單的 where 條件就是隔離本身：主持人在選單裡只會看到自己的場次。
  const events = await prisma.event.findMany({
    where:
      admin.role === "SUPER" ? {} : { hosts: { some: { adminId: admin.id } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: { id: true, name: true, status: true },
  });

  /*
    沒有活動時把話說清楚，不要把人彈回去。

    原本這裡是 redirect("/admin/events")——使用者按了「活動戰情室」卻回到
    活動清單，沒有任何訊息。那看起來像按鈕壞了，而不是「還沒有東西可以看」。
    全新的環境一定會先遇到這個狀態：管理員建好了，活動還沒建。
  */
  if (events.length === 0) {
    return (
      <main className="warroom relative grid min-h-dvh place-items-center px-6 text-center text-chalk">
        <div aria-hidden="true" className="warroom-scanlines" />
        <div className="warroom-panel relative z-10 flex max-w-sm flex-col items-center gap-3 px-8 py-10">
          <span className="px text-[11px] tracking-[0.3em] text-faint">
            NO ACTIVE EVENT
          </span>
          <h1 className="text-xl font-black">還沒有任何活動</h1>
          <p className="text-sm text-dim">
            {admin.role === "SUPER"
              ? "戰情室顯示的是某一場活動的即時狀況。先建立一場活動，這裡才有東西可以看。"
              : "你還沒有被指派任何活動，請聯絡總管理員。"}
          </p>
          <Link
            href="/admin/events"
            className="tap-target mt-2 rounded-sm border border-neon px-5 text-sm font-bold text-neon transition-colors hover:bg-neon hover:text-void"
          >
            {admin.role === "SUPER" ? "去建立活動" : "回到活動清單"}
          </Link>
        </div>
      </main>
    );
  }

  /*
    從活動後台點進來時帶著 ?eventId=，落在那一場而不是清單第一場。

    要對照 events 才採用：那份清單已經按權限過濾過，所以這一步同時
    擋掉了用網址指定別人場次的可能——不是額外的檢查，是沿用同一份事實。
  */
  const { eventId } = await props.searchParams;
  const requested = typeof eventId === "string" ? eventId : undefined;
  const initial = events.find((e) => e.id === requested)?.id ?? events[0].id;

  return <WarRoom events={events} initialEventId={initial} />;
}
