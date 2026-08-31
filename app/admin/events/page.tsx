import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-session";
import { EventOverview } from "@/components/admin/EventOverview";

/**
 * 活動路口：所有活動的清單、建立、封存、刪除與指派主持人。
 *
 * 兩種身分看到的東西不同。總管理員在這裡管理全部；主持人只是選擇要進
 * 哪一場——**清單的 where 條件就是隔離本身**，不是靠畫面少畫幾個項目，
 * 而是資料庫根本不回傳別人的場次。
 */
export default async function EventsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const isSuper = admin.role === "SUPER";

  const [events, hosts] = await Promise.all([
    prisma.event.findMany({
      where: isSuper ? {} : { hosts: { some: { adminId: admin.id } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        status: true,
        startsAt: true,
        archivedAt: true,
        purgeAfter: true,
        teamCount: true,
        basePoints: true,
        leaderboardTopN: true,
        publicLeaderboard: true,
        scanningOpen: true,
        _count: {
          select: { participants: true, teams: true, achievements: true },
        },
        hosts: { select: { admin: { select: { id: true, username: true } } } },
      },
    }),
    isSuper
      ? prisma.admin.findMany({
          where: { role: "HOST" },
          orderBy: { username: "asc" },
          select: { id: true, username: true },
        })
      : Promise.resolve([]),
  ]);

  // 主持人只被指派一場時，選單沒有意義，直接送他進去。
  if (!isSuper && events.length === 1) {
    redirect(`/admin/events/${events[0].id}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-black">
            {isSuper ? "所有活動" : "選擇活動"}
          </h1>
          <span className="px text-sm text-dim">{admin.username}</span>
        </div>
        <p className="text-xs text-faint">
          {isSuper
            ? `共 ${events.length} 場。可在這裡建立、封存與刪除活動。`
            : `你被指派了 ${events.length} 場`}
        </p>
      </header>

      {/*
        戰情室放在最上面。它是活動當天唯一會「一直開著」的畫面——
        其餘功能都是進去做完一件事就離開。
      */}
      <Link
        href="/admin/events/warroom"
        className="tap-target glow-neon flex items-center justify-between rounded-xl border-2 border-neon/60 bg-neon/10 px-4 py-3.5 transition-colors hover:bg-neon/20"
      >
        <span className="flex flex-col">
          <span className="font-bold text-neon">活動戰情室</span>
          <span className="text-xs text-dim">
            即時連線圖・掃描與成就動態・完整排名（建議用電腦或投影幕）
          </span>
        </span>
        <span className="px shrink-0 text-neon">▶</span>
      </Link>

      {isSuper ? (
        <EventOverview
          initial={events.map((e) => ({
            ...e,
            startsAt: e.startsAt.toISOString(),
            archivedAt: e.archivedAt?.toISOString() ?? null,
            purgeAfter: e.purgeAfter?.toISOString() ?? null,
          }))}
          hostOptions={hosts}
        />
      ) : events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-12 text-center text-sm text-faint">
          你還沒有被指派任何活動，請聯絡總管理員。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/admin/events/${e.id}`}
                className="tap-target flex flex-col items-start rounded-xl border border-line px-4 py-3 transition-colors hover:border-neon/50"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{e.name}</span>
                  {e.status === "ACTIVE" ? (
                    <span className="rounded-full bg-neon px-2 py-0.5 text-[10px] text-void">
                      進行中
                    </span>
                  ) : (
                    <span className="rounded-full border border-moon px-2 py-0.5 text-[10px] text-moon">
                      已封存
                    </span>
                  )}
                </span>
                <span className="mt-1 text-xs text-faint">
                  {e._count.participants} 人・
                  {new Date(e.startsAt).toLocaleDateString("zh-TW")} 開始
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {isSuper && (
        <Link
          href="/admin"
          className="tap-target flex items-center justify-center rounded-lg border border-line py-2.5 text-sm text-dim transition-colors hover:border-neon/60 hover:text-chalk"
        >
          回到總管理後台
        </Link>
      )}
    </main>
  );
}
