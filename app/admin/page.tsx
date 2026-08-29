import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, resolveAdminEvent } from "@/lib/admin-session";
import { verifyPassword } from "@/lib/password";
import { AdminAccounts } from "@/components/admin/AdminAccounts";

/**
 * 總管理後台：管理員帳號，以及通往活動路口的入口。
 *
 * 活動的清單與建立都在 /admin/events。這一頁只負責「跨活動的行政」——
 * 誰能登入、誰是總管理員。主持人沒有這個視野，直接導去他自己的場次。
 */
export default async function AdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  if (admin.role !== "SUPER") {
    const mine = await resolveAdminEvent(admin);
    redirect(mine ? `/admin/events/${mine.id}` : "/admin/events");
  }

  const [events, admins] = await Promise.all([
    prisma.event.findMany({
      select: { id: true, name: true, status: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
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

  const active = events.filter((e) => e.status === "ACTIVE").length;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-black">總管理後台</h1>
        <span className="px text-sm text-dim">{admin.username}</span>
      </header>

      <Link
        href="/admin/events"
        className="tap-target glow-neon flex flex-col rounded-xl border border-neon/50 bg-neon/10 px-4 py-3"
      >
        <span className="font-bold text-neon">活動管理</span>
        <span className="text-xs text-dim">
          {events.length === 0
            ? "還沒有任何活動，點進去建立第一場"
            : `共 ${events.length} 場，${active} 場進行中・建立、封存、刪除、指派主持人`}
        </span>
      </Link>

      <AdminAccounts
        initial={admins.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        }))}
        currentId={admin.id}
        usingDefaultPassword={usingDefaultPassword}
        eventOptions={events}
      />
    </main>
  );
}
