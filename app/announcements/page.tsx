import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/session";
import { listAnnouncements, markAllRead } from "@/lib/announcements";

export default async function AnnouncementsPage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  // 先讀取再標記已讀：這樣本次仍看得到未讀樣式，下次進來才清空。
  const { announcements } = await listAnnouncements(me.eventId, me.id);
  await markAllRead(me.eventId, me.id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <h1 className="text-xl font-bold">活動公告</h1>

      {announcements.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">
          目前還沒有公告。
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {announcements.map((a) => (
            <li
              key={a.id}
              className={`rounded-xl border px-4 py-3 ${
                a.read ? "border-gray-200" : "border-gray-900 bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="flex-1 whitespace-pre-wrap text-sm">{a.body}</p>
                {!a.read && (
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-gray-900" />
                )}
              </div>
              <time className="mt-2 block text-xs text-gray-400">
                {a.createdAt.toLocaleString("zh-TW", {
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/me"
        className="tap-target flex items-center justify-center text-sm text-gray-500"
      >
        回到我的頁面
      </Link>
    </main>
  );
}
