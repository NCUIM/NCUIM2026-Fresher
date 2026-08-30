import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAdmin, requireEventAccess } from "@/lib/admin-session";
import { EventNav } from "@/components/admin/EventNav";
import { MailLog } from "@/components/admin/MailLog";

/**
 * 單一活動的系統紀錄。
 *
 * 獨立成頁而不是塞在後台首頁：那一頁是活動當天要快速操作的地方，
 * 紀錄則是出事時才需要細看的東西，兩者停留的時間長度完全不同。
 */
export default async function AdminLogsPage(
  props: PageProps<"/admin/events/[id]/logs">,
) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const { id } = await props.params;

  const event = await requireEventAccess(admin, id);
  if (!event) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-black">系統紀錄</h1>
          <span className="px text-sm text-dim">{admin.username}</span>
        </div>
        <p className="text-xs text-faint">{event.name}</p>
      </header>

      <EventNav eventId={event.id} eventName={event.name} current="logs" />

      <MailLog eventId={event.id} />

      <Link
        href={`/admin/events/${event.id}`}
        className="tap-target flex items-center justify-center rounded-lg border border-line py-2.5 text-sm text-dim transition-colors hover:border-neon/60 hover:text-chalk"
      >
        回到後台
      </Link>
    </main>
  );
}
