"use client";

import { useEffect, useState } from "react";
import type { LeaderboardView } from "@/lib/leaderboard";

/**
 * Q32：定時輪詢更新，不使用長連線推播。
 * 現場數百人同時在線時，維持長連線的成本遠高於它換來的體驗差異——
 * 大家忙著掃描與聊天，不會盯著排行榜看秒級變化。
 */
const REFRESH_MS = 30_000;

export function LeaderboardLive({
  initial,
  meId,
}: {
  initial: LeaderboardView;
  meId: string;
}) {
  const [board, setBoard] = useState(initial);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/leaderboard");
        if (res.ok) setBoard(await res.json());
      } catch {
        // 現場網路不穩是常態，靜默略過等下一次即可。
      }
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const meInTop = board.top.some((e) => e.participantId === meId);

  if (board.top.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-dim">
        還沒有人上榜，去掃描收集吧
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2">
        {board.top.map((entry) => (
          <li key={entry.participantId}>
            <Row
              rank={entry.rank}
              nickname={entry.nickname}
              score={entry.score}
              highlight={entry.participantId === meId}
            />
          </li>
        ))}
      </ol>

      {board.me && !meInTop && (
        <div className="flex flex-col gap-2">
          <p className="px text-center text-[10px] tracking-[0.2em] text-faint">
            YOUR RANK
          </p>
          <Row
            rank={board.me.rank}
            nickname={board.me.nickname}
            score={board.me.score}
            highlight
          />
        </div>
      )}
    </div>
  );
}

function Row({
  rank,
  nickname,
  score,
  highlight,
}: {
  rank: number;
  nickname: string;
  score: number;
  highlight: boolean;
}) {
  // 前三名用月光琥珀，其餘維持暗色——榜首該發光，但不搶走霓虹的職責。
  const rankColor =
    rank === 1 ? "text-moon text-glow-moon" : rank <= 3 ? "text-moon" : "text-faint";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
        highlight
          ? "border-neon bg-neon/10 text-neon"
          : "border-line surface"
      }`}
    >
      <span className={`px w-7 text-center text-sm ${highlight ? "" : rankColor}`}>
        {String(rank).padStart(2, "0")}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{nickname}</span>
      <span className="px text-sm">{score}</span>
    </div>
  );
}
