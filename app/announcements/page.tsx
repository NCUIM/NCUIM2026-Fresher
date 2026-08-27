import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/session";
import { listAnnouncements, markAllRead } from "@/lib/announcements";
import { NavShell } from "@/components/BottomNav";

export default async function AnnouncementsPage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  // 先讀取再標記已讀：這樣本次仍看得到未讀樣式，下次進來才清空。
  const { announcements } = await listAnnouncements(me.eventId, me.id);
  await markAllRead(me.eventId, me.id);

  return (
    <NavShell>
      <h1 className="text-xl font-black">活動公告</h1>

      {announcements.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-12 text-center text-sm text-faint">
          目前還沒有公告。
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {announcements.map((a) => (
            /*
              黑板綠是全站唯一的綠色，只給公告——
              讓「老師寫在黑板上」的聯想成立。
            */
            <li
              key={a.id}
              className={`rounded-lg border px-4 py-3 ${
                a.read
                  ? "border-line bg-night"
                  : "border-moon/50 bg-board shadow-[inset_0_0_24px_rgba(255,206,92,0.06)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="flex-1 whitespace-pre-wrap text-sm">{a.body}</p>
                {!a.read && (
                  <span className="glow-moon mt-1.5 size-2 shrink-0 rounded-full bg-moon" />
                )}
              </div>
              <time className="px mt-2 block text-[11px] text-faint">
                {a.createdAt.toLocaleString("zh-TW", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </li>
          ))}
        </ul>
      )}
    </NavShell>
  );
}
