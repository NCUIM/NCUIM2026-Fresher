import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAdmin, requireEventAccess } from "@/lib/admin-session";
import { rankAll } from "@/lib/leaderboard";
import { AdminLeaderboard } from "@/components/admin/AdminLeaderboard";
import { EventNav } from "@/components/admin/EventNav";

export default async function AdminLeaderboardPage(
  props: PageProps<"/admin/events/[id]/leaderboard">,
) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const { id } = await props.params;

  // ⚠️ 每一頁的第一件事，不可以改成在 layout 做（見 requireEventAccess）。
  const event = await requireEventAccess(admin, id);
  if (!event) notFound();

  const entries = await rankAll(event.id);

  /*
    後台是拿筆電看的，不是手機。其餘頁面沿用 max-w-2xl 的手機版面是因為
    主辦方也會在現場用手機處理，但排行榜是「一次看完全場」的頁面——
    一百人的清單在 672px 寬裡要捲很久。
  */
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))] lg:max-w-6xl lg:px-8">
      <header className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-black lg:text-2xl">排行榜</h1>
          <span className="px text-sm text-dim">{admin.username}</span>
        </div>
        <p className="text-xs text-faint">{event.name}</p>
      </header>

      <EventNav eventId={event.id} eventName={event.name} current="leaderboard" />

      <AdminLeaderboard entries={entries} />

      <Link
        href={`/admin/events/${event.id}`}
        className="tap-target flex items-center justify-center rounded-lg border border-line py-2.5 text-sm text-dim transition-colors hover:border-neon/60 hover:text-chalk"
      >
        回到總覽
      </Link>
    </main>
  );
}
