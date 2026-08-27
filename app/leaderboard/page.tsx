import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/session";
import { getLeaderboard } from "@/lib/leaderboard";
import { NavShell } from "@/components/BottomNav";
import { LeaderboardLive } from "./LeaderboardLive";

export default async function LeaderboardPage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  const board = await getLeaderboard(me.eventId, me.id);

  return (
    <NavShell>
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-black">排行榜</h1>
        <span className="px text-[10px] tracking-[0.2em] text-faint">
          TOP {board.top.length}
        </span>
      </header>

      <LeaderboardLive initial={board} meId={me.id} />

      {me.role === "STAFF" && (
        <p className="rounded-lg border border-moon/40 bg-moon/10 px-3 py-2 text-xs text-moon">
          工作人員不計入排名。
        </p>
      )}
    </NavShell>
  );
}
