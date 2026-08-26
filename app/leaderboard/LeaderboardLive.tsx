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
          <p className="text-center text-xs text-gray-400">你的名次</p>
          <Row
            rank={board.me.rank}
            nickname={board.me.nickname}
            score={board.me.score}
            highlight
          />
        </div>
      )}

      {board.top.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-500">
          還沒有人上榜，去掃描收集吧！
        </p>
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
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
        highlight ? "bg-gray-900 text-white" : "border border-gray-200"
      }`}
    >
      <span className="w-7 text-center text-sm tabular-nums">
        {medal ?? rank}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{nickname}</span>
      <span className="text-sm tabular-nums">{score}</span>
    </div>
  );
}
