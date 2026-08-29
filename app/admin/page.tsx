import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-session";
import { verifyPassword } from "@/lib/password";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminAccounts } from "@/components/admin/AdminAccounts";
import { EventSettings } from "@/components/admin/EventSettings";

export default async function AdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const [event, participants, admins] = await Promise.all([
    prisma.event.findFirst({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        name: true,
        status: true,
        passcode: true,
        basePoints: true,
        leaderboardTopN: true,
      },
    }),
    prisma.participant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nickname: true,
        realName: true,
        role: true,
        avatarUrl: true,
        bio: true,
        socialUrl: true,
        team: { select: { number: true } },
        _count: {
          select: {
            scansInitiated: true,
            collections: true,
            impressionsWritten: true,
          },
        },
      },
    }),
    prisma.admin.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        createdAt: true,
        _count: { select: { sessions: true } },
      },
    }),
  ]);

  // 種子檔的預設密碼是公開的，還在用就必須警告。
  const usingDefaultPassword = await verifyPassword(
    "change-me",
    admin.passwordHash,
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-black">後台</h1>
        <span className="px text-sm text-dim">{admin.username}</span>
      </header>

      {/* 活動當天最常用的兩個入口，放最上面 */}
      <nav className="grid gap-2 sm:grid-cols-2">
        <Link
          href="/admin/display"
          className="tap-target glow-neon flex flex-col rounded-xl border border-neon/50 bg-neon/10 px-4 py-3"
        >
          <span className="font-bold text-neon">現場投影畫面</span>
          <span className="text-xs text-dim">大 QR ＋ 大通關碼，打在投影幕上</span>
        </Link>
        <Link
          href="/admin/codes"
          className="tap-target flex flex-col rounded-xl border border-line px-4 py-3"
        >
          <span className="font-bold">報到 QR Code</span>
          <span className="text-xs text-dim">列印或存檔用，含工作人員版</span>
        </Link>
      </nav>

      {event && (
        <EventSettings
          initial={{
            passcode: event.passcode,
            basePoints: event.basePoints,
            leaderboardTopN: event.leaderboardTopN,
          }}
          participantCount={participants.length}
        />
      )}

      <AdminDashboard
        initial={participants}
        eventName={event?.name ?? "（無活動）"}
        archived={event?.status === "ARCHIVED"}
      />

      <AdminAccounts
        initial={admins.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        }))}
        currentId={admin.id}
        usingDefaultPassword={usingDefaultPassword}
      />
    </main>
  );
}
