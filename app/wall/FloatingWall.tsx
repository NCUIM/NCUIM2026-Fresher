"use client";

import { useState } from "react";
import type { WallImpression } from "@/lib/wall";

/**
 * 漂浮呈現。
 *
 * 動畫一律用 transform 與 opacity，不動 top/left——後者會觸發版面重排，
 * 在同時有數十張卡片漂浮時會讓手機明顯掉幀。
 *
 * 尊重 prefers-reduced-motion：對前庭功能敏感的人，滿版緩慢漂移的內容
 * 可能引發不適，因此在該設定下改為靜態排列（見 globals.css）。
 */
export function FloatingWall({
  impressions,
  purgeDate,
}: {
  impressions: WallImpression[];
  purgeDate: string | null;
}) {
  const [selected, setSelected] = useState<WallImpression | null>(null);
  const [items, setItems] = useState(impressions);
  const [error, setError] = useState<string | null>(null);

  async function hide(impression: WallImpression, report: boolean) {
    try {
      const res = await fetch("/api/impressions/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ impressionId: impression.id, report }),
      });
      if (!res.ok) {
        setError("操作失敗，請再試一次");
        return;
      }
      setItems((list) => list.filter((i) => i.id !== impression.id));
      setSelected(null);
    } catch {
      setError("連線失敗，請確認網路");
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="px text-[11px] tracking-[0.2em] text-faint">EMPTY</span>
        <p className="font-bold">還沒有人寫下對你的印象</p>
        <p className="text-sm text-dim">
          多去認識一些人，他們寫的話會出現在這裡。
        </p>
      </div>
    );
  }

  return (
    <>
      {/* 夜空當底，右上角一道琥珀月光 */}
      <div className="wall-field relative flex-1 overflow-hidden rounded-xl border border-line bg-void">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 72% 16%, rgba(255,206,92,.14), transparent 55%)",
          }}
        />

        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => setSelected(item)}
            className={`wall-card absolute max-w-[72%] rounded-lg px-3 py-2 text-left ${
              item.featured
                ? "z-10 border border-moon bg-void text-moon shadow-[0_0_14px_rgba(255,206,92,0.22)]"
                : "border border-line bg-slate text-dim"
            }`}
            style={
              {
                // 以索引推導位置與節奏，讓每張卡片的漂浮軌跡各不相同，
                // 但重新整理後保持一致，不會每次都跳到別的地方。
                left: `${6 + ((i * 37) % 52)}%`,
                top: `${5 + ((i * 53) % 78)}%`,
                "--drift-delay": `${(i % 7) * -1.4}s`,
                "--drift-duration": `${9 + (i % 5) * 1.6}s`,
              } as React.CSSProperties
            }
          >
            <p className="text-xs leading-snug">{item.text}</p>
            <p
              className={`mt-1 text-[10px] ${item.featured ? "text-moon/70" : "text-faint"}`}
            >
              — {item.authorNickname}
              {item.featured && " ★"}
            </p>
          </button>
        ))}
      </div>

      {purgeDate && (
        <p className="text-center text-[11px] text-faint">
          這些內容將於 {purgeDate} 刪除，想留下請自行截圖
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-flare/15 px-3 py-2 text-sm text-flare">
          {error}
        </p>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-void/80 px-5 pb-[calc(1.5rem+var(--safe-bottom))]"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-line bg-night p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base">{selected.text}</p>
            <p className="mt-2 text-sm text-dim">— {selected.authorNickname}</p>

            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => hide(selected, true)}
                className="tap-target rounded-sm border border-flare/60 bg-flare/10 py-3 text-sm font-bold text-flare"
              >
                隱藏並回報給主辦方
              </button>
              <button
                onClick={() => hide(selected, false)}
                className="tap-target rounded-sm border border-line py-3 text-sm text-dim"
              >
                只隱藏，不回報
              </button>
              <button
                onClick={() => setSelected(null)}
                className="tap-target rounded-sm py-3 text-sm text-faint"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
