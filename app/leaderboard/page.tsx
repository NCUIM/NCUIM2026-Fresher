import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/session";
import { getLeaderboard } from "@/lib/leaderboard";
import { LeaderboardLive } from "./LeaderboardLive";

export default async function LeaderboardPage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  const board = await getLeaderboard(me.eventId, me.id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">排行榜</h1>
        <span className="text-sm text-gray-500">
          前 {board.top.length} 名
        </span>
      </header>

      <LeaderboardLive initial={board} meId={me.id} />

      {me.role === "STAFF" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          工作人員不計入排名。
        </p>
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
