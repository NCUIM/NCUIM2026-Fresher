"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { eventNavItems, type EventNavKey } from "./event-nav-items";

/**
 * 浮動選單。固定在畫面右下角，捲到哪裡都能切換頁面。
 *
 * 頂端那排卡片式選單保留著——它在剛進頁面時一目了然。但後台的頁面很長
 * （參與者清單七十列、成就設定、排行榜），捲到一半想換頁就得先捲回最上面。
 * 這顆按鈕解決的就是那段來回。
 *
 * 放右下而不是右上：手機單手握持時拇指構得到的是下緣。
 */
export function EventMenu({
  eventId,
  current,
  eventName,
  mailProblems = 0,
}: {
  eventId: string;
  current: EventNavKey;
  eventName: string;
  mailProblems?: number;
}) {
  const [open, setOpen] = useState(false);
  const items = eventNavItems(eventId);

  // 打開側欄時鎖住背景捲動，否則手指滑動會穿透到底下的長清單。
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Esc 關閉。桌機上用鍵盤操作後台時，不必去找那顆關閉鈕。
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="開啟功能選單"
        aria-expanded={open}
        className="glow-neon fixed right-4 z-40 grid size-14 place-items-center rounded-full border-2 border-neon bg-void text-2xl text-neon transition-transform hover:scale-105 active:scale-95"
        style={{ bottom: "calc(1rem + var(--safe-bottom))" }}
      >
        ☰
        {mailProblems > 0 && (
          <span className="px absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-flare text-[10px] text-void">
            {mailProblems > 9 ? "9+" : mailProblems}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-void/80 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <aside
            className="flex h-full w-72 max-w-[85vw] flex-col gap-2 overflow-y-auto border-l border-line bg-night p-4"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: "calc(1rem + var(--safe-bottom))" }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <span className="px text-[10px] tracking-[0.2em] text-faint">
                  ADMIN
                </span>
                <span className="truncate font-bold">{eventName}</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="關閉選單"
                className="tap-target shrink-0 rounded-sm border border-line px-3 text-sm text-dim transition-colors hover:border-neon/50"
              >
                ✕
              </button>
            </div>

            <nav className="mt-2 flex flex-col gap-1.5">
              {items.map((item) => {
                const active = item.key === current;
                const alert = item.key === "logs" && mailProblems > 0;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`tap-target flex flex-col rounded-lg border px-3 py-2.5 transition-colors ${
                      active
                        ? "border-neon bg-neon/10"
                        : alert
                          ? "border-flare/60 bg-flare/10"
                          : "border-line hover:border-neon/50 hover:bg-slate"
                    }`}
                  >
                    <span
                      className={`flex items-center gap-2 text-sm font-bold ${
                        active ? "text-neon" : alert ? "text-flare" : ""
                      }`}
                    >
                      {item.label}
                      {alert && (
                        <span className="rounded-full bg-flare px-1.5 text-[10px] text-void">
                          {mailProblems}
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-faint">{item.hint}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto flex flex-col gap-1.5 border-t border-line pt-3">
              <Link
                href="/admin/events"
                onClick={() => setOpen(false)}
                className="tap-target flex items-center rounded-lg border border-line px-3 text-sm text-dim transition-colors hover:border-neon/50 hover:text-chalk"
              >
                切換活動
              </Link>
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="tap-target flex items-center rounded-lg border border-line px-3 text-sm text-dim transition-colors hover:border-neon/50 hover:text-chalk"
              >
                總管理後台
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
