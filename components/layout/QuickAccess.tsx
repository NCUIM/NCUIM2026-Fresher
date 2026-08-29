"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Panel = "announcements" | "leaderboard";

type Announcement = { id: string; body: string; createdAt: string; read: boolean };
type LeaderEntry = { rank: number; participantId: string; nickname: string; score: number };

/**
 * 浮動快捷：公告與排行榜。
 *
 * 這兩件事的共通點是「隨時想瞄一眼，但不想離開現在在做的事」——
 * 在收集途中想確認集合時間、掃完一輪想看看自己排第幾。走 /me 再點進去
 * 要離開當前頁面，回來時剛才看到的位置也沒了。
 *
 * /me 上的入口保留：那裡是有意識地要去看完整內容的路徑，
 * 這裡則是隨手一瞄。兩者服務的不是同一個時刻。
 */
export function QuickAccess({ unreadAnnouncements = 0 }: { unreadAnnouncements?: number }) {
  const [open, setOpen] = useState<Panel | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [leaders, setLeaders] = useState<{
    top: LeaderEntry[];
    me: LeaderEntry | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        if (open === "announcements") {
          const res = await fetch("/api/announcements");
          if (cancelled) return;
          if (!res.ok) return setError("讀取失敗");
          setAnnouncements((await res.json()).announcements);
        } else {
          const res = await fetch("/api/leaderboard");
          if (cancelled) return;
          if (!res.ok) return setError("讀取失敗");
          const data = await res.json();
          setLeaders({ top: data.top, me: data.me });
        }
      } catch {
        if (!cancelled) setError("連線失敗");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/*
        疊在底部導覽上方。導覽列已經佔滿下緣，這兩顆再往上一層，
        右側對齊——拇指從導覽列往上滑就碰得到。
      */}
      <div
        className="fixed right-4 z-40 flex flex-col gap-2"
        style={{ bottom: "calc(var(--nav-h) + var(--safe-bottom) + 0.75rem)" }}
      >
        <button
          onClick={() => setOpen("announcements")}
          aria-label={
            unreadAnnouncements > 0
              ? `活動公告，${unreadAnnouncements} 則未讀`
              : "活動公告"
          }
          className={`glow-moon relative grid size-12 place-items-center rounded-full border-2 bg-void text-xl transition-transform hover:scale-105 active:scale-95 ${
            unreadAnnouncements > 0
              ? "border-moon text-moon"
              : "border-line text-dim"
          }`}
        >
          📣
          {unreadAnnouncements > 0 && (
            <span className="px absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-flare text-[10px] text-void">
              {unreadAnnouncements > 9 ? "9+" : unreadAnnouncements}
            </span>
          )}
        </button>

        <button
          onClick={() => setOpen("leaderboard")}
          aria-label="排行榜"
          className="grid size-12 place-items-center rounded-full border-2 border-line bg-void text-xl text-dim transition-transform hover:scale-105 active:scale-95"
        >
          🏆
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-void/80 p-4 backdrop-blur-sm"
          onClick={() => setOpen(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="card-pop flex max-h-[70dvh] w-full max-w-md flex-col rounded-xl border border-line surface p-4"
            style={{ marginBottom: "calc(var(--nav-h) + var(--safe-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between">
              <h2 className="font-bold">
                {open === "announcements" ? "活動公告" : "排行榜"}
              </h2>
              <button
                onClick={() => setOpen(null)}
                className="tap-target rounded-sm border border-line px-2.5 text-xs text-dim transition-colors hover:border-neon/60 hover:text-chalk"
              >
                關閉
              </button>
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {error ? (
                <p className="text-sm text-flare">{error}</p>
              ) : open === "announcements" ? (
                announcements === null ? (
                  <p className="text-sm text-faint">讀取中…</p>
                ) : announcements.length === 0 ? (
                  <p className="text-sm text-faint">目前還沒有公告。</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {announcements.map((a) => (
                      <li
                        key={a.id}
                        className={`rounded-lg border px-3 py-2 text-sm ${
                          a.read ? "border-line" : "border-moon/50 bg-board"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{a.body}</p>
                        <time className="px mt-1 block text-[11px] text-faint">
                          {new Date(a.createdAt).toLocaleString("zh-TW", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </li>
                    ))}
                  </ul>
                )
              ) : leaders === null ? (
                <p className="text-sm text-faint">讀取中…</p>
              ) : leaders.top.length === 0 ? (
                <p className="text-sm text-faint">還沒有人得分。</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {leaders.top.map((e) => (
                    <li
                      key={e.participantId}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                        leaders.me?.participantId === e.participantId
                          ? "bg-neon/10 text-neon"
                          : ""
                      }`}
                    >
                      <span
                        className={`px w-7 shrink-0 font-bold ${
                          e.rank <= 3 ? "text-neon" : "text-faint"
                        }`}
                      >
                        {String(e.rank).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{e.nickname}</span>
                      <span className="px shrink-0 text-neon">{e.score}</span>
                    </li>
                  ))}
                  {/*
                    自己不在前 N 名時單獨列出。看不到自己的排行榜等於
                    只告訴你「你不夠好」，卻不告訴你差多少。
                  */}
                  {leaders.me &&
                    !leaders.top.some(
                      (t) => t.participantId === leaders.me!.participantId,
                    ) && (
                      <li className="mt-1 flex items-center gap-3 rounded-lg border border-neon/40 bg-neon/10 px-3 py-2 text-sm text-neon">
                        <span className="px w-7 shrink-0 font-bold">
                          {String(leaders.me.rank).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {leaders.me.nickname}（你）
                        </span>
                        <span className="px shrink-0">{leaders.me.score}</span>
                      </li>
                    )}
                </ul>
              )}
            </div>

            <Link
              href={open === "announcements" ? "/announcements" : "/leaderboard"}
              onClick={() => setOpen(null)}
              className="tap-target mt-3 flex items-center justify-center rounded-lg border border-neon py-2.5 text-sm font-bold text-neon transition-colors hover:bg-neon hover:text-void"
            >
              查看完整頁面
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
