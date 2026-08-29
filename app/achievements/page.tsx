import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/session";
import {
  evaluateAchievements,
  getAchievementStatus,
  type AchievementStatus,
} from "@/lib/achievements";
import { computeScore } from "@/lib/score";
import { NavShell } from "@/components/layout/NavShell";

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
    <NavShell>
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-black">成就</h1>
        <span className="px text-sm text-dim">
          {String(earnedCount).padStart(2, "0")}/
          {String(achievements.length).padStart(2, "0")}
        </span>
      </header>

      <div className="glow-neon flex flex-col items-center gap-0.5 rounded-xl border border-neon/50 surface py-4">
        <span className="px text-[10px] tracking-[0.2em] text-faint">SCORE</span>
        <span className="px text-glow-neon text-4xl leading-none text-neon">
          {score.total}
        </span>
        <span className="px text-[10px] text-faint">
          BASE {score.base} · BONUS {score.achievement}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {achievements.map((a) => (
          <li key={a.key}>
            <AchievementRow achievement={a} />
          </li>
        ))}
      </ul>
    </NavShell>
  );
}

function AchievementRow({ achievement }: { achievement: AchievementStatus }) {
  // 已解鎖：洋紅，與收集成功共用同一支顏色——都是「得手了」的時刻。
  if (achievement.earned) {
    return (
      <div className="flex flex-col gap-1 rounded-xl border border-flare/60 bg-flare/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg">🏅</span>
          <span className="flex-1 font-bold text-flare">{achievement.title}</span>
          <span className="px text-sm text-flare">+{achievement.points}</span>
        </div>
        {achievement.description && (
          <span className="pl-8 text-xs text-dim">{achievement.description}</span>
        )}
      </div>
    );
  }

  // 隱藏成就在伺服器端就已剪去名稱、條件與進度，這裡沒有東西可洩漏。
  if (achievement.hidden) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-line px-4 py-3 text-faint">
        <span className="text-lg">❓</span>
        <span className="flex-1">隱藏成就</span>
      </div>
    );
  }

  const { current, target } = achievement.progress;
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line surface px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-lg opacity-40 grayscale">🏅</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-bold">{achievement.title}</span>
          {achievement.description && (
            <span className="text-xs text-dim">{achievement.description}</span>
          )}
        </div>
        <span className="px text-sm text-faint">+{achievement.points}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden border border-line bg-void">
          <div
            className="glow-neon h-full bg-neon"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="px text-[11px] text-neon">
          {current}/{target}
        </span>
      </div>
    </div>
  );
}
