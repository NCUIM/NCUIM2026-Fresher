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

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-black">排行榜</h1>
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
