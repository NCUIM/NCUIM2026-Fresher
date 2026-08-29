import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, resolveAdminEvent } from "@/lib/admin-session";
import { verifyPassword } from "@/lib/password";
import { AdminAccounts } from "@/components/admin/AdminAccounts";
import { EventOverview } from "@/components/admin/EventOverview";

/**
 * 總管理員的管理介面：有哪些活動、誰負責哪一場、有哪些管理員帳號。
 *
 * 與 /admin/events/[id] 的分工是「跨活動」對「單一活動」。
 * 主持人沒有跨活動的視野，所以直接把他導去他自己的場次。
 */
export default async function AdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  if (admin.role !== "SUPER") {
    const mine = await resolveAdminEvent(admin);
    redirect(mine ? `/admin/events/${mine.id}` : "/admin/events");
  }

  const [events, hosts, admins] = await Promise.all([
    prisma.event.findMany({
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
        _count: {
          select: { participants: true, teams: true, achievements: true },
        },
        hosts: { select: { admin: { select: { id: true, username: true } } } },
      },
    }),
    // 只有主持人需要被指派；總管理員的權限來自 role。
    prisma.admin.findMany({
      where: { role: "HOST" },
      orderBy: { username: "asc" },
      select: { id: true, username: true },
    }),
    prisma.admin.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        _count: { select: { sessions: true } },
        assignments: {
          select: { event: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  const usingDefaultPassword = await verifyPassword(
    "change-me",
    admin.passwordHash,
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-black">總管理後台</h1>
          <span className="px text-sm text-dim">{admin.username}</span>
        </div>
        <p className="text-xs text-faint">
          共 {events.length} 場活動。點「進入後台」操作其中一場。
        </p>
      </header>

      <EventOverview
        initial={events.map((e) => ({
          ...e,
          startsAt: e.startsAt.toISOString(),
          archivedAt: e.archivedAt?.toISOString() ?? null,
          purgeAfter: e.purgeAfter?.toISOString() ?? null,
        }))}
        hostOptions={hosts}
      />

      <AdminAccounts
        initial={admins.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        }))}
        currentId={admin.id}
        usingDefaultPassword={usingDefaultPassword}
        eventOptions={events.map((e) => ({
          id: e.id,
          name: e.name,
          status: e.status,
        }))}
      />
    </main>
  );
}
