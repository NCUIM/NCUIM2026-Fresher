import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/session";
import {
  evaluateAchievements,
  getAchievementStatus,
  type AchievementStatus,
} from "@/lib/achievements";
import { computeScore } from "@/lib/score";

export default async function AchievementsPage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  await evaluateAchievements(me.id);
  const [achievements, score] = await Promise.all([
    getAchievementStatus(me.id),
    computeScore(me.id),
  ]);

  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">成就</h1>
        <span className="text-sm text-gray-500">
          {earnedCount}/{achievements.length}
        </span>
      </header>

      <div className="flex items-center justify-center gap-1 rounded-2xl bg-gray-900 py-4 text-white">
        <span className="text-3xl font-bold">{score.total}</span>
        <span className="self-end pb-1 text-sm text-gray-300">分</span>
      </div>

      <ul className="flex flex-col gap-2">
        {achievements.map((a) => (
          <li key={a.key}>
            <AchievementRow achievement={a} />
          </li>
        ))}
      </ul>

      <Link
        href="/me"
        className="tap-target flex items-center justify-center text-sm text-gray-500"
      >
        回到我的頁面
      </Link>
    </main>
  );
}

function AchievementRow({ achievement }: { achievement: AchievementStatus }) {
  if (achievement.earned) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-900 bg-gray-900 px-4 py-3 text-white">
        <span className="text-xl">🏅</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{achievement.title}</span>
          {achievement.description && (
            <span className="text-xs text-gray-300">{achievement.description}</span>
          )}
        </div>
        <span className="text-sm font-medium">+{achievement.points}</span>
      </div>
    );
  }

  // 隱藏成就在伺服器端就已剪去名稱、條件與進度，這裡沒有東西可洩漏。
  if (achievement.hidden) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-gray-400">
        <span className="text-xl">❓</span>
        <span className="flex-1 font-medium">隱藏成就</span>
      </div>
    );
  }

  const { current, target } = achievement.progress;
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-xl grayscale">🏅</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{achievement.title}</span>
          {achievement.description && (
            <span className="text-xs text-gray-500">{achievement.description}</span>
          )}
        </div>
        <span className="text-sm text-gray-400">+{achievement.points}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-gray-900" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs tabular-nums text-gray-500">
          {current}/{target}
        </span>
      </div>
    </div>
  );
}
