import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getCurrentAdmin,
  requireEventAccess,
  setActiveEvent,
} from "@/lib/admin-session";
import { verifyPassword } from "@/lib/password";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { EventSettings } from "@/components/admin/EventSettings";
import { AchievementEditor } from "@/components/admin/AchievementEditor";

/**
 * 單一活動的主持後台。
 *
 * 活動由網址決定，不再是「我選定的那一場」。這讓連結可以分享給另一位
 * 主持人、兩個分頁能各看一場、上一頁也能還原——先前把選定存在
 * Admin.activeEventId 時這三件事都做不到。
 */
export default async function EventAdminPage(
  props: PageProps<"/admin/events/[id]">,
) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const { id } = await props.params;

  // ⚠️ 每一頁的第一件事。不可以改成在 layout 做，見 requireEventAccess 的說明。
  const event = await requireEventAccess(admin, id);
  if (!event) notFound();

  /*
    順手記住這一場，讓沒帶 id 的入口（例如登入後的 /admin）知道要去哪。
    activeEventId 從「唯一依據」降級成「預設值」——網址永遠優先。
  */
  await setActiveEvent(admin, event.id);

  const [participants, admins, mailProblems] = await Promise.all([
    prisma.participant.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nickname: true,
        realName: true,
        personalCode: true,
        role: true,
        avatarUrl: true,
        bio: true,
        socialUrl: true,
        icons: true,
        zodiac: true,
        university: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        team: { select: { number: true, name: true } },
        _count: {
          select: {
            scansInitiated: true,
            scansReceived: true,
            collections: true,
            impressionsWritten: true,
            impressionsReceived: true,
            achievements: true,
          },
        },
      },
    }),
    prisma.admin.findMany({
      where: { assignments: { some: { eventId: event.id } } },
      orderBy: { username: "asc" },
      select: { id: true, username: true },
    }),
    prisma.mailLog.count({
      where: {
        participant: { eventId: event.id },
        status: { in: ["FAILED", "SKIPPED"] },
      },
    }),
  ]);

  const usingDefaultPassword = await verifyPassword(
    "change-me",
    admin.passwordHash,
  );

  const base = `/admin/events/${event.id}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-black">{event.name}</h1>
          <span className="px text-sm text-dim">{admin.username}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {event.status === "ARCHIVED" && (
            <span className="rounded-full border border-moon px-2 py-0.5 text-[10px] text-moon">
              已封存
            </span>
          )}
          <span className="text-faint">
            {participants.length} 人・主持人{" "}
            {admins.length > 0 ? admins.map((a) => a.username).join("、") : "未指派"}
          </span>
          <Link href="/admin/events" className="ml-auto text-neon underline">
            切換活動
          </Link>
        </div>
      </header>

      {/* 活動當天最常用的入口 */}
      <nav className="grid gap-2 sm:grid-cols-2">
        <Link
          href={`${base}/display`}
          className="tap-target glow-neon flex flex-col rounded-xl border border-neon/50 bg-neon/10 px-4 py-3"
        >
          <span className="font-bold text-neon">現場投影畫面</span>
          <span className="text-xs text-dim">大 QR ＋ 大通關碼，打在投影幕上</span>
        </Link>
        <Link
          href={`${base}/codes`}
          className="tap-target flex flex-col rounded-xl border border-line px-4 py-3"
        >
          <span className="font-bold">報到 QR Code</span>
          <span className="text-xs text-dim">列印或存檔用，含工作人員版</span>
        </Link>

        <Link
          href={`${base}/logs`}
          className={`tap-target flex flex-col rounded-xl border px-4 py-3 sm:col-span-2 ${
            mailProblems > 0 ? "border-flare/60 bg-flare/10" : "border-line"
          }`}
        >
          <span
            className={`flex items-center gap-2 font-bold ${
              mailProblems > 0 ? "text-flare" : ""
            }`}
          >
            系統紀錄
            {mailProblems > 0 && (
              <span className="rounded-full bg-flare px-2 py-0.5 text-[10px] text-void">
                {mailProblems}
              </span>
            )}
          </span>
          <span className="text-xs text-dim">
            {mailProblems > 0
              ? `有 ${mailProblems} 封信沒有送出，點進去看原因`
              : "寄信結果與失敗原因"}
          </span>
        </Link>
      </nav>

      <EventSettings
        eventId={event.id}
        initial={{
          passcode: event.passcode,
          basePoints: event.basePoints,
          leaderboardTopN: event.leaderboardTopN,
        }}
        participantCount={participants.length}
      />

      <AchievementEditor eventId={event.id} />

      <AdminDashboard
        eventId={event.id}
        initial={participants}
        eventName={event.name}
        archived={event.status === "ARCHIVED"}
      />

      {usingDefaultPassword && (
        <p className="rounded-lg border border-flare/50 bg-flare/15 px-4 py-3 text-sm text-flare">
          你還在使用預設密碼，請盡快更換。
          {admin.role === "SUPER" && "（後台首頁的帳號管理可以修改）"}
        </p>
      )}
    </main>
  );
}
